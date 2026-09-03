package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"eledrive/db"
	"eledrive/middleware"
	"eledrive/models"
	"eledrive/storage"
	"eledrive/utils"
	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

type AdminHandler struct {
	storage *storage.StorageService
}

func NewAdminHandler(storage *storage.StorageService) *AdminHandler {
	return &AdminHandler{storage: storage}
}

// RequireAdmin verifies that the authenticated user has role == "admin"
func (h *AdminHandler) RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := middleware.GetUserClaims(r.Context())
		if claims == nil || claims.Role != "admin" {
			utils.RespondError(w, http.StatusForbidden, "Admin access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *AdminHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	var stats models.AdminStats

	_ = db.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM files WHERE is_trashed = 0").Scan(&stats.TotalFiles)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM folders WHERE is_trashed = 0").Scan(&stats.TotalFolders)

	var totalStorage sql.NullInt64
	_ = db.DB.QueryRow("SELECT SUM(size) FROM files WHERE is_trashed = 0").Scan(&totalStorage)
	if totalStorage.Valid {
		stats.TotalStorageUsed = totalStorage.Int64
	}

	_ = db.DB.QueryRow("SELECT COUNT(*) FROM share_links").Scan(&stats.TotalShareLinks)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM shares").Scan(&stats.TotalDirectShares)

	utils.RespondJSON(w, http.StatusOK, stats)
}

func (h *AdminHandler) GetLogs(w http.ResponseWriter, r *http.Request) {
	actionFilter := r.URL.Query().Get("action")
	q := strings.TrimSpace(r.URL.Query().Get("q"))

	query := `
		SELECT id, user_id, user_name, action, item_type, item_id, item_name, details, created_at 
		FROM activity_logs 
		WHERE 1=1
	`
	var args []interface{}

	if actionFilter != "" && actionFilter != "all" {
		query += " AND action = ?"
		args = append(args, actionFilter)
	}

	if q != "" {
		pattern := "%" + strings.ToLower(q) + "%"
		query += " AND (LOWER(user_name) LIKE ? OR LOWER(item_name) LIKE ? OR LOWER(details) LIKE ?)"
		args = append(args, pattern, pattern, pattern)
	}

	query += " ORDER BY created_at DESC LIMIT 100"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to fetch logs")
		return
	}
	defer rows.Close()

	logs := make([]models.ActivityLog, 0)
	for rows.Next() {
		var logEntry models.ActivityLog
		var details sql.NullString
		if err := rows.Scan(
			&logEntry.ID, &logEntry.UserID, &logEntry.UserName, &logEntry.Action,
			&logEntry.ItemType, &logEntry.ItemID, &logEntry.ItemName, &details, &logEntry.CreatedAt,
		); err == nil {
			if details.Valid {
				logEntry.Details = details.String
			}
			logs = append(logs, logEntry)
		}
	}

	utils.RespondJSON(w, http.StatusOK, logs)
}

func (h *AdminHandler) ClearLogs(w http.ResponseWriter, r *http.Request) {
	_, err := db.DB.Exec("DELETE FROM activity_logs")
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to clear logs")
		return
	}
	utils.RespondSuccess(w, http.StatusOK, "Logs cleared", nil)
}

func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query(`
		SELECT u.id, u.email, u.username, u.name, u.avatar_color, u.role, u.storage_used, u.storage_limit,
		       (SELECT COUNT(*) FROM files WHERE owner_id = u.id AND is_trashed = 0) AS files_count,
		       u.created_at, u.updated_at
		FROM users u
		ORDER BY u.created_at ASC
	`)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to list users")
		return
	}
	defer rows.Close()

	users := make([]models.AdminUserDetail, 0)
	for rows.Next() {
		var u models.AdminUserDetail
		if err := rows.Scan(
			&u.ID, &u.Email, &u.Username, &u.Name, &u.AvatarColor, &u.Role,
			&u.StorageUsed, &u.StorageLimit, &u.FilesCount, &u.CreatedAt, &u.UpdatedAt,
		); err == nil {
			users = append(users, u)
		}
	}

	utils.RespondJSON(w, http.StatusOK, users)
}

type UpdateUserAdminRequest struct {
	Name         string  `json:"name"`
	Email        string  `json:"email"`
	Role         string  `json:"role"`
	StorageLimit *int64  `json:"storage_limit"`
	Password     *string `json:"password,omitempty"`
}

func (h *AdminHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	targetUserID := chi.URLParam(r, "id")

	var req UpdateUserAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Role != "admin" && req.Role != "member" {
		req.Role = "member"
	}

	// Update base fields
	_, err := db.DB.Exec(`
		UPDATE users 
		SET name = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`, req.Name, req.Email, req.Role, targetUserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update user profile")
		return
	}

	if req.StorageLimit != nil && *req.StorageLimit > 0 {
		_, _ = db.DB.Exec("UPDATE users SET storage_limit = ? WHERE id = ?", *req.StorageLimit, targetUserID)
	}

	if req.Password != nil && len(*req.Password) >= 6 {
		hashed, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err == nil {
			_, _ = db.DB.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(hashed), targetUserID)
		}
	}

	db.LogActivity(claims.UserID, claims.Username, "admin_user_update", "user", targetUserID, req.Name, "Admin modified user profile/quota")

	utils.RespondSuccess(w, http.StatusOK, "User updated successfully", nil)
}

func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	targetUserID := chi.URLParam(r, "id")

	if targetUserID == claims.UserID {
		utils.RespondError(w, http.StatusBadRequest, "Cannot delete your own admin account")
		return
	}

	// Fetch files to delete from disk
	rows, err := db.DB.Query("SELECT storage_path FROM files WHERE owner_id = ?", targetUserID)
	if err == nil {
		for rows.Next() {
			var path string
			if err := rows.Scan(&path); err == nil {
				_ = h.storage.DeleteFile(path)
			}
		}
		rows.Close()
	}

	_, err = db.DB.Exec("DELETE FROM users WHERE id = ?", targetUserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to delete user")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "admin_user_delete", "user", targetUserID, targetUserID, "Admin deleted user account")

	utils.RespondSuccess(w, http.StatusOK, "User deleted successfully", nil)
}

func (h *AdminHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	settings := models.SystemSettings{
		SiteName:                "EleDrive",
		DefaultQuotaGB:          10,
		AllowPublicRegistration: true,
		AllowPublicShares:       true,
		MaxUploadSizeMB:         1024,
	}

	rows, err := db.DB.Query("SELECT key, value FROM system_settings")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var k, v string
			if err := rows.Scan(&k, &v); err == nil {
				switch k {
				case "site_name":
					settings.SiteName = v
				case "default_quota_gb":
					if val, err := strconv.ParseInt(v, 10, 64); err == nil {
						settings.DefaultQuotaGB = val
					}
				case "allow_public_registration":
					settings.AllowPublicRegistration = (v == "true" || v == "1")
				case "allow_public_shares":
					settings.AllowPublicShares = (v == "true" || v == "1")
				case "max_upload_size_mb":
					if val, err := strconv.ParseInt(v, 10, 64); err == nil {
						settings.MaxUploadSizeMB = val
					}
				}
			}
		}
	}

	utils.RespondJSON(w, http.StatusOK, settings)
}

func (h *AdminHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	var req models.SystemSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.SiteName == "" {
		req.SiteName = "EleDrive"
	}
	if req.DefaultQuotaGB <= 0 {
		req.DefaultQuotaGB = 10
	}
	if req.MaxUploadSizeMB <= 0 {
		req.MaxUploadSizeMB = 1024
	}

	pairs := map[string]string{
		"site_name":                 req.SiteName,
		"default_quota_gb":          strconv.FormatInt(req.DefaultQuotaGB, 10),
		"allow_public_registration": strconv.FormatBool(req.AllowPublicRegistration),
		"allow_public_shares":       strconv.FormatBool(req.AllowPublicShares),
		"max_upload_size_mb":        strconv.FormatInt(req.MaxUploadSizeMB, 10),
	}

	for k, v := range pairs {
		_, _ = db.DB.Exec(`
			INSERT INTO system_settings (key, value, updated_at) 
			VALUES (?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
		`, k, v)
	}

	db.LogActivity(claims.UserID, claims.Username, "settings_update", "system", "settings", req.SiteName, "Updated global system settings")

	utils.RespondSuccess(w, http.StatusOK, "Settings updated successfully", req)
}
