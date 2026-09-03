package handlers

import (
	"database/sql"
	"encoding/json"
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

type ShareHandler struct {
	cfg     *config.Config
	storage *storage.StorageService
}

func NewShareHandler(cfg *config.Config, storage *storage.StorageService) *ShareHandler {
	return &ShareHandler{cfg: cfg, storage: storage}
}

type CreateShareRequest struct {
	TargetType  string `json:"target_type"` // "folder" or "file"
	TargetID    string `json:"target_id"`
	UserEmail   string `json:"user_email"`
	UserID      string `json:"user_id"`
	Permission  string `json:"permission"`  // "viewer" or "editor"
}

func (h *ShareHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	var req CreateShareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	req.TargetType = strings.ToLower(req.TargetType)
	if req.TargetType != "folder" && req.TargetType != "file" {
		utils.RespondError(w, http.StatusBadRequest, "Invalid target type")
		return
	}

	if req.Permission != "viewer" && req.Permission != "editor" {
		req.Permission = "viewer"
	}

	// Verify that current user owns or has editor permission on the target
	var ownerID string
	if req.TargetType == "folder" {
		f, perm, err := CheckFolderAccess(claims.UserID, req.TargetID)
		if err != nil || (perm != "owner" && perm != "editor") {
			utils.RespondError(w, http.StatusForbidden, "No permission to share this folder")
			return
		}
		ownerID = f.OwnerID
	} else {
		f, perm, err := CheckFileAccess(claims.UserID, req.TargetID)
		if err != nil || (perm != "owner" && perm != "editor") {
			utils.RespondError(w, http.StatusForbidden, "No permission to share this file")
			return
		}
		ownerID = f.OwnerID
	}
	_ = ownerID

	// Resolve target recipient user
	var targetUser models.UserPublic
	var err error
	if req.UserID != "" {
		err = db.DB.QueryRow("SELECT id, email, username, name, avatar_color FROM users WHERE id = ?", req.UserID).
			Scan(&targetUser.ID, &targetUser.Email, &targetUser.Username, &targetUser.Name, &targetUser.AvatarColor)
	} else if req.UserEmail != "" {
		err = db.DB.QueryRow("SELECT id, email, username, name, avatar_color FROM users WHERE LOWER(email) = ?", strings.ToLower(strings.TrimSpace(req.UserEmail))).
			Scan(&targetUser.ID, &targetUser.Email, &targetUser.Username, &targetUser.Name, &targetUser.AvatarColor)
	} else {
		utils.RespondError(w, http.StatusBadRequest, "Recipient user ID or email is required")
		return
	}

	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Target user not found")
		return
	}

	if targetUser.ID == claims.UserID {
		utils.RespondError(w, http.StatusBadRequest, "Cannot share with yourself")
		return
	}

	shareID := uuid.New().String()
	now := time.Now()

	// Insert or update existing share
	_, err = db.DB.Exec(`
		INSERT INTO shares (id, target_type, target_id, shared_by_user_id, shared_with_user_id, permission, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(target_type, target_id, shared_with_user_id) 
		DO UPDATE SET permission = excluded.permission
	`, shareID, req.TargetType, req.TargetID, claims.UserID, targetUser.ID, req.Permission, now)

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to create share")
		return
	}

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"id":          shareID,
		"target_type": req.TargetType,
		"target_id":   req.TargetID,
		"permission":  req.Permission,
		"shared_with": targetUser,
	})
}

// GetSharedWithMe lists all files and folders directly shared with current user
func (h *ShareHandler) GetSharedWithMe(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	// Shared folders
	folderRows, err := db.DB.Query(`
		SELECT f.id, f.name, f.parent_id, f.owner_id, u.name, u.email, f.is_starred, f.is_trashed, f.color, f.created_at, f.updated_at,
		       s.permission,
		       (SELECT COUNT(*) FROM files WHERE folder_id = f.id AND is_trashed = 0) +
		       (SELECT COUNT(*) FROM folders WHERE parent_id = f.id AND is_trashed = 0) AS item_count
		FROM shares s
		JOIN folders f ON s.target_id = f.id
		JOIN users u ON f.owner_id = u.id
		WHERE s.target_type = 'folder' AND s.shared_with_user_id = ? AND f.is_trashed = 0
		ORDER BY s.created_at DESC
	`, claims.UserID)

	folders := make([]models.Folder, 0)
	if err == nil {
		defer folderRows.Close()
		for folderRows.Next() {
			var f models.Folder
			var pID, col sql.NullString
			var perm string
			if err := folderRows.Scan(
				&f.ID, &f.Name, &pID, &f.OwnerID, &f.OwnerName, &f.OwnerEmail,
				&f.IsStarred, &f.IsTrashed, &col, &f.CreatedAt, &f.UpdatedAt,
				&perm, &f.ItemCount,
			); err == nil {
				if pID.Valid {
					f.ParentID = &pID.String
				}
				if col.Valid {
					f.Color = &col.String
				}
				f.SharedPermission = &perm
				folders = append(folders, f)
			}
		}
	}

	// Shared files
	fileRows, err := db.DB.Query(`
		SELECT f.id, f.name, f.original_name, f.folder_id, f.owner_id, u.name, u.email,
		       f.size, f.mime_type, f.extension, f.is_starred, f.is_trashed, f.created_at, f.updated_at,
		       s.permission
		FROM shares s
		JOIN files f ON s.target_id = f.id
		JOIN users u ON f.owner_id = u.id
		WHERE s.target_type = 'file' AND s.shared_with_user_id = ? AND f.is_trashed = 0
		ORDER BY s.created_at DESC
	`, claims.UserID)

	files := make([]models.File, 0)
	if err == nil {
		defer fileRows.Close()
		for fileRows.Next() {
			var f models.File
			var pID sql.NullString
			var perm string
			if err := fileRows.Scan(
				&f.ID, &f.Name, &f.OriginalName, &pID, &f.OwnerID, &f.OwnerName, &f.OwnerEmail,
				&f.Size, &f.MimeType, &f.Extension, &f.IsStarred, &f.IsTrashed, &f.CreatedAt, &f.UpdatedAt,
				&perm,
			); err == nil {
				if pID.Valid {
					f.FolderID = &pID.String
				}
				f.SharedPermission = &perm
				files = append(files, f)
			}
		}
	}

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"folders": folders,
		"files":   files,
	})
}

// GetTargetShares returns list of users who have access to target folder or file
func (h *ShareHandler) GetTargetShares(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	targetType := r.URL.Query().Get("type")
	targetID := r.URL.Query().Get("id")

	if targetType == "" || targetID == "" {
		utils.RespondError(w, http.StatusBadRequest, "type and id are required")
		return
	}

	// Check access
	if targetType == "folder" {
		_, perm, err := CheckFolderAccess(claims.UserID, targetID)
		if err != nil || (perm != "owner" && perm != "editor") {
			utils.RespondError(w, http.StatusForbidden, "Access denied")
			return
		}
	} else {
		_, perm, err := CheckFileAccess(claims.UserID, targetID)
		if err != nil || (perm != "owner" && perm != "editor") {
			utils.RespondError(w, http.StatusForbidden, "Access denied")
			return
		}
	}

	rows, err := db.DB.Query(`
		SELECT s.id, s.target_type, s.target_id, s.shared_by_user_id, s.shared_with_user_id, s.permission, s.created_at,
		       u.id, u.email, u.username, u.name, u.avatar_color
		FROM shares s
		JOIN users u ON s.shared_with_user_id = u.id
		WHERE s.target_type = ? AND s.target_id = ?
		ORDER BY s.created_at ASC
	`, targetType, targetID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer rows.Close()

	shares := make([]models.Share, 0)
	for rows.Next() {
		var s models.Share
		var u models.UserPublic
		if err := rows.Scan(
			&s.ID, &s.TargetType, &s.TargetID, &s.SharedByUserID, &s.SharedWithUserID, &s.Permission, &s.CreatedAt,
			&u.ID, &u.Email, &u.Username, &u.Name, &u.AvatarColor,
		); err == nil {
			s.SharedWith = &u
			shares = append(shares, s)
		}
	}

	utils.RespondJSON(w, http.StatusOK, shares)
}

func (h *ShareHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	shareID := chi.URLParam(r, "id")

	// Must be creator or recipient
	var sharedBy, sharedWith string
	err := db.DB.QueryRow("SELECT shared_by_user_id, shared_with_user_id FROM shares WHERE id = ?", shareID).Scan(&sharedBy, &sharedWith)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Share not found")
		return
	}

	if sharedBy != claims.UserID && sharedWith != claims.UserID {
		utils.RespondError(w, http.StatusForbidden, "No permission to revoke share")
		return
	}

	_, err = db.DB.Exec("DELETE FROM shares WHERE id = ?", shareID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to remove share")
		return
	}

	utils.RespondSuccess(w, http.StatusOK, "Share removed successfully", nil)
}
