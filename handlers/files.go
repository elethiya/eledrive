package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"eledrive/config"
	"eledrive/db"
	"eledrive/events"
	"eledrive/middleware"
	"eledrive/models"
	"eledrive/storage"
	"eledrive/utils"
	"github.com/go-chi/chi/v5"
)

type FileHandler struct {
	cfg     *config.Config
	storage *storage.StorageService
}

func NewFileHandler(cfg *config.Config, storage *storage.StorageService) *FileHandler {
	return &FileHandler{cfg: cfg, storage: storage}
}

// CheckFileAccess checks if user has access to file. Returns file, permission, error
func CheckFileAccess(userID string, fileID string) (*models.File, string, error) {
	var f models.File
	var folderID sql.NullString
	var trashedAt sql.NullTime
	var secretUUID, forensicMeta sql.NullString

	err := db.DB.QueryRow(`
		SELECT f.id, f.name, f.original_name, f.folder_id, f.owner_id, u.name, u.email,
		       f.storage_path, f.size, f.mime_type, f.extension, f.is_starred, f.is_trashed, f.trashed_at,
		       COALESCE(f.secret_uuid, ''), COALESCE(f.forensic_meta, ''),
		       f.created_at, f.updated_at
		FROM files f
		JOIN users u ON f.owner_id = u.id
		WHERE f.id = ?
	`, fileID).Scan(
		&f.ID, &f.Name, &f.OriginalName, &folderID, &f.OwnerID, &f.OwnerName, &f.OwnerEmail,
		&f.StoragePath, &f.Size, &f.MimeType, &f.Extension, &f.IsStarred, &f.IsTrashed, &trashedAt,
		&secretUUID, &forensicMeta,
		&f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		return nil, "", err
	}

	if secretUUID.Valid {
		f.SecretUUID = secretUUID.String
	}
	if forensicMeta.Valid {
		f.ForensicMeta = forensicMeta.String
	}
	if folderID.Valid {
		f.FolderID = &folderID.String
	}
	if trashedAt.Valid {
		f.TrashedAt = &trashedAt.Time
	}

	// If caller is workspace owner, owner has full oversight access across the workspace
	var callerRole string
	_ = db.DB.QueryRow("SELECT role FROM main.users WHERE id = ?", userID).Scan(&callerRole)
	if callerRole == "owner" {
		return &f, "owner", nil
	}

	if f.OwnerID == userID {
		return &f, "owner", nil
	}

	// Check direct file or drive share
	var directPerm string
	err = db.DB.QueryRow(`
		SELECT permission FROM shares 
		WHERE ((target_type = 'file' AND target_id = ?) OR (target_type = 'drive' AND target_id = ?))
		  AND shared_with_user_id = ?
	`, fileID, f.OwnerID, userID).Scan(&directPerm)
	if err == nil {
		return &f, directPerm, nil
	}

	// Check team share (direct file or shared drive)
	err = db.DB.QueryRow(`
		SELECT ts.permission FROM team_shares ts
		JOIN main.team_members tm ON ts.team_id = tm.team_id
		WHERE ((ts.target_type = 'file' AND ts.target_id = ?) OR (ts.target_type = 'drive' AND ts.shared_by_user_id = ?))
		  AND tm.user_id = ?
	`, fileID, f.OwnerID, userID).Scan(&directPerm)
	if err == nil {
		return &f, directPerm, nil
	}

	// If file is inside a folder, check folder hierarchy share
	if f.FolderID != nil {
		_, parentPerm, err := CheckFolderAccess(userID, *f.FolderID)
		if err == nil {
			return &f, parentPerm, nil
		}
	}

	return nil, "", fmt.Errorf("access denied")
}

func (h *FileHandler) GetMetadata(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	fileID := chi.URLParam(r, "id")

	f, perm, err := CheckFileAccess(claims.UserID, fileID)
	if err != nil {
		utils.RespondError(w, http.StatusForbidden, "Access denied")
		return
	}
	f.SharedPermission = &perm

	utils.RespondJSON(w, http.StatusOK, f)
}

func (h *FileHandler) Download(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	fileID := chi.URLParam(r, "id")

	f, _, err := CheckFileAccess(claims.UserID, fileID)
	if err != nil {
		utils.RespondError(w, http.StatusForbidden, "Access denied")
		return
	}

	filePath := h.storage.GetFilePath(f.StoragePath)
	file, err := os.Open(filePath)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "File not found on storage")
		return
	}
	defer file.Close()

	// Download as attachment or inline (view in browser)
	isInline := r.URL.Query().Get("inline") == "1"
	disposition := "attachment"
	if isInline {
		disposition = "inline"
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("%s; filename=\"%s\"", disposition, f.Name))
	w.Header().Set("Content-Type", f.MimeType)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", f.Size))

	if !isInline {
		utils.LogDownloadEvent(db.DB, "file", f.ID, f.SecretUUID, claims.UserID, claims.Username, claims.Email, r.RemoteAddr, r.UserAgent())
		db.LogActivity(claims.UserID, claims.Username, "download", "file", f.ID, f.Name, fmt.Sprintf("Downloaded %s [Secret UUID: %s]", f.Name, f.SecretUUID))
	}

	http.ServeContent(w, r, f.Name, f.UpdatedAt, file)
}

func (h *FileHandler) GetPreview(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	fileID := chi.URLParam(r, "id")

	f, _, err := CheckFileAccess(claims.UserID, fileID)
	if err != nil {
		utils.RespondError(w, http.StatusForbidden, "Access denied")
		return
	}

	filePath := h.storage.GetFilePath(f.StoragePath)

	// If text or code file and size < 2MB, return text content directly
	if strings.HasPrefix(f.MimeType, "text/") ||
		strings.Contains(f.MimeType, "json") ||
		strings.Contains(f.MimeType, "javascript") ||
		strings.Contains(f.MimeType, "typescript") ||
		strings.Contains(f.MimeType, "yaml") ||
		strings.Contains(f.MimeType, "xml") ||
		isCodeExtension(f.Extension) {

		if f.Size > 2*1024*1024 {
			utils.RespondError(w, http.StatusBadRequest, "File too large for live preview")
			return
		}

		contentBytes, err := os.ReadFile(filePath)
		if err != nil {
			utils.RespondError(w, http.StatusInternalServerError, "Failed to read file")
			return
		}

		utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
			"type":      "text",
			"mime_type": f.MimeType,
			"name":      f.Name,
			"size":      f.Size,
			"content":   string(contentBytes),
		})
		return
	}

	// Otherwise, serve file inline for browser image/video/audio/pdf render
	file, err := os.Open(filePath)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "File not found on storage")
		return
	}
	defer file.Close()

	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", f.Name))
	w.Header().Set("Content-Type", f.MimeType)
	http.ServeContent(w, r, f.Name, f.UpdatedAt, file)
}

func (h *FileHandler) Rename(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	fileID := chi.URLParam(r, "id")

	f, perm, err := CheckFileAccess(claims.UserID, fileID)
	if err != nil || (perm != "owner" && perm != "editor") {
		utils.RespondError(w, http.StatusForbidden, "No permission to rename file")
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	cleanName := strings.TrimSpace(req.Name)
	if cleanName == "" {
		utils.RespondError(w, http.StatusBadRequest, "File name cannot be empty")
		return
	}

	ext := filepath.Ext(cleanName)
	newMime := utils.DetectMimeType(cleanName)

	_, err = db.DB.Exec(`
		UPDATE files 
		SET name = ?, extension = ?, mime_type = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`, cleanName, ext, newMime, fileID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to rename file")
		return
	}

	f.Name = cleanName
	f.Extension = ext
	f.MimeType = newMime
	events.Broadcast("file:update", "file", "rename", fileID, "", claims.UserID, map[string]interface{}{"name": cleanName})
	utils.RespondJSON(w, http.StatusOK, f)
}

func (h *FileHandler) Move(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	fileID := chi.URLParam(r, "id")

	_, perm, err := CheckFileAccess(claims.UserID, fileID)
	if err != nil || (perm != "owner" && perm != "editor") {
		utils.RespondError(w, http.StatusForbidden, "No permission to move file")
		return
	}

	var req struct {
		TargetFolderID *string `json:"target_folder_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	if req.TargetFolderID != nil && *req.TargetFolderID != "" {
		_, targetPerm, err := CheckFolderAccess(claims.UserID, *req.TargetFolderID)
		if err != nil || (targetPerm != "owner" && targetPerm != "editor") {
			utils.RespondError(w, http.StatusForbidden, "No permission to move into target folder")
			return
		}
	}

	_, err = db.DB.Exec("UPDATE files SET folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", req.TargetFolderID, fileID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to move file")
		return
	}

	events.Broadcast("file:update", "file", "move", fileID, "", claims.UserID, map[string]interface{}{"target_folder_id": req.TargetFolderID})
	utils.RespondSuccess(w, http.StatusOK, "File moved successfully", nil)
}

func (h *FileHandler) ToggleStar(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	fileID := chi.URLParam(r, "id")

	f, _, err := CheckFileAccess(claims.UserID, fileID)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "File not found")
		return
	}

	newStarred := !f.IsStarred
	_, err = db.DB.Exec("UPDATE files SET is_starred = ? WHERE id = ?", newStarred, fileID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update star")
		return
	}

	events.Broadcast("file:star", "file", "star", fileID, "", claims.UserID, map[string]interface{}{
		"id":         fileID,
		"is_starred": newStarred,
	})

	utils.RespondSuccess(w, http.StatusOK, "Updated", map[string]interface{}{
		"id":         fileID,
		"is_starred": newStarred,
	})
}

func (h *FileHandler) Trash(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	fileID := chi.URLParam(r, "id")

	_, perm, err := CheckFileAccess(claims.UserID, fileID)
	if err != nil || (perm != "owner" && perm != "editor") {
		utils.RespondError(w, http.StatusForbidden, "No permission to delete file")
		return
	}

	now := time.Now()
	_, err = db.DB.Exec(`
		UPDATE files 
		SET is_trashed = 1, trashed_at = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`, now, fileID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to move file to trash")
		return
	}

	_, _ = h.storage.UpdateUserStorage(claims.UserID)
	events.Broadcast("file:trash", "file", "trash", fileID, "", claims.UserID, nil)
	utils.RespondSuccess(w, http.StatusOK, "File moved to trash", nil)
}

func (h *FileHandler) Restore(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	fileID := chi.URLParam(r, "id")

	_, err := db.DB.Exec(`
		UPDATE files 
		SET is_trashed = 0, trashed_at = NULL, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ? AND owner_id = ?
	`, fileID, claims.UserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to restore file")
		return
	}

	_, _ = h.storage.UpdateUserStorage(claims.UserID)
	events.Broadcast("file:restore", "file", "restore", fileID, "", claims.UserID, nil)
	utils.RespondSuccess(w, http.StatusOK, "File restored", nil)
}

func (h *FileHandler) PermanentDelete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	fileID := chi.URLParam(r, "id")

	var ownerID, storagePath string
	err := db.DB.QueryRow("SELECT owner_id, storage_path FROM files WHERE id = ?", fileID).Scan(&ownerID, &storagePath)
	if err != nil || ownerID != claims.UserID {
		utils.RespondError(w, http.StatusForbidden, "No permission to delete file")
		return
	}

	_ = h.storage.DeleteFile(storagePath)
	_, err = db.DB.Exec("DELETE FROM files WHERE id = ?", fileID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to delete file record")
		return
	}

	_, _ = h.storage.UpdateUserStorage(claims.UserID)
	events.Broadcast("file:delete", "file", "delete", fileID, "", claims.UserID, nil)
	utils.RespondSuccess(w, http.StatusOK, "File permanently deleted", nil)
}

func (h *FileHandler) Search(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	category := strings.ToLower(r.URL.Query().Get("type")) // all, image, document, video, audio, archive, code

	pattern := "%" + strings.ToLower(q) + "%"

	// Find matching files
	var query string
	var args []interface{}

	if claims.Role == "owner" {
		query = `
			SELECT f.id, f.name, f.original_name, f.folder_id, f.owner_id, u.name, u.email,
			       f.size, f.mime_type, f.extension, f.is_starred, f.is_trashed, f.created_at, f.updated_at,
			       ((f.owner_id = ? AND (SELECT 1 FROM drive.team_shares WHERE (target_type = 'file' AND target_id = f.id) OR (f.folder_id IS NOT NULL AND target_type = 'folder' AND target_id = f.folder_id) OR (target_type = 'drive' AND shared_by_user_id = f.owner_id) LIMIT 1) IS NOT NULL)) AS is_team_shared,
			       ((f.owner_id = ? AND (SELECT 1 FROM drive.share_links WHERE target_type = 'file' AND target_id = f.id AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) LIMIT 1) IS NOT NULL)) AS has_share_link
			FROM files f
			JOIN users u ON f.owner_id = u.id
			WHERE f.is_trashed = 0
			  AND LOWER(f.name) LIKE ?
		`
		args = []interface{}{claims.UserID, claims.UserID, pattern}
	} else {
		query = `
			SELECT f.id, f.name, f.original_name, f.folder_id, f.owner_id, u.name, u.email,
			       f.size, f.mime_type, f.extension, f.is_starred, f.is_trashed, f.created_at, f.updated_at,
			       ((f.owner_id = ? AND (SELECT 1 FROM drive.team_shares WHERE (target_type = 'file' AND target_id = f.id) OR (f.folder_id IS NOT NULL AND target_type = 'folder' AND target_id = f.folder_id) OR (target_type = 'drive' AND shared_by_user_id = f.owner_id) LIMIT 1) IS NOT NULL)) AS is_team_shared,
			       ((f.owner_id = ? AND (SELECT 1 FROM drive.share_links WHERE target_type = 'file' AND target_id = f.id AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) LIMIT 1) IS NOT NULL)) AS has_share_link
			FROM files f
			JOIN users u ON f.owner_id = u.id
			WHERE (f.owner_id = ? OR f.id IN (SELECT target_id FROM shares WHERE target_type = 'file' AND shared_with_user_id = ?))
			  AND f.is_trashed = 0
			  AND LOWER(f.name) LIKE ?
		`
		args = []interface{}{claims.UserID, claims.UserID, claims.UserID, claims.UserID, pattern}
	}

	if category != "" && category != "all" {
		switch category {
		case "image":
			query += " AND (f.mime_type LIKE 'image/%' OR f.extension IN ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.avif'))"
		case "video":
			query += " AND (f.mime_type LIKE 'video/%' OR f.extension IN ('.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.m4v'))"
		case "audio":
			query += " AND (f.mime_type LIKE 'audio/%' OR f.extension IN ('.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.opus'))"
		case "pdf":
			query += " AND (f.mime_type LIKE '%pdf%' OR f.extension = '.pdf')"
		case "spreadsheet":
			query += " AND (f.mime_type LIKE '%sheet%' OR f.mime_type LIKE '%excel%' OR f.mime_type LIKE '%csv%' OR f.extension IN ('.xls', '.xlsx', '.csv', '.tsv', '.ods'))"
		case "presentation":
			query += " AND (f.mime_type LIKE '%presentation%' OR f.mime_type LIKE '%powerpoint%' OR f.extension IN ('.ppt', '.pptx', '.odp'))"
		case "document":
			query += " AND (f.mime_type LIKE '%word%' OR f.mime_type LIKE '%document%' OR f.mime_type LIKE 'text/%' OR f.extension IN ('.doc', '.docx', '.odt', '.rtf', '.txt', '.pages', '.epub', '.md'))"
		case "code":
			query += " AND (f.mime_type LIKE '%javascript%' OR f.mime_type LIKE '%json%' OR f.mime_type LIKE '%xml%' OR f.mime_type LIKE '%yaml%' OR f.extension IN ('.go', '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.sql', '.sh', '.json', '.xml', '.yml', '.yaml'))"
		case "archive":
			query += " AND (f.mime_type LIKE '%zip%' OR f.mime_type LIKE '%tar%' OR f.mime_type LIKE '%gzip%' OR f.mime_type LIKE '%compressed%' OR f.mime_type LIKE '%rar%' OR f.extension IN ('.zip', '.tar', '.gz', '.7z', '.rar', '.bz2', '.xz'))"
		}
	}

	query += " ORDER BY f.updated_at DESC LIMIT 50"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Search failed")
		return
	}
	defer rows.Close()

	files := make([]models.File, 0)
	for rows.Next() {
		var f models.File
		var folderID sql.NullString
		if err := rows.Scan(
			&f.ID, &f.Name, &f.OriginalName, &folderID, &f.OwnerID, &f.OwnerName, &f.OwnerEmail,
			&f.Size, &f.MimeType, &f.Extension, &f.IsStarred, &f.IsTrashed, &f.CreatedAt, &f.UpdatedAt,
			&f.IsTeamShared, &f.HasShareLink,
		); err == nil {
			if folderID.Valid {
				f.FolderID = &folderID.String
			}
			files = append(files, f)
		}
	}
	if err := rows.Err(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to read search files")
		return
	}

	// Find matching folders
	var fRows *sql.Rows
	if claims.Role == "owner" {
		fRows, err = db.DB.Query(`
			SELECT f.id, f.name, f.parent_id, f.owner_id, u.name, u.email, f.is_starred, f.is_trashed, f.color, f.created_at, f.updated_at,
			       (SELECT COUNT(*) FROM files WHERE folder_id = f.id AND is_trashed = 0) +
			       (SELECT COUNT(*) FROM folders WHERE parent_id = f.id AND is_trashed = 0) AS item_count,
			       ((f.owner_id = ? AND (SELECT 1 FROM drive.team_shares WHERE (target_type = 'folder' AND target_id = f.id) OR (target_type = 'drive' AND shared_by_user_id = f.owner_id) LIMIT 1) IS NOT NULL)) AS is_team_shared,
			       ((f.owner_id = ? AND (SELECT 1 FROM drive.share_links WHERE target_type = 'folder' AND target_id = f.id AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) LIMIT 1) IS NOT NULL)) AS has_share_link
			FROM folders f
			JOIN users u ON f.owner_id = u.id
			WHERE f.is_trashed = 0
			  AND LOWER(f.name) LIKE ?
			ORDER BY f.name ASC LIMIT 20
		`, claims.UserID, claims.UserID, pattern)
	} else {
		fRows, err = db.DB.Query(`
			SELECT f.id, f.name, f.parent_id, f.owner_id, u.name, u.email, f.is_starred, f.is_trashed, f.color, f.created_at, f.updated_at,
			       (SELECT COUNT(*) FROM files WHERE folder_id = f.id AND is_trashed = 0) +
			       (SELECT COUNT(*) FROM folders WHERE parent_id = f.id AND is_trashed = 0) AS item_count,
			       ((f.owner_id = ? AND (SELECT 1 FROM drive.team_shares WHERE (target_type = 'folder' AND target_id = f.id) OR (target_type = 'drive' AND shared_by_user_id = f.owner_id) LIMIT 1) IS NOT NULL)) AS is_team_shared,
			       ((f.owner_id = ? AND (SELECT 1 FROM drive.share_links WHERE target_type = 'folder' AND target_id = f.id AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) LIMIT 1) IS NOT NULL)) AS has_share_link
			FROM folders f
			JOIN users u ON f.owner_id = u.id
			WHERE (f.owner_id = ? OR f.id IN (SELECT target_id FROM shares WHERE target_type = 'folder' AND shared_with_user_id = ?))
			  AND f.is_trashed = 0
			  AND LOWER(f.name) LIKE ?
			ORDER BY f.name ASC LIMIT 20
		`, claims.UserID, claims.UserID, claims.UserID, claims.UserID, pattern)
	}

	folders := make([]models.Folder, 0)
	if err == nil {
		defer fRows.Close()
		for fRows.Next() {
			var f models.Folder
			var pID, col sql.NullString
			if err := fRows.Scan(
				&f.ID, &f.Name, &pID, &f.OwnerID, &f.OwnerName, &f.OwnerEmail,
				&f.IsStarred, &f.IsTrashed, &col, &f.CreatedAt, &f.UpdatedAt, &f.ItemCount,
				&f.IsTeamShared, &f.HasShareLink,
			); err == nil {
				if pID.Valid {
					f.ParentID = &pID.String
				}
				if col.Valid {
					f.Color = &col.String
				}
				folders = append(folders, f)
			}
		}
		if err := fRows.Err(); err != nil {
			_ = err
		}
	}

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"files":   files,
		"folders": folders,
	})
}

func isCodeExtension(ext string) bool {
	codeExts := map[string]bool{
		".go": true, ".js": true, ".jsx": true, ".ts": true, ".tsx": true,
		".py": true, ".java": true, ".c": true, ".cpp": true, ".h": true,
		".cs": true, ".rb": true, ".php": true, ".rs": true, ".swift": true,
		".html": true, ".css": true, ".scss": true, ".json": true, ".xml": true,
		".yaml": true, ".yml": true, ".sql": true, ".sh": true, ".bash": true,
		".md": true, ".env": true, ".dockerfile": true, ".gitignore": true,
	}
	return codeExts[strings.ToLower(ext)]
}

func isImageExtension(ext string) bool {
	exts := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true,
		".webp": true, ".svg": true, ".bmp": true, ".ico": true,
		".tiff": true, ".tif": true, ".avif": true, ".heic": true,
	}
	return exts[strings.ToLower(ext)]
}

func isVideoExtension(ext string) bool {
	exts := map[string]bool{
		".mp4": true, ".webm": true, ".mkv": true, ".avi": true,
		".mov": true, ".wmv": true, ".flv": true, ".m4v": true,
		".3gp": true, ".ogv": true, ".ts": true,
	}
	return exts[strings.ToLower(ext)]
}

func isAudioExtension(ext string) bool {
	exts := map[string]bool{
		".mp3": true, ".wav": true, ".ogg": true, ".flac": true,
		".aac": true, ".m4a": true, ".wma": true, ".opus": true,
	}
	return exts[strings.ToLower(ext)]
}

func isDocExtension(ext string) bool {
	exts := map[string]bool{
		".pdf": true, ".doc": true, ".docx": true, ".dot": true,
		".dotx": true, ".odt": true, ".rtf": true, ".txt": true,
		".pages": true, ".epub": true, ".xls": true, ".xlsx": true,
		".csv": true, ".tsv": true, ".ods": true, ".ppt": true,
		".pptx": true, ".odp": true,
	}
	return exts[strings.ToLower(ext)]
}

func isArchiveExtension(ext string) bool {
	exts := map[string]bool{
		".zip": true, ".tar": true, ".gz": true, ".tgz": true,
		".7z": true, ".rar": true, ".bz2": true, ".xz": true,
		".iso": true, ".dmg": true,
	}
	return exts[strings.ToLower(ext)]
}
