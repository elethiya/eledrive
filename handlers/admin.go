package handlers

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
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
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM shares").Scan(&stats.TotalDirectShares)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE status = 'pending'").Scan(&stats.PendingApprovals)

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
		"maintenance_mode":               strconv.FormatBool(req.MaintenanceMode),
		"maintenance_notice":             req.MaintenanceNotice,
		"allow_zip_downloads":            strconv.FormatBool(req.AllowZipDownloads),
		"chunk_upload_enabled":           strconv.FormatBool(req.ChunkUploadEnabled),
	}

	for k, v := range pairs {
		_, _ = db.DB.Exec(`
			INSERT INTO system_settings (key, value, updated_at) 
			VALUES (?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
		`, k, v)
	}

	db.LogActivity(claims.UserID, claims.Username, "settings_update", "system", "settings", "Platform Settings", "Updated global platform settings")

	utils.RespondSuccess(w, http.StatusOK, "Settings updated successfully", req)
}

type InspectLeakRequest struct {
	Query string `json:"query"` // UUID, filename, or token
}

// InspectLeak analyzes a suspect file or secret UUID to uncover who leaked it
func (h *AdminHandler) InspectLeak(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	actorID := ""
	actorName := "Admin"
	if claims != nil {
		actorID = claims.UserID
		if claims.Username != "" {
			actorName = claims.Username
		} else if claims.Email != "" {
			actorName = claims.Email
		}
	}

	var suspectBytes []byte
	var queryStr string
	var suspectFileName string

	// Check if file was uploaded in multipart form
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		err := r.ParseMultipartForm(50 * 1024 * 1024) // up to 50MB for inspection
		if err == nil && r.MultipartForm != nil {
			if files := r.MultipartForm.File["file"]; len(files) > 0 {
				suspectFileName = files[0].Filename
				f, err := files[0].Open()
				if err == nil {
					suspectBytes, _ = io.ReadAll(f)
					f.Close()
				}
			}
			if q := r.FormValue("query"); q != "" {
				queryStr = strings.TrimSpace(q)
			}
		}
	} else {
		var req InspectLeakRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			queryStr = strings.TrimSpace(req.Query)
		}
	}

	var checksum string
	if len(suspectBytes) > 0 {
		hSum := sha256.New()
		hSum.Write(suspectBytes)
		checksum = hex.EncodeToString(hSum.Sum(nil))
	}

	result := &models.ForensicInspectionResult{
		Matched:          false,
		RiskAssessment:   "NOT_FOUND",
		OriginalFilename: suspectFileName,
		SHA256Checksum:   checksum,
		DownloadHistory:  []models.DownloadRecord{},
	}

	var foundSecretUUID string

	// 1. If physical file bytes were provided, extract embedded forensic metadata from file
	if len(suspectBytes) > 0 {
		extracted, err := utils.ExtractForensicWatermark(suspectBytes, h.cfg.JWTSecret)
		if err == nil && extracted != nil && extracted.SecretUUID != "" {
			result = extracted
			foundSecretUUID = extracted.SecretUUID
			if result.OriginalFilename == "" && suspectFileName != "" {
				result.OriginalFilename = suspectFileName
			}
			if result.SHA256Checksum == "" && checksum != "" {
				result.SHA256Checksum = checksum
			}
		}
	}

	// 2. If no watermark extracted from file, or if queryStr was provided, use queryStr
	if foundSecretUUID == "" && queryStr != "" {
		foundSecretUUID = queryStr
	}

	// If neither watermark nor secret UUID could be found, log failed/untracked scan and return
	if foundSecretUUID == "" {
		targetName := suspectFileName
		if targetName == "" {
			targetName = queryStr
		}
		if targetName == "" {
			targetName = "Unidentified Asset"
		}

		db.LogActivity(
			actorID,
			actorName,
			"forensic_inspect",
			"failed_scan",
			"untracked",
			targetName,
			fmt.Sprintf("Forensic analysis run by @%s on '%s': INVALID / UNTRACKED (No forensic watermark signature detected)", actorName, targetName),
		)

		result.Matched = false
		result.OriginalFilename = targetName
		result.RiskAssessment = "INVALID_OR_UNTRACKED"
		result.MetadataSummary = "No valid cryptographic forensic watermark or Secret UUID detected in suspect asset."
		result.DownloadHistory = []models.DownloadRecord{}

		utils.RespondJSON(w, http.StatusOK, result)
		return
	}

	// 3. Query files table in database
	var fileID, fileName, ownerID, uploaderName, uploaderEmail, uploaderUsername, mimeType string
	var fileSize int64
	var uploadedAt time.Time
	var forensicMeta sql.NullString

	err := db.DB.QueryRow(`
		SELECT f.id, f.name, f.owner_id, COALESCE(u.name, 'Workspace User'), COALESCE(u.email, 'unknown@eledrive.local'), COALESCE(u.username, 'user'), f.size, f.mime_type, f.created_at, f.forensic_meta
		FROM files f
		LEFT JOIN users u ON f.owner_id = u.id
		WHERE f.secret_uuid = ? OR f.id = ? OR LOWER(f.name) = LOWER(?)
		LIMIT 1
	`, foundSecretUUID, foundSecretUUID, foundSecretUUID).Scan(
		&fileID, &fileName, &ownerID, &uploaderName, &uploaderEmail, &uploaderUsername, &fileSize, &mimeType, &uploadedAt, &forensicMeta,
	)

	if err == nil {
		result.Matched = true
		result.SecretUUID = foundSecretUUID
		result.OriginalFilename = fileName
		result.FileType = mimeType
		result.FileSize = fileSize
		result.UploaderID = ownerID
		result.UploaderName = uploaderName
		result.UploaderEmail = uploaderEmail
		result.UploaderUsername = uploaderUsername
		result.UploadedAt = &uploadedAt
		result.TargetID = fileID
		result.IsFolder = false
		result.RiskAssessment = "LEAK_IDENTIFIED"
		result.SignatureValid = true
		if result.SHA256Checksum == "" && checksum != "" {
			result.SHA256Checksum = checksum
		}
		result.MetadataSummary = fmt.Sprintf("Asset leaked from workspace. Originally uploaded by %s (%s).", uploaderName, uploaderEmail)

		// Fetch download history for this file
		result.DownloadHistory = h.getDownloadHistory(fileID, foundSecretUUID)

		// Record in audit log
		db.LogActivity(
			actorID,
			actorName,
			"forensic_inspect",
			"file",
			fileID,
			fileName,
			fmt.Sprintf("Forensic analysis run by @%s: Leaked asset matched! Uploader: %s (@%s), UUID: %s", actorName, uploaderName, uploaderUsername, foundSecretUUID),
		)

		utils.RespondJSON(w, http.StatusOK, result)
		return
	}

	// 4. Query folders table
	var folderID, folderName, fOwnerID, fUploaderName, fUploaderEmail, fUploaderUsername string
	var fUploadedAt time.Time

	err = db.DB.QueryRow(`
		SELECT f.id, f.name, f.owner_id, COALESCE(u.name, 'Workspace User'), COALESCE(u.email, 'unknown@eledrive.local'), COALESCE(u.username, 'user'), f.created_at
		FROM folders f
		LEFT JOIN users u ON f.owner_id = u.id
		WHERE f.secret_uuid = ? OR f.id = ? OR LOWER(f.name) = LOWER(?) OR LOWER(f.name || '.zip') = LOWER(?)
		LIMIT 1
	`, foundSecretUUID, foundSecretUUID, foundSecretUUID, foundSecretUUID).Scan(
		&folderID, &folderName, &fOwnerID, &fUploaderName, &fUploaderEmail, &fUploaderUsername, &fUploadedAt,
	)

	if err == nil {
		result.Matched = true
		result.SecretUUID = foundSecretUUID
		result.OriginalFilename = folderName + ".zip"
		result.FileType = "application/zip (Folder Archive)"
		if len(suspectBytes) > 0 {
			result.FileSize = int64(len(suspectBytes))
		}
		result.UploaderID = fOwnerID
		result.UploaderName = fUploaderName
		result.UploaderEmail = fUploaderEmail
		result.UploaderUsername = fUploaderUsername
		result.UploadedAt = &fUploadedAt
		result.TargetID = folderID
		result.IsFolder = true
		result.RiskAssessment = "LEAK_IDENTIFIED"
		result.SignatureValid = true
		if result.SHA256Checksum == "" && checksum != "" {
			result.SHA256Checksum = checksum
		}
		result.MetadataSummary = fmt.Sprintf("Folder archive cryptographically verified. Originally created by %s (%s).", fUploaderName, fUploaderEmail)

		result.DownloadHistory = h.getDownloadHistory(folderID, foundSecretUUID)

		// Record in audit log
		db.LogActivity(
			actorID,
			actorName,
			"forensic_inspect",
			"folder",
			folderID,
			folderName,
			fmt.Sprintf("Forensic analysis run by @%s: Leaked folder matched! Creator: %s (@%s), UUID: %s", actorName, fUploaderName, fUploaderUsername, foundSecretUUID),
		)

		utils.RespondJSON(w, http.StatusOK, result)
		return
	}

	// 5. If metadata was extracted from file trailer itself even if deleted from DB
	if result.UploaderEmail != "" {
		result.Matched = true
		result.RiskAssessment = "LEAK_IDENTIFIED"
		if len(suspectBytes) > 0 && result.FileSize == 0 {
			result.FileSize = int64(len(suspectBytes))
		}
		if result.SHA256Checksum == "" && checksum != "" {
			result.SHA256Checksum = checksum
		}
		result.MetadataSummary = fmt.Sprintf("Forensic metadata embedded inside file confirms uploader was %s (%s). (Asset was subsequently removed from workspace database).", result.UploaderName, result.UploaderEmail)

		// Record in audit log
		db.LogActivity(
			actorID,
			actorName,
			"forensic_inspect",
			"forensic",
			foundSecretUUID,
			result.OriginalFilename,
			fmt.Sprintf("Forensic trailer analysis by @%s: Confirmed uploader %s (%s) [UUID: %s]", actorName, result.UploaderName, result.UploaderEmail, foundSecretUUID),
		)

		utils.RespondJSON(w, http.StatusOK, result)
		return
	}

	// 6. Log unmatched forensic scan to activity audit logs
	targetName := suspectFileName
	if targetName == "" {
		targetName = queryStr
	}
	if targetName == "" {
		targetName = foundSecretUUID
	}

	db.LogActivity(
		actorID,
		actorName,
		"forensic_inspect",
		"unmatched_asset",
		foundSecretUUID,
		targetName,
		fmt.Sprintf("Forensic analysis run by @%s for '%s' [Secret UUID: %s - No matching workspace asset found in database]", actorName, targetName, foundSecretUUID),
	)

	result.Matched = false
	result.SecretUUID = foundSecretUUID
	result.OriginalFilename = targetName
	if result.SHA256Checksum == "" && checksum != "" {
		result.SHA256Checksum = checksum
	}
	result.RiskAssessment = "UNMATCHED_ASSET"
	result.MetadataSummary = fmt.Sprintf("Secret UUID '%s' detected, but no matching active asset was found in workspace database.", foundSecretUUID)
	result.DownloadHistory = []models.DownloadRecord{}

	utils.RespondJSON(w, http.StatusOK, result)
}

func (h *AdminHandler) getDownloadHistory(targetID, secretUUID string) []models.DownloadRecord {
	history := make([]models.DownloadRecord, 0)
	rows, err := db.DB.Query(`
		SELECT id, target_type, target_id, COALESCE(secret_uuid, ''), user_id, user_name, user_email, ip_address, user_agent, downloaded_at
		FROM download_logs
		WHERE target_id = ? OR secret_uuid = ?
		ORDER BY downloaded_at DESC
		LIMIT 50
	`, targetID, secretUUID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var rec models.DownloadRecord
			if err := rows.Scan(&rec.ID, &rec.TargetType, &rec.TargetID, &rec.SecretUUID, &rec.UserID, &rec.UserName, &rec.UserEmail, &rec.IPAddress, &rec.UserAgent, &rec.DownloadedAt); err == nil {
				history = append(history, rec)
			}
		}
		if err := rows.Err(); err != nil {
			_ = err
		}
	}
	return history
}

func (h *AdminHandler) GetSecurityStats(w http.ResponseWriter, r *http.Request) {
	var stats models.SecurityStats
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM files WHERE secret_uuid IS NOT NULL AND secret_uuid != ''").Scan(&stats.TotalTrackedFiles)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM folders WHERE secret_uuid IS NOT NULL AND secret_uuid != ''").Scan(&stats.TotalTrackedFolders)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM download_logs").Scan(&stats.TotalDownloadsLogged)

	// Recent downloads
	stats.RecentDownloads = make([]models.DownloadRecord, 0)
	rows, err := db.DB.Query(`
		SELECT id, target_type, target_id, COALESCE(secret_uuid, ''), user_id, user_name, user_email, ip_address, user_agent, downloaded_at
		FROM download_logs
		ORDER BY downloaded_at DESC LIMIT 20
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var rec models.DownloadRecord
			if err := rows.Scan(&rec.ID, &rec.TargetType, &rec.TargetID, &rec.SecretUUID, &rec.UserID, &rec.UserName, &rec.UserEmail, &rec.IPAddress, &rec.UserAgent, &rec.DownloadedAt); err == nil {
				stats.RecentDownloads = append(stats.RecentDownloads, rec)
			}
		}
		if err := rows.Err(); err != nil {
			_ = err
		}
	}

	// Recent tracked files
	stats.RecentTrackedFiles = make([]models.File, 0)
	fRows, err := db.DB.Query(`
		SELECT f.id, f.name, f.original_name, f.folder_id, f.owner_id, u.name, u.email,
		       f.size, f.mime_type, f.extension, f.secret_uuid, f.created_at, f.updated_at
		FROM files f
		JOIN users u ON f.owner_id = u.id
		WHERE f.is_trashed = 0 AND f.secret_uuid IS NOT NULL AND f.secret_uuid != ''
		ORDER BY f.created_at DESC LIMIT 10
	`)
	if err == nil {
		defer fRows.Close()
		for fRows.Next() {
			var fl models.File
			var pID sql.NullString
			if err := fRows.Scan(&fl.ID, &fl.Name, &fl.OriginalName, &pID, &fl.OwnerID, &fl.OwnerName, &fl.OwnerEmail,
				&fl.Size, &fl.MimeType, &fl.Extension, &fl.SecretUUID, &fl.CreatedAt, &fl.UpdatedAt); err == nil {
				if pID.Valid {
					fl.FolderID = &pID.String
				}
				stats.RecentTrackedFiles = append(stats.RecentTrackedFiles, fl)
			}
		}
		if err := fRows.Err(); err != nil {
			_ = err
		}
	}

	utils.RespondJSON(w, http.StatusOK, stats)
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

