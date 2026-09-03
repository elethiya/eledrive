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

type ShareHandler struct {
	cfg     *config.Config
	storage *storage.StorageService
}

func NewShareHandler(cfg *config.Config, storage *storage.StorageService) *ShareHandler {
	return &ShareHandler{cfg: cfg, storage: storage}
}

type CreateShareRequest struct {
	TargetType  string `json:"target_type"` // "folder", "file", or "drive"
	TargetID    string `json:"target_id"`
	TeamID      string `json:"team_id"`
	UserEmail   string `json:"user_email"`
	UserID      string `json:"user_id"`
	Permission  string `json:"permission"`  // "viewer" or "editor"
}

func (h *ShareHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	var req CreateShareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	req.TargetType = strings.ToLower(strings.TrimSpace(req.TargetType))
	if req.TargetType != "folder" && req.TargetType != "file" && req.TargetType != "drive" {
		utils.RespondError(w, http.StatusBadRequest, "Invalid target type (must be folder, file, or drive)")
		return
	}

	if req.Permission != "viewer" && req.Permission != "editor" {
		req.Permission = "viewer"
	}

	// Verify permissions on target
	if req.TargetType == "drive" {
		req.TargetID = claims.UserID
	} else if req.TargetType == "folder" {
		_, perm, err := CheckFolderAccess(claims.UserID, req.TargetID)
		if err != nil || (perm != "owner" && perm != "editor") {
			utils.RespondError(w, http.StatusForbidden, "No permission to share this folder")
			return
		}
	} else if req.TargetType == "file" {
		_, perm, err := CheckFileAccess(claims.UserID, req.TargetID)
		if err != nil || (perm != "owner" && perm != "editor") {
			utils.RespondError(w, http.StatusForbidden, "No permission to share this file")
			return
		}
	}

	now := time.Now().UTC().Truncate(time.Second)
	nowStr := now.Format("2006-01-02 15:04:05")

	// Case 1: Share with a Team
	if req.TeamID != "" {
		var team models.Team
		err := db.DB.QueryRow("SELECT id, name, avatar_color FROM main.teams WHERE id = ?", req.TeamID).
			Scan(&team.ID, &team.Name, &team.AvatarColor)
		if err != nil {
			utils.RespondError(w, http.StatusNotFound, "Team not found")
			return
		}

		// Insert/Update team_shares
		teamShareID := uuid.New().String()
		_, err = db.DB.Exec(`
			INSERT INTO drive.team_shares (id, team_id, target_type, target_id, shared_by_user_id, permission, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(team_id, target_type, target_id)
			DO UPDATE SET permission = excluded.permission
		`, teamShareID, req.TeamID, req.TargetType, req.TargetID, claims.UserID, req.Permission, nowStr)
		if err != nil {
			utils.RespondError(w, http.StatusInternalServerError, "Failed to record team share")
			return
		}

		// Fetch all member IDs into slice first, then close rows immediately to prevent connection deadlock!
		var memberIDs []string
		memberRows, err := db.DB.Query(`
			SELECT user_id FROM main.team_members WHERE team_id = ? AND user_id != ?
		`, req.TeamID, claims.UserID)
		if err == nil {
			for memberRows.Next() {
				var mUID string
				if err := memberRows.Scan(&mUID); err == nil {
					memberIDs = append(memberIDs, mUID)
				}
			}
			memberRows.Close()
		}

		// Now safely execute inserts without holding an active rows cursor
		for _, mUID := range memberIDs {
			if req.TargetType == "drive" {
				// Share all root folders and files
				_, _ = db.DB.Exec(`
					INSERT INTO drive.shares (id, target_type, target_id, shared_by_user_id, shared_with_user_id, permission, created_at)
					SELECT LOWER(HEX(RANDOMBLOB(16))), 'folder', id, ?, ?, ?, ?
					FROM drive.folders WHERE owner_id = ? AND parent_id IS NULL AND is_trashed = 0
					ON CONFLICT(target_type, target_id, shared_with_user_id) DO UPDATE SET permission = excluded.permission
				`, claims.UserID, mUID, req.Permission, nowStr, claims.UserID)
				_, _ = db.DB.Exec(`
					INSERT INTO drive.shares (id, target_type, target_id, shared_by_user_id, shared_with_user_id, permission, created_at)
					SELECT LOWER(HEX(RANDOMBLOB(16))), 'file', id, ?, ?, ?, ?
					FROM drive.files WHERE owner_id = ? AND folder_id IS NULL AND is_trashed = 0
					ON CONFLICT(target_type, target_id, shared_with_user_id) DO UPDATE SET permission = excluded.permission
				`, claims.UserID, mUID, req.Permission, nowStr, claims.UserID)
			} else {
				sID := uuid.New().String()
				_, _ = db.DB.Exec(`
					INSERT INTO drive.shares (id, target_type, target_id, shared_by_user_id, shared_with_user_id, permission, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT(target_type, target_id, shared_with_user_id) DO UPDATE SET permission = excluded.permission
				`, sID, req.TargetType, req.TargetID, claims.UserID, mUID, req.Permission, nowStr)
			}
		}

		db.LogActivity(claims.UserID, claims.Username, "share_team", req.TargetType, req.TargetID, team.Name, fmt.Sprintf("Shared %s with team %s", req.TargetType, team.Name))

		utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
			"id":          teamShareID,
			"team_id":     team.ID,
			"team_name":   team.Name,
			"target_type": req.TargetType,
			"target_id":   req.TargetID,
			"permission":  req.Permission,
			"message":     fmt.Sprintf("Successfully shared with team %s", team.Name),
		})
		return
	}

	// Case 2: Share with an individual user
	var targetUser models.UserPublic
	var err error
	if req.UserID != "" {
		err = db.DB.QueryRow("SELECT id, email, username, name, avatar_color FROM main.users WHERE id = ?", req.UserID).
			Scan(&targetUser.ID, &targetUser.Email, &targetUser.Username, &targetUser.Name, &targetUser.AvatarColor)
	} else if req.UserEmail != "" {
		err = db.DB.QueryRow("SELECT id, email, username, name, avatar_color FROM main.users WHERE LOWER(email) = ?", strings.ToLower(strings.TrimSpace(req.UserEmail))).
			Scan(&targetUser.ID, &targetUser.Email, &targetUser.Username, &targetUser.Name, &targetUser.AvatarColor)
	} else {
		utils.RespondError(w, http.StatusBadRequest, "Team or recipient user is required")
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

	if req.TargetType == "drive" {
		// Share all root folders and files with target user
		_, _ = db.DB.Exec(`
			INSERT INTO drive.shares (id, target_type, target_id, shared_by_user_id, shared_with_user_id, permission, created_at)
			SELECT LOWER(HEX(RANDOMBLOB(16))), 'folder', id, ?, ?, ?, ?
			FROM drive.folders WHERE owner_id = ? AND parent_id IS NULL AND is_trashed = 0
			ON CONFLICT(target_type, target_id, shared_with_user_id) DO UPDATE SET permission = excluded.permission
		`, claims.UserID, targetUser.ID, req.Permission, nowStr, claims.UserID)
		_, _ = db.DB.Exec(`
			INSERT INTO drive.shares (id, target_type, target_id, shared_by_user_id, shared_with_user_id, permission, created_at)
			SELECT LOWER(HEX(RANDOMBLOB(16))), 'file', id, ?, ?, ?, ?
			FROM drive.files WHERE owner_id = ? AND folder_id IS NULL AND is_trashed = 0
			ON CONFLICT(target_type, target_id, shared_with_user_id) DO UPDATE SET permission = excluded.permission
		`, claims.UserID, targetUser.ID, req.Permission, nowStr, claims.UserID)

		db.LogActivity(claims.UserID, claims.Username, "share_drive", "drive", claims.UserID, targetUser.Name, fmt.Sprintf("Shared entire Drive with %s", targetUser.Name))

		utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
			"target_type": "drive",
			"target_id":   claims.UserID,
			"permission":  req.Permission,
			"shared_with": targetUser,
			"message":     fmt.Sprintf("Successfully shared Drive with %s", targetUser.Name),
		})
		return
	}

	shareID := uuid.New().String()
	_, err = db.DB.Exec(`
		INSERT INTO drive.shares (id, target_type, target_id, shared_by_user_id, shared_with_user_id, permission, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(target_type, target_id, shared_with_user_id) 
		DO UPDATE SET permission = excluded.permission
	`, shareID, req.TargetType, req.TargetID, claims.UserID, targetUser.ID, req.Permission, nowStr)

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to create share")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "share", req.TargetType, req.TargetID, targetUser.Name, fmt.Sprintf("Shared %s with %s", req.TargetType, targetUser.Name))

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"id":          shareID,
		"target_type": req.TargetType,
		"target_id":   req.TargetID,
		"permission":  req.Permission,
		"shared_with": targetUser,
	})
}

// GetSharedWithMe lists all files and folders shared with current user (direct, team, or shared drives)
func (h *ShareHandler) GetSharedWithMe(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	// Shared folders (includes direct shares and team shares)
	folderRows, err := db.DB.Query(`
		SELECT DISTINCT f.id, f.name, f.parent_id, f.owner_id, u.name, u.email, f.is_starred, f.is_trashed, f.color, f.created_at, f.updated_at,
		       COALESCE(s.permission, ts.permission, 'viewer') AS permission,
		       (SELECT COUNT(*) FROM files WHERE folder_id = f.id AND is_trashed = 0) +
		       (SELECT COUNT(*) FROM folders WHERE parent_id = f.id AND is_trashed = 0) AS item_count
		FROM folders f
		JOIN users u ON f.owner_id = u.id
		LEFT JOIN shares s ON s.target_type = 'folder' AND s.target_id = f.id AND s.shared_with_user_id = ?
		LEFT JOIN team_shares ts ON (
			(ts.target_type = 'folder' AND ts.target_id = f.id) OR
			(ts.target_type = 'drive' AND ts.shared_by_user_id = f.owner_id AND f.parent_id IS NULL)
		) AND ts.team_id IN (SELECT team_id FROM main.team_members WHERE user_id = ?)
		WHERE f.is_trashed = 0 AND (s.id IS NOT NULL OR ts.id IS NOT NULL)
		ORDER BY f.updated_at DESC
	`, claims.UserID, claims.UserID)

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

	// Shared files (includes direct shares and team shares)
	fileRows, err := db.DB.Query(`
		SELECT DISTINCT f.id, f.name, f.original_name, f.folder_id, f.owner_id, u.name, u.email,
		       f.size, f.mime_type, f.extension, f.is_starred, f.is_trashed, f.created_at, f.updated_at,
		       COALESCE(s.permission, ts.permission, 'viewer') AS permission
		FROM files f
		JOIN users u ON f.owner_id = u.id
		LEFT JOIN shares s ON s.target_type = 'file' AND s.target_id = f.id AND s.shared_with_user_id = ?
		LEFT JOIN team_shares ts ON (
			(ts.target_type = 'file' AND ts.target_id = f.id) OR
			(ts.target_type = 'drive' AND ts.shared_by_user_id = f.owner_id AND f.folder_id IS NULL)
		) AND ts.team_id IN (SELECT team_id FROM main.team_members WHERE user_id = ?)
		WHERE f.is_trashed = 0 AND (s.id IS NOT NULL OR ts.id IS NOT NULL)
		ORDER BY f.updated_at DESC
	`, claims.UserID, claims.UserID)

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

// GetTargetShares returns list of users and teams who have access to target folder or file
func (h *ShareHandler) GetTargetShares(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	targetType := r.URL.Query().Get("type")
	targetID := r.URL.Query().Get("id")

	if targetType == "" || targetID == "" {
		utils.RespondError(w, http.StatusBadRequest, "type and id are required")
		return
	}

	// Check access
	if targetType == "drive" {
		targetID = claims.UserID
	} else if targetType == "folder" {
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
		FROM drive.shares s
		JOIN main.users u ON s.shared_with_user_id = u.id
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
	err := db.DB.QueryRow("SELECT shared_by_user_id, shared_with_user_id FROM drive.shares WHERE id = ?", shareID).Scan(&sharedBy, &sharedWith)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Share not found")
		return
	}

	if sharedBy != claims.UserID && sharedWith != claims.UserID {
		utils.RespondError(w, http.StatusForbidden, "No permission to revoke share")
		return
	}

	_, err = db.DB.Exec("DELETE FROM drive.shares WHERE id = ?", shareID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to remove share")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "revoke_share", "share", shareID, "", "Revoked share access")
	utils.RespondSuccess(w, http.StatusOK, "Share access revoked", nil)
}
