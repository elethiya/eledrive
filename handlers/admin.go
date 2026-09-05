package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
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
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AdminHandler struct {
	cfg     *config.Config
	storage *storage.StorageService
}

func NewAdminHandler(cfg *config.Config, storage *storage.StorageService) *AdminHandler {
	return &AdminHandler{cfg: cfg, storage: storage}
}

// RequireAdmin verifies that the authenticated user has role == "admin" or role == "owner"
func (h *AdminHandler) RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := middleware.GetUserClaims(r.Context())
		if claims == nil || (claims.Role != "admin" && claims.Role != "owner") {
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
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE status = 'pending'").Scan(&stats.PendingApprovals)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM main.team_requests WHERE status = 'pending'").Scan(&stats.PendingTeamRequests)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM main.password_resets WHERE status = 'pending'").Scan(&stats.PendingResets)

	utils.RespondJSON(w, http.StatusOK, stats)
}

func (h *AdminHandler) GetLogs(w http.ResponseWriter, r *http.Request) {
	actionFilter := r.URL.Query().Get("action")
	q := strings.TrimSpace(r.URL.Query().Get("q"))

	query := `
		SELECT l.id, l.user_id, l.user_name, COALESCE(u.username, '') AS user_username, l.action, l.item_type, l.item_id, l.item_name, l.details, l.created_at 
		FROM activity_logs l
		LEFT JOIN users u ON l.user_id = u.id
		WHERE 1=1
	`
	var args []interface{}

	if actionFilter != "" && actionFilter != "all" {
		query += " AND l.action = ?"
		args = append(args, actionFilter)
	}

	if q != "" {
		pattern := "%" + strings.ToLower(q) + "%"
		query += " AND (LOWER(l.user_name) LIKE ? OR LOWER(COALESCE(u.username, '')) LIKE ? OR LOWER(l.item_name) LIKE ? OR LOWER(l.details) LIKE ?)"
		args = append(args, pattern, pattern, pattern, pattern)
	}

	query += " ORDER BY l.created_at DESC LIMIT 100"

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
			&logEntry.ID, &logEntry.UserID, &logEntry.UserName, &logEntry.UserUsername, &logEntry.Action,
			&logEntry.ItemType, &logEntry.ItemID, &logEntry.ItemName, &details, &logEntry.CreatedAt,
		); err == nil {
			if details.Valid {
				logEntry.Details = details.String
			}
			logs = append(logs, logEntry)
		}
	}
	if err := rows.Err(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to read logs")
		return
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
	claims := middleware.GetUserClaims(r.Context())
	rows, err := db.DB.Query(`
		SELECT u.id, u.email, u.username, u.name, u.avatar_color, u.role, COALESCE(u.status, 'approved') AS status,
		       u.storage_used, u.storage_limit,
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
			&u.ID, &u.Email, &u.Username, &u.Name, &u.AvatarColor, &u.Role, &u.Status,
			&u.StorageUsed, &u.StorageLimit, &u.FilesCount, &u.CreatedAt, &u.UpdatedAt,
		); err == nil {
			// If viewer is an admin (not owner) and target user is owner:
			// Mask sensitive data so admins cannot view owner's email, storage, or files
			if claims.Role != "owner" && u.Role == "owner" {
				u.Email = "[Owner Protected]"
				u.StorageUsed = 0
				u.StorageLimit = 0
				u.FilesCount = 0
			}
			users = append(users, u)
		}
	}
	if err := rows.Err(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to read users")
		return
	}

	utils.RespondJSON(w, http.StatusOK, users)
}

type UpdateUserAdminRequest struct {
	Name         string  `json:"name"`
	Email        string  `json:"email"`
	Role         string  `json:"role"`
	AvatarColor  string  `json:"avatar_color"`
	Status       *string `json:"status,omitempty"`
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

	// Fetch current target user
	var currentTargetRole, currentTargetName, currentTargetEmail, currentTargetColor string
	err := db.DB.QueryRow("SELECT role, name, email, avatar_color FROM users WHERE id = ?", targetUserID).Scan(&currentTargetRole, &currentTargetName, &currentTargetEmail, &currentTargetColor)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "User not found")
		return
	}

	// 1. Workspace Owner protection: non-owners cannot edit the Owner account
	if currentTargetRole == "owner" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only the workspace Owner can modify their account")
		return
	}

	// 2. Ownership transfer protection: cannot assign 'owner' role via web API
	if req.Role == "owner" && currentTargetRole != "owner" {
		utils.RespondError(w, http.StatusBadRequest, "Ownership can only be transferred using the ownership.sh script")
		return
	}

	// 3. Admin role assignment rule: "owner only can only make and remove any body from admin roll"
	targetRole := currentTargetRole
	if currentTargetRole == "owner" {
		targetRole = "owner"
	} else if claims.Role == "owner" {
		// The Owner has full authority to promote to admin or demote to member
		if req.Role == "admin" || req.Role == "member" {
			targetRole = req.Role
		}
	} else {
		// Regular admin cannot change anyone's role
		if req.Role != "" && req.Role != currentTargetRole {
			utils.RespondError(w, http.StatusForbidden, "Only the workspace Owner can assign or remove Administrator roles")
			return
		}
		targetRole = currentTargetRole
	}

	targetName := currentTargetName
	if req.Name != "" {
		targetName = req.Name
	}
	targetEmail := currentTargetEmail
	if req.Email != "" {
		targetEmail = req.Email
	}
	targetColor := currentTargetColor
	if req.AvatarColor != "" {
		targetColor = req.AvatarColor
	}

	// Update base fields
	_, err = db.DB.Exec(`
		UPDATE users 
		SET name = ?, email = ?, role = ?, avatar_color = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`, targetName, targetEmail, targetRole, targetColor, targetUserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update user profile: "+err.Error())
		return
	}

	if req.Status != nil && (*req.Status == "approved" || *req.Status == "pending" || *req.Status == "rejected") {
		// Cannot reject or set owner to pending
		if currentTargetRole != "owner" {
			_, _ = db.DB.Exec("UPDATE users SET status = ? WHERE id = ?", *req.Status, targetUserID)
		}
	}

	if req.StorageLimit != nil && *req.StorageLimit > 0 {
		// Admin cannot change owner's storage limit; only owner can change self storage limit
		if currentTargetRole == "owner" && claims.Role != "owner" {
			utils.RespondError(w, http.StatusForbidden, "Admins cannot change the Owner's storage limit")
			return
		}
		_, _ = db.DB.Exec("UPDATE users SET storage_limit = ? WHERE id = ?", *req.StorageLimit, targetUserID)
		events.Broadcast("storage:update", "storage", "update", targetUserID, "", claims.UserID, map[string]interface{}{"storage_limit": *req.StorageLimit})
	}

	if req.Password != nil && len(*req.Password) >= 6 {
		hashed, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err == nil {
			_, _ = db.DB.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(hashed), targetUserID)
			actorName := claims.Username
			if actorName == "" {
				actorName = claims.Email
			}
			_, _ = db.DB.Exec("UPDATE main.password_resets SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE user_id = ? AND status = 'pending'", actorName, targetUserID)
		}
	}

	db.LogActivity(claims.UserID, claims.Username, "admin_user_update", "user", targetUserID, req.Name, "Modified user profile/role/quota")

	utils.RespondSuccess(w, http.StatusOK, "User updated successfully", nil)
}

func (h *AdminHandler) ApproveUser(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	targetUserID := chi.URLParam(r, "id")

	var userName, username, userRole string
	err := db.DB.QueryRow("SELECT name, username, role FROM users WHERE id = ?", targetUserID).Scan(&userName, &username, &userRole)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "User not found")
		return
	}

	if userRole == "owner" {
		utils.RespondError(w, http.StatusForbidden, "Admins cannot modify or touch the Workspace Owner account")
		return
	}

	_, err = db.DB.Exec("UPDATE users SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?", targetUserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to approve user")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "admin_user_approve", "user", targetUserID, userName, fmt.Sprintf("Admin approved account for user @%s", username))

	utils.RespondSuccess(w, http.StatusOK, "User account approved successfully", nil)
}

func (h *AdminHandler) RejectUser(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	targetUserID := chi.URLParam(r, "id")

	var userName, username, userRole string
	err := db.DB.QueryRow("SELECT name, username, role FROM users WHERE id = ?", targetUserID).Scan(&userName, &username, &userRole)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "User not found")
		return
	}

	if userRole == "owner" {
		utils.RespondError(w, http.StatusForbidden, "Admins cannot modify or touch the Workspace Owner account")
		return
	}

	_, err = db.DB.Exec("UPDATE users SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?", targetUserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to reject user")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "admin_user_reject", "user", targetUserID, userName, fmt.Sprintf("Admin rejected account for user @%s", username))

	utils.RespondSuccess(w, http.StatusOK, "User account rejected", nil)
}

func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	targetUserID := chi.URLParam(r, "id")

	if targetUserID == claims.UserID {
		utils.RespondError(w, http.StatusBadRequest, "Cannot delete your own account")
		return
	}

	var targetRole, targetName string
	err := db.DB.QueryRow("SELECT role, name FROM users WHERE id = ?", targetUserID).Scan(&targetRole, &targetName)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "User not found")
		return
	}

	// 1. Owner cannot be deleted
	if targetRole == "owner" {
		utils.RespondError(w, http.StatusForbidden, "The workspace Owner account cannot be deleted")
		return
	}

	// 2. Only Owner can delete Administrator accounts
	if targetRole == "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only the workspace Owner can delete Administrator accounts")
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
		if err := rows.Err(); err != nil {
			_ = err
		}
		rows.Close()
	}

	_, err = db.DB.Exec("DELETE FROM users WHERE id = ?", targetUserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to delete user")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "admin_user_delete", "user", targetUserID, targetName, fmt.Sprintf("Deleted user account (%s)", targetRole))

	utils.RespondSuccess(w, http.StatusOK, "User deleted successfully", nil)
}

func (h *AdminHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	settings := models.SystemSettings{
		SiteName:                    "EleDrive",
		DefaultQuotaGB:              10,
		AllowPublicRegistration:     true,
		AllowPublicShares:           true,
		MaxUploadSizeMB:             1024,
		RequireAdminApproval:        true,
		AllowPasswordResetRequests:  true,
		SessionTimeoutHours:         72,
		EnforceStrongPasswords:      false,
		MaxLoginAttempts:            5,
		RequireLinkPasswords:        false,
		DefaultLinkExpiryDays:       30,
		AllowTeamCreation:           true,
		TrashRetentionDays:          30,
		ActivityLogRetentionDays:    90,
		NotifyQuotaWarningPercent:   85,
		ForensicWatermarkingEnabled: true,
		SteganographicCanaryEnabled: true,
		LogForensicDownloads:        true,
		ForensicAccessPolicy:        "owner_only",
		MaintenanceMode:             false,
		MaintenanceNotice:           "Platform is currently undergoing scheduled maintenance. Please check back shortly.",
		AllowZipDownloads:           true,
		ChunkUploadEnabled:          true,
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
				case "require_admin_approval":
					settings.RequireAdminApproval = (v == "true" || v == "1")
				case "allow_password_reset_requests":
					settings.AllowPasswordResetRequests = (v == "true" || v == "1")
				case "session_timeout_hours":
					if val, err := strconv.Atoi(v); err == nil {
						settings.SessionTimeoutHours = val
					}
				case "enforce_strong_passwords":
					settings.EnforceStrongPasswords = (v == "true" || v == "1")
				case "max_login_attempts":
					if val, err := strconv.Atoi(v); err == nil {
						settings.MaxLoginAttempts = val
					}
				case "require_link_passwords":
					settings.RequireLinkPasswords = (v == "true" || v == "1")
				case "default_link_expiry_days":
					if val, err := strconv.Atoi(v); err == nil {
						settings.DefaultLinkExpiryDays = val
					}
				case "allow_team_creation":
					settings.AllowTeamCreation = (v == "true" || v == "1")
				case "trash_retention_days":
					if val, err := strconv.Atoi(v); err == nil {
						settings.TrashRetentionDays = val
					}
				case "activity_log_retention_days":
					if val, err := strconv.Atoi(v); err == nil {
						settings.ActivityLogRetentionDays = val
					}
				case "notify_quota_warning_percent":
					if val, err := strconv.Atoi(v); err == nil {
						settings.NotifyQuotaWarningPercent = val
					}
				case "forensic_watermarking_enabled":
					settings.ForensicWatermarkingEnabled = (v == "true" || v == "1")
				case "steganographic_canary_enabled":
					settings.SteganographicCanaryEnabled = (v == "true" || v == "1")
				case "log_forensic_downloads":
					settings.LogForensicDownloads = (v == "true" || v == "1")
				case "forensic_access_policy":
					if v != "" {
						settings.ForensicAccessPolicy = v
					}
				case "maintenance_mode":
					settings.MaintenanceMode = (v == "true" || v == "1")
				case "maintenance_notice":
					settings.MaintenanceNotice = v
				case "allow_zip_downloads":
					settings.AllowZipDownloads = (v == "true" || v == "1")
				case "chunk_upload_enabled":
					settings.ChunkUploadEnabled = (v == "true" || v == "1")
				}
			}
		}
		if err := rows.Err(); err != nil {
			_ = err
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

	req.SiteName = "EleDrive"
	if req.DefaultQuotaGB <= 0 {
		req.DefaultQuotaGB = 10
	}
	if req.MaxUploadSizeMB <= 0 {
		req.MaxUploadSizeMB = 1024
	}
	if req.SessionTimeoutHours <= 0 {
		req.SessionTimeoutHours = 72
	}
	if req.NotifyQuotaWarningPercent <= 0 || req.NotifyQuotaWarningPercent > 100 {
		req.NotifyQuotaWarningPercent = 85
	}
	if req.MaintenanceNotice == "" {
		req.MaintenanceNotice = "Platform is currently undergoing scheduled maintenance. Please check back shortly."
	}

	pairs := map[string]string{
		"site_name":                      "EleDrive",
		"default_quota_gb":               strconv.FormatInt(req.DefaultQuotaGB, 10),
		"allow_public_registration":      strconv.FormatBool(req.AllowPublicRegistration),
		"allow_public_shares":            strconv.FormatBool(req.AllowPublicShares),
		"max_upload_size_mb":             strconv.FormatInt(req.MaxUploadSizeMB, 10),
		"require_admin_approval":         strconv.FormatBool(req.RequireAdminApproval),
		"allow_password_reset_requests":   strconv.FormatBool(req.AllowPasswordResetRequests),
		"session_timeout_hours":          strconv.Itoa(req.SessionTimeoutHours),
		"enforce_strong_passwords":       strconv.FormatBool(req.EnforceStrongPasswords),
		"max_login_attempts":             strconv.Itoa(req.MaxLoginAttempts),
		"require_link_passwords":         strconv.FormatBool(req.RequireLinkPasswords),
		"default_link_expiry_days":        strconv.Itoa(req.DefaultLinkExpiryDays),
		"allow_team_creation":            strconv.FormatBool(req.AllowTeamCreation),
		"trash_retention_days":           strconv.Itoa(req.TrashRetentionDays),
		"activity_log_retention_days":     strconv.Itoa(req.ActivityLogRetentionDays),
		"notify_quota_warning_percent":    strconv.Itoa(req.NotifyQuotaWarningPercent),
		"forensic_watermarking_enabled":  strconv.FormatBool(req.ForensicWatermarkingEnabled),
		"steganographic_canary_enabled":  strconv.FormatBool(req.SteganographicCanaryEnabled),
		"log_forensic_downloads":         strconv.FormatBool(req.LogForensicDownloads),
		"forensic_access_policy":        req.ForensicAccessPolicy,
		"maintenance_mode":               strconv.FormatBool(req.MaintenanceMode),
		"maintenance_notice":             req.MaintenanceNotice,
		"allow_zip_downloads":            strconv.FormatBool(req.AllowZipDownloads),
		"chunk_upload_enabled":           strconv.FormatBool(req.ChunkUploadEnabled),
	}

	if claims.Role != "owner" {
		// Non-owner administrators have access ONLY to System Operations & Maintenance
		pairs = map[string]string{
			"maintenance_mode":   strconv.FormatBool(req.MaintenanceMode),
			"maintenance_notice": req.MaintenanceNotice,
		}
	}

	for k, v := range pairs {
		_, _ = db.DB.Exec(`
			INSERT INTO system_settings (key, value, updated_at) 
			VALUES (?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
		`, k, v)
	}

	// Broadcast real-time maintenance event to all connected clients
	events.Broadcast("system:maintenance", "system", "maintenance", "", "", claims.UserID, map[string]interface{}{
		"maintenance_mode":   req.MaintenanceMode,
		"maintenance_notice": req.MaintenanceNotice,
	})

	db.LogActivity(claims.UserID, claims.Username, "settings_update", "system", "settings", "Platform Settings", "Updated global platform settings")

	utils.RespondSuccess(w, http.StatusOK, "Settings updated successfully", req)
}

type InspectLeakRequest struct {
	Query string `json:"query"` // UUID, filename, or token
}

// InspectLeak analyzes a suspect file or secret UUID to uncover who leaked it
func (h *AdminHandler) InspectLeak(w http.ResponseWriter, r *http.Request) {
	fh := NewForensicHandler(h.cfg)
	fh.Inspect(w, r)
}

func (h *AdminHandler) GetSecurityStats(w http.ResponseWriter, r *http.Request) {
	fh := NewForensicHandler(h.cfg)
	fh.GetStats(w, r)
}

func (h *AdminHandler) ListPasswordResets(w http.ResponseWriter, r *http.Request) {
	// Ensure table exists
	_, _ = db.DB.Exec(`
		CREATE TABLE IF NOT EXISTS main.password_resets (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			user_name TEXT NOT NULL,
			user_email TEXT NOT NULL,
			user_username TEXT NOT NULL,
			status TEXT DEFAULT 'pending',
			reason TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			resolved_at DATETIME,
			resolved_by TEXT
		)
	`)

	rows, err := db.DB.Query(`
		SELECT pr.id, pr.user_id, pr.user_name, pr.user_email, pr.user_username,
		       COALESCE(u.avatar_color, '#3b82f6') AS avatar_color,
		       pr.status, pr.reason, pr.created_at, pr.resolved_at, pr.resolved_by
		FROM main.password_resets pr
		LEFT JOIN main.users u ON pr.user_id = u.id
		WHERE u.role != 'owner' OR u.role IS NULL
		ORDER BY CASE pr.status WHEN 'pending' THEN 1 ELSE 2 END, pr.created_at DESC
		LIMIT 100
	`)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to fetch password reset requests")
		return
	}
	defer rows.Close()

	resets := make([]models.PasswordResetRequest, 0)
	for rows.Next() {
		var pr models.PasswordResetRequest
		var resolvedAt sql.NullTime
		var resolvedBy sql.NullString
		if err := rows.Scan(
			&pr.ID, &pr.UserID, &pr.UserName, &pr.UserEmail, &pr.UserUsername,
			&pr.AvatarColor, &pr.Status, &pr.Reason, &pr.CreatedAt, &resolvedAt, &resolvedBy,
		); err == nil {
			if resolvedAt.Valid {
				pr.ResolvedAt = &resolvedAt.Time
			}
			if resolvedBy.Valid {
				pr.ResolvedBy = &resolvedBy.String
			}
			resets = append(resets, pr)
		}
	}
	if err := rows.Err(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to read password reset requests")
		return
	}

	utils.RespondJSON(w, http.StatusOK, resets)
}

type ResolvePasswordResetRequest struct {
	Action      string `json:"action"` // "reset" or "reject"
	NewPassword string `json:"new_password,omitempty"`
}

func (h *AdminHandler) ResolvePasswordReset(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	resetID := chi.URLParam(r, "id")

	var req ResolvePasswordResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	var userID, userName, userEmail, userUsername string
	err := db.DB.QueryRow(`
		SELECT user_id, user_name, user_email, user_username
		FROM main.password_resets
		WHERE id = ?
	`, resetID).Scan(&userID, &userName, &userEmail, &userUsername)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Password reset request not found")
		return
	}

	// Owner protection: admins cannot modify the workspace owner's credentials
	var targetRole string
	_ = db.DB.QueryRow(`SELECT role FROM main.users WHERE id = ?`, userID).Scan(&targetRole)
	if targetRole == "owner" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Admins cannot reset or modify the workspace owner's credentials")
		return
	}

	actorName := claims.Username
	if actorName == "" {
		actorName = claims.Email
	}

	if req.Action == "reject" {
		_, err := db.DB.Exec(`
			UPDATE main.password_resets
			SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
			WHERE id = ?
		`, actorName, resetID)
		if err != nil {
			utils.RespondError(w, http.StatusInternalServerError, "Failed to reject request")
			return
		}

		db.LogActivity(claims.UserID, actorName, "admin_password_reset_reject", "user", userID, userName, fmt.Sprintf("Admin @%s rejected password reset request for @%s", actorName, userUsername))
		utils.RespondSuccess(w, http.StatusOK, "Password reset request rejected", nil)
		return
	}

	// Action is "reset"
	newPassword := strings.TrimSpace(req.NewPassword)
	if len(newPassword) < 6 {
		utils.RespondError(w, http.StatusBadRequest, "New password must be at least 6 characters")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	_, err = db.DB.Exec(`
		UPDATE main.users
		SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, string(hash), userID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update user password")
		return
	}

	// Mark this request as resolved
	_, _ = db.DB.Exec(`
		UPDATE main.password_resets
		SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
		WHERE id = ?
	`, actorName, resetID)

	// Also resolve any other pending requests for this user
	_, _ = db.DB.Exec(`
		UPDATE main.password_resets
		SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
		WHERE user_id = ? AND status = 'pending'
	`, actorName, userID)

	db.LogActivity(claims.UserID, actorName, "admin_password_reset", "user", userID, userName, fmt.Sprintf("Admin @%s reset password for user @%s", actorName, userUsername))

	utils.RespondSuccess(w, http.StatusOK, fmt.Sprintf("Password for @%s successfully reset!", userUsername), map[string]interface{}{
		"user_id":  userID,
		"username": userUsername,
	})
}

// ListTeamRequests returns team creation requests for admin review
func (h *AdminHandler) ListTeamRequests(w http.ResponseWriter, r *http.Request) {
	statusFilter := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status")))
	if statusFilter == "" {
		statusFilter = "all"
	}

	query := `
		SELECT id, user_id, user_name, user_email, user_username, name, description, avatar_color, initial_members, status, admin_note, created_at, reviewed_at, COALESCE(reviewed_by, '')
		FROM main.team_requests
	`
	var args []interface{}
	if statusFilter != "all" && statusFilter != "" {
		query += " WHERE status = ?"
		args = append(args, statusFilter)
	}
	query += " ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END, created_at DESC LIMIT 200"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to fetch team requests")
		return
	}
	defer rows.Close()

	requests := make([]models.TeamCreationRequest, 0)
	for rows.Next() {
		var tr models.TeamCreationRequest
		var initialMembersStr, desc, adminNote, revBy sql.NullString
		var revAt sql.NullTime
		if err := rows.Scan(
			&tr.ID, &tr.UserID, &tr.UserName, &tr.UserEmail, &tr.UserUsername,
			&tr.Name, &desc, &tr.AvatarColor, &initialMembersStr, &tr.Status,
			&adminNote, &tr.CreatedAt, &revAt, &revBy,
		); err == nil {
			if desc.Valid {
				tr.Description = desc.String
			}
			if adminNote.Valid {
				tr.AdminNote = adminNote.String
			}
			if revBy.Valid {
				tr.ReviewedBy = revBy.String
			}
			if revAt.Valid {
				tr.ReviewedAt = &revAt.Time
			}
			tr.InitialMembers = make([]string, 0)
			if initialMembersStr.Valid && initialMembersStr.String != "" {
				_ = json.Unmarshal([]byte(initialMembersStr.String), &tr.InitialMembers)
			}
			requests = append(requests, tr)
		}
	}
	if err := rows.Err(); err != nil {
		_ = err
	}

	utils.RespondJSON(w, http.StatusOK, requests)
}

// ApproveTeamRequest approves a team creation request and creates the team
func (h *AdminHandler) ApproveTeamRequest(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	requestID := chi.URLParam(r, "id")

	var tr models.TeamCreationRequest
	var initialMembersStr, desc, adminNote, revBy sql.NullString
	var revAt sql.NullTime

	err := db.DB.QueryRow(`
		SELECT id, user_id, user_name, user_email, user_username, name, description, avatar_color, initial_members, status, admin_note, created_at, reviewed_at, COALESCE(reviewed_by, '')
		FROM main.team_requests
		WHERE id = ?
	`, requestID).Scan(
		&tr.ID, &tr.UserID, &tr.UserName, &tr.UserEmail, &tr.UserUsername,
		&tr.Name, &desc, &tr.AvatarColor, &initialMembersStr, &tr.Status,
		&adminNote, &tr.CreatedAt, &revAt, &revBy,
	)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Team creation request not found")
		return
	}

	if tr.Status != "pending" {
		utils.RespondError(w, http.StatusBadRequest, fmt.Sprintf("Request has already been %s", tr.Status))
		return
	}

	if desc.Valid {
		tr.Description = desc.String
	}
	tr.InitialMembers = make([]string, 0)
	if initialMembersStr.Valid && initialMembersStr.String != "" {
		_ = json.Unmarshal([]byte(initialMembersStr.String), &tr.InitialMembers)
	}

	teamID := uuid.New().String()
	now := time.Now().UTC().Truncate(time.Second)

	tx, err := db.DB.Begin()
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to begin transaction")
		return
	}
	defer tx.Rollback()

	// Insert into teams
	_, err = tx.Exec(`
		INSERT INTO main.teams (id, name, description, avatar_color, created_by_user_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, teamID, tr.Name, tr.Description, tr.AvatarColor, tr.UserID, now, now)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to create team")
		return
	}

	// Insert creator as leader
	memberID := uuid.New().String()
	_, err = tx.Exec(`
		INSERT INTO main.team_members (id, team_id, user_id, role, joined_at)
		VALUES (?, ?, ?, 'leader', ?)
	`, memberID, teamID, tr.UserID, now)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to add creator as leader")
		return
	}

	// Insert initial members
	for _, memberUID := range tr.InitialMembers {
		if memberUID == tr.UserID || memberUID == "" {
			continue
		}
		var memRole string
		_ = tx.QueryRow("SELECT role FROM main.users WHERE id = ?", memberUID).Scan(&memRole)
		assignedRole := "member"
		if memRole == "owner" {
			assignedRole = "leader"
		}
		mID := uuid.New().String()
		_, _ = tx.Exec(`
			INSERT OR IGNORE INTO main.team_members (id, team_id, user_id, role, joined_at)
			VALUES (?, ?, ?, ?, ?)
		`, mID, teamID, memberUID, assignedRole, now)
	}

	// Mark request as approved
	actorName := claims.Username
	if actorName == "" {
		actorName = "Admin"
	}
	_, err = tx.Exec(`
		UPDATE main.team_requests
		SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?
		WHERE id = ?
	`, actorName, requestID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update request status")
		return
	}

	if err := tx.Commit(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to commit approved team")
		return
	}

	createdTeam := models.Team{
		ID:              teamID,
		Name:            tr.Name,
		Description:     tr.Description,
		AvatarColor:     tr.AvatarColor,
		CreatedByUserID: tr.UserID,
		MembersCount:    1 + len(tr.InitialMembers),
		UserRole:        "leader",
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	db.LogActivity(claims.UserID, actorName, "approve_team_request", "team", teamID, tr.Name, fmt.Sprintf("Admin @%s approved team creation request for '%s' (creator @%s)", actorName, tr.Name, tr.UserUsername))
	events.Broadcast("team:create", "team", "create", teamID, "", claims.UserID, createdTeam)
	events.Broadcast("team:request_approved", "team_request", "approve", requestID, "", claims.UserID, map[string]interface{}{
		"request_id": requestID,
		"team_id":    teamID,
		"user_id":    tr.UserID,
	})

	utils.RespondSuccess(w, http.StatusOK, fmt.Sprintf("Team '%s' approved and created successfully!", tr.Name), createdTeam)
}

// RejectTeamRequest rejects a team creation request
func (h *AdminHandler) RejectTeamRequest(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	requestID := chi.URLParam(r, "id")

	var req models.RejectTeamRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Note = ""
	}

	var trName, trUser string
	err := db.DB.QueryRow("SELECT name, user_username FROM main.team_requests WHERE id = ?", requestID).Scan(&trName, &trUser)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Team creation request not found")
		return
	}

	actorName := claims.Username
	if actorName == "" {
		actorName = "Admin"
	}

	_, err = db.DB.Exec(`
		UPDATE main.team_requests
		SET status = 'rejected', admin_note = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?
		WHERE id = ?
	`, req.Note, actorName, requestID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to reject team request")
		return
	}

	db.LogActivity(claims.UserID, actorName, "reject_team_request", "team_request", requestID, trName, fmt.Sprintf("Admin @%s rejected team request for '%s' (@%s)", actorName, trName, trUser))
	events.Broadcast("team:request_rejected", "team_request", "reject", requestID, "", claims.UserID, map[string]interface{}{
		"request_id": requestID,
		"note":       req.Note,
	})

	utils.RespondSuccess(w, http.StatusOK, "Team request rejected", nil)
}


