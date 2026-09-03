package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"eledrive/config"
	"eledrive/db"
	"eledrive/middleware"
	"eledrive/models"
	"eledrive/storage"
	"eledrive/utils"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type FolderHandler struct {
	cfg     *config.Config
	storage *storage.StorageService
}

func NewFolderHandler(cfg *config.Config, storage *storage.StorageService) *FolderHandler {
	return &FolderHandler{cfg: cfg, storage: storage}
}

type CreateFolderRequest struct {
	Name     string  `json:"name"`
	ParentID *string `json:"parent_id"`
	Color    *string `json:"color"`
}

type UpdateFolderRequest struct {
	Name  *string `json:"name"`
	Color *string `json:"color"`
}

type MoveFolderRequest struct {
	TargetParentID *string `json:"target_parent_id"`
}

// CheckFolderAccess verifies user has access to folder. Returns folder, permission ("owner", "editor", "viewer"), error
func CheckFolderAccess(userID string, folderID string) (*models.Folder, string, error) {
	var f models.Folder
	var parentID sql.NullString
	var color sql.NullString
	var trashedAt sql.NullTime
	var secretUUID sql.NullString

	err := db.DB.QueryRow(`
		SELECT f.id, f.name, f.parent_id, f.owner_id, u.name, u.email, f.is_starred, f.is_trashed, f.trashed_at, f.color, COALESCE(f.secret_uuid, ''), f.created_at, f.updated_at
		FROM folders f
		JOIN users u ON f.owner_id = u.id
		WHERE f.id = ?
	`, folderID).Scan(
		&f.ID, &f.Name, &parentID, &f.OwnerID, &f.OwnerName, &f.OwnerEmail,
		&f.IsStarred, &f.IsTrashed, &trashedAt, &color, &secretUUID, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		return nil, "", err
	}

	if secretUUID.Valid {
		f.SecretUUID = secretUUID.String
	}
	if parentID.Valid {
		f.ParentID = &parentID.String
	}
	if color.Valid {
		f.Color = &color.String
	}
	if trashedAt.Valid {
		f.TrashedAt = &trashedAt.Time
	}

	if f.OwnerID == userID {
		return &f, "owner", nil
	}

	// Check direct share
	var permission string
	err = db.DB.QueryRow(`
		SELECT permission FROM shares 
		WHERE target_type = 'folder' AND target_id = ? AND shared_with_user_id = ?
	`, folderID, userID).Scan(&permission)
	if err == nil {
		return &f, permission, nil
	}

	// Check recursive parent share
	currParent := f.ParentID
	for currParent != nil {
		var pPerm string
		var pParent sql.NullString
		err := db.DB.QueryRow(`
			SELECT s.permission, f.parent_id
			FROM folders f
			LEFT JOIN shares s ON s.target_type = 'folder' AND s.target_id = f.id AND s.shared_with_user_id = ?
			WHERE f.id = ?
		`, userID, *currParent).Scan(&pPerm, &pParent)
		if err == nil && pPerm != "" {
			return &f, pPerm, nil
		}
		if pParent.Valid {
			currParent = &pParent.String
		} else {
			currParent = nil
		}
	}

	return nil, "", fmt.Errorf("access denied")
}

// GetContents returns folders and files for a folder (or root if folder_id is empty)
func (h *FolderHandler) GetContents(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	folderID := r.URL.Query().Get("folder_id")

	var currentFolder *models.Folder
	permission := "owner"
	breadcrumbs := []models.Breadcrumb{
		{ID: "", Name: "My Drive"},
	}

	if folderID != "" {
		f, perm, err := CheckFolderAccess(claims.UserID, folderID)
		if err != nil {
			utils.RespondError(w, http.StatusForbidden, "Access denied or folder not found")
			return
		}
		currentFolder = f
		permission = perm

		// Build breadcrumbs
		chain := []models.Breadcrumb{{ID: f.ID, Name: f.Name}}
		curr := f.ParentID
		for curr != nil {
			var pName string
			var nextParent sql.NullString
			err := db.DB.QueryRow("SELECT name, parent_id FROM folders WHERE id = ?", *curr).Scan(&pName, &nextParent)
			if err != nil {
				break
			}
			chain = append([]models.Breadcrumb{{ID: *curr, Name: pName}}, chain...)
			if nextParent.Valid {
				curr = &nextParent.String
			} else {
				curr = nil
			}
		}

		if perm == "owner" {
			breadcrumbs = append(breadcrumbs, chain...)
		} else {
			// In shared view
			breadcrumbs = append([]models.Breadcrumb{{ID: "shared", Name: "Shared with me"}}, chain...)
		}
	}

	// Query subfolders
	subfolders := make([]models.Folder, 0)
	var folderRows *sql.Rows
	var err error

	if folderID == "" {
		// Root folder: owner_id = claims.UserID AND parent_id IS NULL AND is_trashed = 0
		folderRows, err = db.DB.Query(`
			SELECT f.id, f.name, f.parent_id, f.owner_id, u.name, u.email, f.is_starred, f.is_trashed, f.color, f.created_at, f.updated_at,
			       (SELECT COUNT(*) FROM files WHERE folder_id = f.id AND is_trashed = 0) +
			       (SELECT COUNT(*) FROM folders WHERE parent_id = f.id AND is_trashed = 0) AS item_count
			FROM folders f
			JOIN users u ON f.owner_id = u.id
			WHERE f.owner_id = ? AND f.parent_id IS NULL AND f.is_trashed = 0
			ORDER BY f.name COLLATE NOCASE ASC
		`, claims.UserID)
	} else {
		folderRows, err = db.DB.Query(`
			SELECT f.id, f.name, f.parent_id, f.owner_id, u.name, u.email, f.is_starred, f.is_trashed, f.color, f.created_at, f.updated_at,
			       (SELECT COUNT(*) FROM files WHERE folder_id = f.id AND is_trashed = 0) +
			       (SELECT COUNT(*) FROM folders WHERE parent_id = f.id AND is_trashed = 0) AS item_count
			FROM folders f
			JOIN users u ON f.owner_id = u.id
			WHERE f.parent_id = ? AND f.is_trashed = 0
			ORDER BY f.name COLLATE NOCASE ASC
		`, folderID)
	}

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to load folders")
		return
	}
	defer folderRows.Close()

	for folderRows.Next() {
		var f models.Folder
		var pID, col sql.NullString
		if err := folderRows.Scan(
			&f.ID, &f.Name, &pID, &f.OwnerID, &f.OwnerName, &f.OwnerEmail,
			&f.IsStarred, &f.IsTrashed, &col, &f.CreatedAt, &f.UpdatedAt, &f.ItemCount,
		); err == nil {
			if pID.Valid {
				f.ParentID = &pID.String
			}
			if col.Valid {
				f.Color = &col.String
			}
			subfolders = append(subfolders, f)
		}
	}

	// Query files
	files := make([]models.File, 0)
	var fileRows *sql.Rows

	if folderID == "" {
		fileRows, err = db.DB.Query(`
			SELECT f.id, f.name, f.original_name, f.folder_id, f.owner_id, u.name, u.email,
			       f.size, f.mime_type, f.extension, f.is_starred, f.is_trashed, f.created_at, f.updated_at
			FROM files f
			JOIN users u ON f.owner_id = u.id
			WHERE f.owner_id = ? AND f.folder_id IS NULL AND f.is_trashed = 0
			ORDER BY f.name COLLATE NOCASE ASC
		`, claims.UserID)
	} else {
		fileRows, err = db.DB.Query(`
			SELECT f.id, f.name, f.original_name, f.folder_id, f.owner_id, u.name, u.email,
			       f.size, f.mime_type, f.extension, f.is_starred, f.is_trashed, f.created_at, f.updated_at
			FROM files f
			JOIN users u ON f.owner_id = u.id
			WHERE f.folder_id = ? AND f.is_trashed = 0
			ORDER BY f.name COLLATE NOCASE ASC
		`, folderID)
	}

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to load files")
		return
	}
	defer fileRows.Close()

	for fileRows.Next() {
		var f models.File
		var fID sql.NullString
		if err := fileRows.Scan(
			&f.ID, &f.Name, &f.OriginalName, &fID, &f.OwnerID, &f.OwnerName, &f.OwnerEmail,
			&f.Size, &f.MimeType, &f.Extension, &f.IsStarred, &f.IsTrashed, &f.CreatedAt, &f.UpdatedAt,
		); err == nil {
			if fID.Valid {
				f.FolderID = &fID.String
			}
			files = append(files, f)
		}
	}

	resp := models.FolderContentsResponse{
		Folder:      currentFolder,
		Breadcrumbs: breadcrumbs,
		Subfolders:  subfolders,
		Files:       files,
		Permission:  permission,
	}

	utils.RespondJSON(w, http.StatusOK, resp)
}

func (h *FolderHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	var req CreateFolderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		utils.RespondError(w, http.StatusBadRequest, "Folder name cannot be empty")
		return
	}

	// Verify parent access if provided
	ownerID := claims.UserID
	if req.ParentID != nil && *req.ParentID != "" {
		parent, perm, err := CheckFolderAccess(claims.UserID, *req.ParentID)
		if err != nil || (perm != "owner" && perm != "editor") {
			utils.RespondError(w, http.StatusForbidden, "No permission to create folder here")
			return
		}
		// Inherit owner from parent folder if inside shared tree
		ownerID = parent.OwnerID
	}

	folderID := uuid.New().String()
	secretUUID := utils.GenerateSecretUUID()
	now := time.Now()

	_, err := db.DB.Exec(`
		INSERT INTO folders (id, name, parent_id, owner_id, color, secret_uuid, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, folderID, req.Name, req.ParentID, ownerID, req.Color, secretUUID, now, now)

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to create folder")
		return
	}

	folder := models.Folder{
		ID:         folderID,
		Name:       req.Name,
		ParentID:   req.ParentID,
		OwnerID:    ownerID,
		Color:      req.Color,
		SecretUUID: secretUUID,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	db.LogActivity(claims.UserID, claims.Username, "create_folder", "folder", folderID, req.Name, fmt.Sprintf("Created folder '%s' [Secret UUID: %s]", req.Name, secretUUID))

	utils.RespondJSON(w, http.StatusCreated, folder)
}

func (h *FolderHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	folderID := chi.URLParam(r, "id")

	f, perm, err := CheckFolderAccess(claims.UserID, folderID)
	if err != nil || (perm != "owner" && perm != "editor") {
		utils.RespondError(w, http.StatusForbidden, "No permission to modify this folder")
		return
	}

	var req UpdateFolderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.Name != nil {
		cleanName := strings.TrimSpace(*req.Name)
		if cleanName == "" {
			utils.RespondError(w, http.StatusBadRequest, "Folder name cannot be empty")
			return
		}
		f.Name = cleanName
	}

	if req.Color != nil {
		f.Color = req.Color
	}

	_, err = db.DB.Exec(`
		UPDATE folders 
		SET name = ?, color = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`, f.Name, f.Color, folderID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update folder")
		return
	}

	utils.RespondJSON(w, http.StatusOK, f)
}

func (h *FolderHandler) ToggleStar(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	folderID := chi.URLParam(r, "id")

	f, _, err := CheckFolderAccess(claims.UserID, folderID)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Folder not found")
		return
	}

	newStarred := !f.IsStarred
	_, err = db.DB.Exec("UPDATE folders SET is_starred = ? WHERE id = ?", newStarred, folderID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update star")
		return
	}

	utils.RespondSuccess(w, http.StatusOK, "Updated", map[string]interface{}{
		"id":         folderID,
		"is_starred": newStarred,
	})
}

func (h *FolderHandler) Move(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	folderID := chi.URLParam(r, "id")

	_, perm, err := CheckFolderAccess(claims.UserID, folderID)
	if err != nil || (perm != "owner" && perm != "editor") {
		utils.RespondError(w, http.StatusForbidden, "No permission to move folder")
		return
	}

	var req MoveFolderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	// Cannot move folder into itself
	if req.TargetParentID != nil && *req.TargetParentID == folderID {
		utils.RespondError(w, http.StatusBadRequest, "Cannot move a folder into itself")
		return
	}

	if req.TargetParentID != nil && *req.TargetParentID != "" {
		_, targetPerm, err := CheckFolderAccess(claims.UserID, *req.TargetParentID)
		if err != nil || (targetPerm != "owner" && targetPerm != "editor") {
			utils.RespondError(w, http.StatusForbidden, "No permission to move into target folder")
			return
		}
	}

	_, err = db.DB.Exec("UPDATE folders SET parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", req.TargetParentID, folderID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to move folder")
		return
	}

	utils.RespondSuccess(w, http.StatusOK, "Folder moved successfully", nil)
}

func (h *FolderHandler) Trash(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	folderID := chi.URLParam(r, "id")

	_, perm, err := CheckFolderAccess(claims.UserID, folderID)
	if err != nil || (perm != "owner" && perm != "editor") {
		utils.RespondError(w, http.StatusForbidden, "No permission to delete folder")
		return
	}

	now := time.Now()
	_, err = db.DB.Exec(`
		UPDATE folders 
		SET is_trashed = 1, trashed_at = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`, now, folderID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to move folder to trash")
		return
	}

	utils.RespondSuccess(w, http.StatusOK, "Folder moved to trash", nil)
}

func (h *FolderHandler) Restore(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	folderID := chi.URLParam(r, "id")

	// Restore only if owner
	_, err := db.DB.Exec(`
		UPDATE folders 
		SET is_trashed = 0, trashed_at = NULL, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ? AND owner_id = ?
	`, folderID, claims.UserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to restore folder")
		return
	}

	utils.RespondSuccess(w, http.StatusOK, "Folder restored", nil)
}

func (h *FolderHandler) PermanentDelete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	folderID := chi.URLParam(r, "id")

	// Must be owner
	var ownerID string
	err := db.DB.QueryRow("SELECT owner_id FROM folders WHERE id = ?", folderID).Scan(&ownerID)
	if err != nil || ownerID != claims.UserID {
		utils.RespondError(w, http.StatusForbidden, "No permission to delete folder")
		return
	}

	// Delete from DB (cascade deletes children and shares)
	_, err = db.DB.Exec("DELETE FROM folders WHERE id = ?", folderID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to delete folder")
		return
	}

	_, _ = h.storage.UpdateUserStorage(claims.UserID)
	utils.RespondSuccess(w, http.StatusOK, "Folder permanently deleted", nil)
}

func (h *FolderHandler) DownloadZip(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	folderID := chi.URLParam(r, "id")

	f, _, err := CheckFolderAccess(claims.UserID, folderID)
	if err != nil {
		utils.RespondError(w, http.StatusForbidden, "Access denied")
		return
	}

	zipFilename := fmt.Sprintf("%s.zip", f.Name)
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", zipFilename))

	utils.LogDownloadEvent(db.DB, "folder", folderID, f.SecretUUID, claims.UserID, claims.Username, claims.Email, r.RemoteAddr, r.UserAgent())
	db.LogActivity(claims.UserID, claims.Username, "download", "folder", folderID, f.Name, fmt.Sprintf("Downloaded folder ZIP archive [Secret UUID: %s]", f.SecretUUID))

	err = h.storage.ZipFolder(folderID, f.Name, w)
	if err != nil {
		// Cannot change headers once streaming starts, but logged
		return
	}
}
