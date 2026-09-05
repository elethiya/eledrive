package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"strconv"
	"time"

	"eledrive/config"
	"eledrive/db"
	"eledrive/events"
	"eledrive/middleware"
	"eledrive/models"
	"eledrive/storage"
	"eledrive/utils"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type PublicShareHandler struct {
	cfg     *config.Config
	storage *storage.StorageService
}

func NewPublicShareHandler(cfg *config.Config, storage *storage.StorageService) *PublicShareHandler {
	return &PublicShareHandler{cfg: cfg, storage: storage}
}

type CreateShareLinkRequest struct {
	TargetType string  `json:"target_type"` // "folder" or "file"
	TargetID   string  `json:"target_id"`
	Permission string  `json:"permission"`   // "view" or "upload_and_view"
	Password   *string `json:"password,omitempty"`
	ExpireDays *int    `json:"expire_days,omitempty"`
}

func generateToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (h *PublicShareHandler) CreateLink(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	allowShares, requirePW, defaultExpiry := db.GetPublicSharingSettings()
	if !allowShares {
		utils.RespondError(w, http.StatusForbidden, "Public share links are currently disabled by administrator policy")
		return
	}

	var req CreateShareLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	req.TargetType = strings.ToLower(req.TargetType)
	if req.TargetType != "folder" && req.TargetType != "file" {
		utils.RespondError(w, http.StatusBadRequest, "Invalid target type")
		return
	}

	if req.Permission != "upload_and_view" {
		req.Permission = "view"
	}

	if requirePW && (req.Password == nil || strings.TrimSpace(*req.Password) == "") {
		utils.RespondError(w, http.StatusBadRequest, "A passcode is required on all public links by platform security policy")
		return
	}

	// Verify user is owner or editor
	if req.TargetType == "folder" {
		_, perm, err := CheckFolderAccess(claims.UserID, req.TargetID)
		if err != nil || (perm != "owner" && perm != "editor") {
			utils.RespondError(w, http.StatusForbidden, "No permission to create share link")
			return
		}
	} else {
		_, perm, err := CheckFileAccess(claims.UserID, req.TargetID)
		if err != nil || (perm != "owner" && perm != "editor") {
			utils.RespondError(w, http.StatusForbidden, "No permission to create share link")
			return
		}
		// File cannot have upload permission
		req.Permission = "view"
	}

	var passwordHash *string
	if req.Password != nil && strings.TrimSpace(*req.Password) != "" {
		h, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err == nil {
			str := string(h)
			passwordHash = &str
		}
	}

	var expiresAt *time.Time
	if req.ExpireDays != nil && *req.ExpireDays > 0 {
		exp := time.Now().AddDate(0, 0, *req.ExpireDays)
		expiresAt = &exp
	} else if (req.ExpireDays == nil || *req.ExpireDays == 0) && defaultExpiry > 0 {
		exp := time.Now().AddDate(0, 0, defaultExpiry)
		expiresAt = &exp
	}

	linkID := uuid.New().String()
	token := generateToken(16)
	now := time.Now()

	_, err := db.DB.Exec(`
		INSERT INTO share_links (id, token, target_type, target_id, created_by_user_id, permission, password_hash, expires_at, download_count, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
	`, linkID, token, req.TargetType, req.TargetID, claims.UserID, req.Permission, passwordHash, expiresAt, now)

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to create share link")
		return
	}

	shareURL := fmt.Sprintf("%s/share/%s", h.cfg.BaseURL, token)
	events.Broadcast("link:create", "link", "create", linkID, req.TargetID, claims.UserID, nil)

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"id":           linkID,
		"token":        token,
		"target_type":  req.TargetType,
		"target_id":    req.TargetID,
		"permission":   req.Permission,
		"has_password": passwordHash != nil,
		"expires_at":   expiresAt,
		"url":          shareURL,
	})
}

func (h *PublicShareHandler) GetTargetLink(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	targetType := r.URL.Query().Get("type")
	targetID := r.URL.Query().Get("id")

	if targetType == "" || targetID == "" {
		utils.RespondError(w, http.StatusBadRequest, "type and id are required")
		return
	}

	var link models.ShareLink
	var pwHash sql.NullString
	var expAt sql.NullTime

	err := db.DB.QueryRow(`
		SELECT id, token, target_type, target_id, created_by_user_id, permission, password_hash, expires_at, download_count, created_at
		FROM share_links
		WHERE target_type = ? AND target_id = ? AND created_by_user_id = ?
		ORDER BY created_at DESC LIMIT 1
	`, targetType, targetID, claims.UserID).Scan(
		&link.ID, &link.Token, &link.TargetType, &link.TargetID, &link.CreatedByUserID,
		&link.Permission, &pwHash, &expAt, &link.DownloadCount, &link.CreatedAt,
	)

	if err == sql.ErrNoRows {
		utils.RespondJSON(w, http.StatusOK, nil)
		return
	} else if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Database error")
		return
	}

	link.HasPassword = pwHash.Valid && pwHash.String != ""
	if expAt.Valid {
		link.ExpiresAt = &expAt.Time
	}

	shareURL := fmt.Sprintf("%s/share/%s", h.cfg.BaseURL, link.Token)

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"link": link,
		"url":  shareURL,
	})
}

func (h *PublicShareHandler) DeleteLink(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	linkID := chi.URLParam(r, "id")

	_, err := db.DB.Exec(`
		DELETE FROM share_links WHERE id = ? AND created_by_user_id = ?
	`, linkID, claims.UserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to delete share link")
		return
	}

	events.Broadcast("link:delete", "link", "delete", linkID, "", claims.UserID, nil)
	utils.RespondSuccess(w, http.StatusOK, "Share link deleted", nil)
}

// PUBLIC UNPROTECTED ENDPOINTS (Verified via token)

func (h *PublicShareHandler) GetPublicShareInfo(w http.ResponseWriter, r *http.Request) {
	allowShares, _, _ := db.GetPublicSharingSettings()
	if !allowShares {
		utils.RespondError(w, http.StatusForbidden, "Public share links are currently disabled by administrator policy")
		return
	}

	token := chi.URLParam(r, "token")
	var link models.ShareLink
	var pwHash sql.NullString
	var expAt sql.NullTime

	err := db.DB.QueryRow(`
		SELECT id, token, target_type, target_id, created_by_user_id, permission, password_hash, expires_at, download_count, created_at
		FROM share_links
		WHERE token = ?
	`, token).Scan(
		&link.ID, &link.Token, &link.TargetType, &link.TargetID, &link.CreatedByUserID,
		&link.Permission, &pwHash, &expAt, &link.DownloadCount, &link.CreatedAt,
	)

	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Share link not found or expired")
		return
	}

	if expAt.Valid && expAt.Time.Before(time.Now()) {
		utils.RespondError(w, http.StatusGone, "This share link has expired")
		return
	}

	link.HasPassword = pwHash.Valid

	// Check password if provided in header or query
	providedPw := r.Header.Get("X-Share-Password")
	if providedPw == "" {
		providedPw = r.URL.Query().Get("password")
	}

	if link.HasPassword {
		if providedPw == "" {
			utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
				"requires_password": true,
				"target_type":       link.TargetType,
			})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(pwHash.String), []byte(providedPw)); err != nil {
			utils.RespondError(w, http.StatusUnauthorized, "Incorrect password for this share link")
			return
		}
	}

	// If target is file
	if link.TargetType == "file" {
		var f models.File
		err := db.DB.QueryRow(`
			SELECT id, name, original_name, folder_id, owner_id, size, mime_type, extension, created_at, updated_at
			FROM files WHERE id = ? AND is_trashed = 0
		`, link.TargetID).Scan(
			&f.ID, &f.Name, &f.OriginalName, &f.FolderID, &f.OwnerID, &f.Size, &f.MimeType, &f.Extension, &f.CreatedAt, &f.UpdatedAt,
		)
		if err != nil {
			utils.RespondError(w, http.StatusNotFound, "Shared file not found")
			return
		}

		utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
			"requires_password": false,
			"target_type":       "file",
			"permission":        link.Permission,
			"file":              f,
		})
		return
	}

	// If target is folder
	var folder models.Folder
	err = db.DB.QueryRow(`
		SELECT id, name, parent_id, owner_id, color, created_at, updated_at
		FROM folders WHERE id = ? AND is_trashed = 0
	`, link.TargetID).Scan(
		&folder.ID, &folder.Name, &folder.ParentID, &folder.OwnerID, &folder.Color, &folder.CreatedAt, &folder.UpdatedAt,
	)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Shared folder not found")
		return
	}

	// Fetch files in this folder
	fileRows, err := db.DB.Query(`
		SELECT id, name, original_name, folder_id, owner_id, size, mime_type, extension, created_at, updated_at
		FROM files WHERE folder_id = ? AND is_trashed = 0
		ORDER BY name COLLATE NOCASE ASC
	`, folder.ID)

	files := make([]models.File, 0)
	if err == nil {
		defer fileRows.Close()
		for fileRows.Next() {
			var fl models.File
			var pID sql.NullString
			if err := fileRows.Scan(
				&fl.ID, &fl.Name, &fl.OriginalName, &pID, &fl.OwnerID, &fl.Size, &fl.MimeType, &fl.Extension, &fl.CreatedAt, &fl.UpdatedAt,
			); err == nil {
				if pID.Valid {
					fl.FolderID = &pID.String
				}
				files = append(files, fl)
			}
		}
		if err := fileRows.Err(); err != nil {
			_ = err
		}
	}

	// Fetch subfolders in this folder
	folderRows, err := db.DB.Query(`
		SELECT id, name, parent_id, owner_id, color, created_at, updated_at,
		       (SELECT COUNT(*) FROM files WHERE folder_id = f.id AND is_trashed = 0) +
		       (SELECT COUNT(*) FROM folders WHERE parent_id = f.id AND is_trashed = 0) AS item_count
		FROM folders f
		WHERE parent_id = ? AND is_trashed = 0
		ORDER BY name COLLATE NOCASE ASC
	`, folder.ID)

	subfolders := make([]models.Folder, 0)
	if err == nil {
		defer folderRows.Close()
		for folderRows.Next() {
			var sf models.Folder
			var pID, col sql.NullString
			if err := folderRows.Scan(
				&sf.ID, &sf.Name, &pID, &sf.OwnerID, &col, &sf.CreatedAt, &sf.UpdatedAt, &sf.ItemCount,
			); err == nil {
				if pID.Valid {
					sf.ParentID = &pID.String
				}
				if col.Valid {
					sf.Color = &col.String
				}
				subfolders = append(subfolders, sf)
			}
		}
		if err := folderRows.Err(); err != nil {
			_ = err
		}
	}

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"requires_password": false,
		"target_type":       "folder",
		"permission":        link.Permission,
		"folder":            folder,
		"subfolders":        subfolders,
		"files":             files,
	})
}

func (h *PublicShareHandler) DownloadPublic(w http.ResponseWriter, r *http.Request) {
	allowShares, _, _ := db.GetPublicSharingSettings()
	if !allowShares {
		utils.RespondError(w, http.StatusForbidden, "Public share links are currently disabled by administrator policy")
		return
	}

	token := chi.URLParam(r, "token")
	var link models.ShareLink
	var pwHash sql.NullString
	var expAt sql.NullTime

	err := db.DB.QueryRow(`
		SELECT id, token, target_type, target_id, created_by_user_id, permission, password_hash, expires_at, download_count
		FROM share_links
		WHERE token = ?
	`, token).Scan(
		&link.ID, &link.Token, &link.TargetType, &link.TargetID, &link.CreatedByUserID,
		&link.Permission, &pwHash, &expAt, &link.DownloadCount,
	)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Share link not found")
		return
	}

	if expAt.Valid && expAt.Time.Before(time.Now()) {
		utils.RespondError(w, http.StatusGone, "Share link has expired")
		return
	}

	// Increment download count
	_, _ = db.DB.Exec("UPDATE share_links SET download_count = download_count + 1 WHERE id = ?", link.ID)

	clientIP := utils.GetClientIP(r)
	userAgent := r.UserAgent()

	isInline := r.URL.Query().Get("inline") == "1"
	disposition := "attachment"
	accessType := "DIRECT_DOWNLOAD"
	dbAccessType := "download"
	if isInline {
		disposition = "inline"
		accessType = "BROWSER_VIEW"
		dbAccessType = "view"
	}

	if link.TargetType == "file" {
		var name, storagePath, mimeType, secretUUID, ownerID string
		var size int64
		var updatedAt time.Time
		err := db.DB.QueryRow("SELECT name, storage_path, mime_type, size, COALESCE(secret_uuid, ''), owner_id, updated_at FROM files WHERE id = ?", link.TargetID).
			Scan(&name, &storagePath, &mimeType, &size, &secretUUID, &ownerID, &updatedAt)
		if err != nil {
			utils.RespondError(w, http.StatusNotFound, "File not found")
			return
		}

		filePath := h.storage.GetFilePath(storagePath)
		file, err := os.Open(filePath)
		if err != nil {
			utils.RespondError(w, http.StatusNotFound, "Storage file missing")
			return
		}
		defer file.Close()

		if secretUUID == "" {
			secretUUID = utils.GenerateSecretUUID()
			_, _ = db.DB.Exec("UPDATE files SET secret_uuid = ? WHERE id = ?", secretUUID, link.TargetID)
		}

		guestName := fmt.Sprintf("Public Link Visitor (%s)", clientIP)
		guestEmail := fmt.Sprintf("token:%s", link.Token)

		_, trailerBytes := utils.BuildAccessForensicTrailer(
			secretUUID,
			ownerID,
			"Workspace User",
			"unknown@eledrive.local",
			"",
			"public_guest",
			guestName,
			guestEmail,
			"public_guest",
			accessType,
			clientIP,
			userAgent,
			name,
			h.cfg.JWTSecret,
		)

		watermarkedReader, err := utils.NewWatermarkedReadSeeker(file, trailerBytes)
		if err != nil {
			utils.RespondError(w, http.StatusInternalServerError, "Failed to stream watermarked asset")
			return
		}

		utils.LogDownloadEvent(db.DB, "file", link.TargetID, secretUUID, "public_guest", guestName, guestEmail, clientIP, userAgent, dbAccessType)

		w.Header().Set("Content-Disposition", fmt.Sprintf("%s; filename=\"%s\"", disposition, name))
		w.Header().Set("Content-Type", mimeType)
		http.ServeContent(w, r, name, updatedAt, watermarkedReader)
		return
	}

	// Target is folder: stream entire folder as ZIP!
	var folderName, secretUUID string
	err = db.DB.QueryRow("SELECT name, COALESCE(secret_uuid, '') FROM folders WHERE id = ?", link.TargetID).Scan(&folderName, &secretUUID)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Folder not found")
		return
	}

	if secretUUID == "" {
		secretUUID = utils.GenerateSecretUUID()
		_, _ = db.DB.Exec("UPDATE folders SET secret_uuid = ? WHERE id = ?", secretUUID, link.TargetID)
	}

	guestName := fmt.Sprintf("Public Link Visitor (%s)", clientIP)
	guestEmail := fmt.Sprintf("token:%s", link.Token)

	utils.LogDownloadEvent(db.DB, "folder", link.TargetID, secretUUID, "public_guest", guestName, guestEmail, clientIP, userAgent, "download")

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.zip\"", folderName))
	_ = h.storage.ZipFolder(link.TargetID, folderName, w, "public_guest", guestName, guestEmail, "public_guest", clientIP, userAgent)
}

// UploadPublic allows team members or guests to upload files directly into a shared folder if permission is upload_and_view
func (h *PublicShareHandler) UploadPublic(w http.ResponseWriter, r *http.Request) {
	allowShares, _, _ := db.GetPublicSharingSettings()
	if !allowShares {
		utils.RespondError(w, http.StatusForbidden, "Public share links are currently disabled by administrator policy")
		return
	}

	token := chi.URLParam(r, "token")
	var link models.ShareLink
	var expAt sql.NullTime

	err := db.DB.QueryRow(`
		SELECT id, token, target_type, target_id, created_by_user_id, permission, expires_at
		FROM share_links
		WHERE token = ?
	`, token).Scan(
		&link.ID, &link.Token, &link.TargetType, &link.TargetID, &link.CreatedByUserID,
		&link.Permission, &expAt,
	)
	if err != nil || link.TargetType != "folder" {
		utils.RespondError(w, http.StatusNotFound, "Invalid share link for upload")
		return
	}

	if link.Permission != "upload_and_view" {
		utils.RespondError(w, http.StatusForbidden, "This share link is view-only")
		return
	}

	if expAt.Valid && expAt.Time.Before(time.Now()) {
		utils.RespondError(w, http.StatusGone, "Share link has expired")
		return
	}

	err = r.ParseMultipartForm(h.cfg.MaxUploadSize)
	if err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Failed to parse upload")
		return
	}

	form := r.MultipartForm
	filesHeader := form.File["files"]
	if len(filesHeader) == 0 {
		filesHeader = form.File["file"]
	}
	if len(filesHeader) == 0 {
		utils.RespondError(w, http.StatusBadRequest, "No files uploaded")
		return
	}

	targetFolderID := link.TargetID
	targetOwnerID := link.CreatedByUserID

	uploadedFiles := make([]models.File, 0)
	now := time.Now()

	for _, fh := range filesHeader {
		src, err := fh.Open()
		if err != nil {
			continue
		}

		diskName, written, err := h.storage.SaveUploadedFile(src, fh.Filename)
		src.Close()
		if err != nil {
			continue
		}

		fileID := uuid.New().String()
		ext := filepath.Ext(fh.Filename)
		mimeType := utils.DetectMimeType(fh.Filename)

		_, err = db.DB.Exec(`
			INSERT INTO files (id, name, original_name, folder_id, owner_id, storage_path, size, mime_type, extension, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, fileID, fh.Filename, fh.Filename, targetFolderID, targetOwnerID, diskName, written, mimeType, ext, now, now)

		if err != nil {
			_ = h.storage.DeleteFile(diskName)
			continue
		}

		uploadedFiles = append(uploadedFiles, models.File{
			ID:           fileID,
			Name:         fh.Filename,
			OriginalName: fh.Filename,
			FolderID:     &targetFolderID,
			OwnerID:      targetOwnerID,
			Size:         written,
			MimeType:     mimeType,
			Extension:    ext,
			CreatedAt:    now,
			UpdatedAt:    now,
		})
	}

	_, _ = h.storage.UpdateUserStorage(targetOwnerID)

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"count": len(uploadedFiles),
		"files": uploadedFiles,
	})
}

func (h *PublicShareHandler) UploadPublicChunk(w http.ResponseWriter, r *http.Request) {
	allowShares, _, _ := db.GetPublicSharingSettings()
	if !allowShares {
		utils.RespondError(w, http.StatusForbidden, "Public share links are currently disabled")
		return
	}

	token := chi.URLParam(r, "token")
	var permission string
	var expAt sql.NullTime

	err := db.DB.QueryRow(`
		SELECT permission, expires_at FROM share_links WHERE token = ?
	`, token).Scan(&permission, &expAt)
	
	if err != nil || permission != "upload_and_view" {
		utils.RespondError(w, http.StatusForbidden, "Invalid share link or view-only")
		return
	}
	if expAt.Valid && expAt.Time.Before(time.Now()) {
		utils.RespondError(w, http.StatusGone, "Share link has expired")
		return
	}

	err = r.ParseMultipartForm(50 << 20) // 50MB
	if err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Failed to parse chunk upload")
		return
	}

	uploadID := r.FormValue("upload_id")
	chunkIndexStr := r.FormValue("chunk_index")
	
	if uploadID == "" || chunkIndexStr == "" {
		utils.RespondError(w, http.StatusBadRequest, "Missing upload_id or chunk_index")
		return
	}

	chunkIndex, err := strconv.Atoi(chunkIndexStr)
	if err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid chunk_index")
		return
	}

	file, _, err := r.FormFile("chunk")
	if err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Missing chunk file")
		return
	}
	defer file.Close()

	if err := h.storage.SaveChunk(uploadID, chunkIndex, file); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to save chunk")
		return
	}

	utils.RespondSuccess(w, http.StatusOK, "Chunk uploaded", nil)
}

func (h *PublicShareHandler) UploadPublicFinalize(w http.ResponseWriter, r *http.Request) {
	allowShares, _, _ := db.GetPublicSharingSettings()
	if !allowShares {
		utils.RespondError(w, http.StatusForbidden, "Public share links are currently disabled")
		return
	}

	token := chi.URLParam(r, "token")
	var link models.ShareLink
	var expAt sql.NullTime

	err := db.DB.QueryRow(`
		SELECT id, token, target_type, target_id, created_by_user_id, permission, expires_at
		FROM share_links
		WHERE token = ?
	`, token).Scan(
		&link.ID, &link.Token, &link.TargetType, &link.TargetID, &link.CreatedByUserID,
		&link.Permission, &expAt,
	)
	if err != nil || link.TargetType != "folder" || link.Permission != "upload_and_view" {
		utils.RespondError(w, http.StatusForbidden, "Invalid share link for upload")
		return
	}
	if expAt.Valid && expAt.Time.Before(time.Now()) {
		utils.RespondError(w, http.StatusGone, "Share link has expired")
		return
	}

	var req struct {
		UploadID     string `json:"upload_id"`
		Filename     string `json:"filename"`
		TotalChunks  int    `json:"total_chunks"`
		TotalSize    int64  `json:"total_size"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	targetFolderID := link.TargetID
	targetOwnerID := link.CreatedByUserID

	diskName, writtenBytes, err := h.storage.MergeChunks(req.UploadID, req.TotalChunks, req.Filename)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to merge chunks")
		return
	}

	ext := filepath.Ext(req.Filename)
	mimeType := utils.DetectMimeType(req.Filename)
	fileID := uuid.New().String()
	now := time.Now()

	_, err = db.DB.Exec(`
		INSERT INTO files (id, name, original_name, folder_id, owner_id, storage_path, size, mime_type, extension, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, fileID, req.Filename, req.Filename, targetFolderID, targetOwnerID, diskName, writtenBytes, mimeType, ext, now, now)

	if err != nil {
		_ = h.storage.DeleteFile(diskName)
		utils.RespondError(w, http.StatusInternalServerError, "Failed to save file to database")
		return
	}

	_, _ = h.storage.UpdateUserStorage(targetOwnerID)

	fileObj := models.File{
		ID:           fileID,
		Name:         req.Filename,
		OriginalName: req.Filename,
		FolderID:     &targetFolderID,
		OwnerID:      targetOwnerID,
		Size:         writtenBytes,
		MimeType:     mimeType,
		Extension:    ext,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"file": fileObj,
	})
}
