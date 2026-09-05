package handlers

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"eledrive/config"
	"eledrive/db"
	"eledrive/middleware"
	"eledrive/models"
	"eledrive/utils"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type ForensicHandler struct {
	cfg *config.Config
}

func NewForensicHandler(cfg *config.Config) *ForensicHandler {
	return &ForensicHandler{cfg: cfg}
}

// GetAccess returns current user's forensic permission status, policy, and active grant
func (h *ForensicHandler) GetAccess(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	if claims == nil {
		utils.RespondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var policy string
	_ = db.DB.QueryRow("SELECT value FROM main.system_settings WHERE key = 'forensic_access_policy'").Scan(&policy)
	if policy == "" {
		policy = "owner_only"
	}

	hasAccess, reason, grant := db.CheckForensicAccess(claims.UserID, claims.Role)

	resp := models.ForensicAccessStatus{
		HasAccess:   hasAccess,
		Reason:      reason,
		Policy:      policy,
		IsOwner:     claims.Role == "owner",
		ActiveGrant: grant,
	}
	if grant != nil && grant.ExpiresAt != nil {
		resp.ExpiresAt = grant.ExpiresAt
	}

	utils.RespondJSON(w, http.StatusOK, resp)
}

// UpdatePolicy sets the global forensic access policy (Owner only)
func (h *ForensicHandler) UpdatePolicy(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only the Workspace Owner can configure forensic access policy")
		return
	}

	var req models.UpdateForensicPolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	validPolicies := map[string]bool{
		"owner_only": true,
		"admins":     true,
		"all_users":  true,
		"custom":     true,
	}
	if !validPolicies[req.Policy] {
		utils.RespondError(w, http.StatusBadRequest, "Invalid policy. Options: 'owner_only', 'admins', 'all_users', 'custom'")
		return
	}

	_, err := db.DB.Exec(`
		INSERT INTO main.system_settings (key, value, updated_at)
		VALUES ('forensic_access_policy', ?, CURRENT_TIMESTAMP)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
	`, req.Policy)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update forensic access policy")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "forensic_policy_update", "system", "settings", "Forensic Access Policy", fmt.Sprintf("Owner set forensic access policy to '%s'", req.Policy))

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"policy":  req.Policy,
		"message": "Forensic access policy updated successfully",
	})
}

// ListGrants lists all specific forensic grants (Owner only)
func (h *ForensicHandler) ListGrants(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only the Workspace Owner can view forensic access grants")
		return
	}

	rows, err := db.DB.Query(`
		SELECT g.id, g.user_id, COALESCE(u.name, 'Unknown'), COALESCE(u.email, ''), COALESCE(u.username, ''),
		       COALESCE(u.avatar_color, '#3b82f6'), COALESCE(u.role, 'member'),
		       g.granted_by_user_id, COALESCE(gu.name, 'Owner'), g.expires_at, COALESCE(g.notes, ''), g.created_at
		FROM main.forensic_access_grants g
		LEFT JOIN main.users u ON g.user_id = u.id
		LEFT JOIN main.users gu ON g.granted_by_user_id = gu.id
		ORDER BY g.created_at DESC
	`)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to fetch forensic access grants")
		return
	}
	defer rows.Close()

	grants := make([]models.ForensicAccessGrant, 0)
	now := time.Now()
	for rows.Next() {
		var g models.ForensicAccessGrant
		var exp sql.NullTime
		if err := rows.Scan(
			&g.ID, &g.UserID, &g.UserName, &g.UserEmail, &g.UserUsername,
			&g.AvatarColor, &g.UserRole,
			&g.GrantedByUserID, &g.GrantedByName, &exp, &g.Notes, &g.CreatedAt,
		); err == nil {
			if exp.Valid {
				g.ExpiresAt = &exp.Time
				if exp.Time.Before(now) {
					g.IsExpired = true
				}
			}
			grants = append(grants, g)
		}
	}

	utils.RespondJSON(w, http.StatusOK, grants)
}

// CreateOrUpdateGrant issues or updates forensic tool access for any user (Owner only)
func (h *ForensicHandler) CreateOrUpdateGrant(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only the Workspace Owner can grant forensic access")
		return
	}

	var req models.CreateForensicGrantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	req.UserID = strings.TrimSpace(req.UserID)
	if req.UserID == "" {
		utils.RespondError(w, http.StatusBadRequest, "Target user ID is required")
		return
	}

	// Verify target user exists
	var targetName, targetUsername, targetEmail string
	err := db.DB.QueryRow("SELECT name, username, email FROM main.users WHERE id = ?", req.UserID).Scan(&targetName, &targetUsername, &targetEmail)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Target user not found")
		return
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil && strings.TrimSpace(*req.ExpiresAt) != "" {
		rawStr := strings.TrimSpace(*req.ExpiresAt)
		// Support both RFC3339 ("2026-09-05T20:30:00Z") and local datetime ("2026-09-05T20:30")
		parsed, parseErr := time.Parse(time.RFC3339, rawStr)
		if parseErr != nil {
			parsed, parseErr = time.Parse("2006-01-02T15:04", rawStr)
		}
		if parseErr != nil {
			parsed, parseErr = time.Parse("2006-01-02 15:04:05", rawStr)
		}
		if parseErr != nil {
			utils.RespondError(w, http.StatusBadRequest, "Invalid expiration date/time format. Use ISO 8601 or RFC3339.")
			return
		}
		expiresAt = &parsed
	}

	// Delete any previous active grant for this user to keep a single clean grant record
	_, _ = db.DB.Exec("DELETE FROM main.forensic_access_grants WHERE user_id = ?", req.UserID)

	grantID := uuid.New().String()
	_, err = db.DB.Exec(`
		INSERT INTO main.forensic_access_grants (id, user_id, granted_by_user_id, expires_at, notes, created_at)
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`, grantID, req.UserID, claims.UserID, expiresAt, req.Notes)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to grant forensic access")
		return
	}

	timeStr := "Forever (Permanent)"
	if expiresAt != nil {
		timeStr = "until " + expiresAt.Format("2006-01-02 15:04:05 MST")
	}

	db.LogActivity(
		claims.UserID,
		claims.Username,
		"forensic_grant",
		"user",
		req.UserID,
		targetName,
		fmt.Sprintf("Owner granted forensic tools access to %s (@%s) %s", targetName, targetUsername, timeStr),
	)

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success":    true,
		"grant_id":   grantID,
		"user_id":    req.UserID,
		"user_name":  targetName,
		"expires_at": expiresAt,
		"message":    fmt.Sprintf("Forensic access granted to %s (%s)", targetName, timeStr),
	})
}

// RevokeGrant deletes a forensic access grant (Owner only)
func (h *ForensicHandler) RevokeGrant(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	if claims == nil || claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only the Workspace Owner can revoke forensic access")
		return
	}

	targetID := chi.URLParam(r, "id")
	if targetID == "" {
		utils.RespondError(w, http.StatusBadRequest, "Grant ID or User ID is required")
		return
	}

	var targetUserName string
	_ = db.DB.QueryRow(`
		SELECT COALESCE(u.name, 'User')
		FROM main.forensic_access_grants g
		LEFT JOIN main.users u ON g.user_id = u.id
		WHERE g.id = ? OR g.user_id = ?
		LIMIT 1
	`, targetID, targetID).Scan(&targetUserName)

	res, err := db.DB.Exec("DELETE FROM main.forensic_access_grants WHERE id = ? OR user_id = ?", targetID, targetID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to revoke forensic access")
		return
	}

	rowsAff, _ := res.RowsAffected()
	if rowsAff == 0 {
		utils.RespondError(w, http.StatusNotFound, "No matching forensic access grant found")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "forensic_revoke", "grant", targetID, targetUserName, fmt.Sprintf("Owner revoked forensic access for %s", targetUserName))

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Forensic access revoked successfully",
	})
}

// Inspect analyzes a suspect file or secret UUID to uncover who leaked it (Authorized users)
func (h *ForensicHandler) Inspect(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	if claims == nil {
		utils.RespondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	hasAccess, _, _ := db.CheckForensicAccess(claims.UserID, claims.Role)
	if !hasAccess {
		utils.RespondError(w, http.StatusForbidden, "You do not have permission to access forensic leak tools. Contact Workspace Owner for access.")
		return
	}

	actorID := claims.UserID
	actorName := claims.Username
	if actorName == "" {
		actorName = "User"
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
		var req struct {
			Query string `json:"query"`
		}
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

		if result.LeakerIdentified {
			if result.AccessType == "BROWSER_VIEW" {
				result.MetadataSummary = fmt.Sprintf("CONFIRMED LEAK: Loaded in browser preview by %s (@%s - %s) on %s and exfiltrated via right-click save or browser tool.", result.LeakerName, result.LeakerUsername, result.LeakerEmail, result.AccessedAt.Format("2006-01-02 15:04:05 MST"))
			} else if result.AccessType == "DIRECT_DOWNLOAD" {
				result.MetadataSummary = fmt.Sprintf("CONFIRMED LEAK: Directly downloaded from workspace by %s (@%s - %s) on %s.", result.LeakerName, result.LeakerUsername, result.LeakerEmail, result.AccessedAt.Format("2006-01-02 15:04:05 MST"))
			}
		} else {
			result.MetadataSummary = fmt.Sprintf("Asset registered in workspace (Owner: %s). To pinpoint the exact leaker, upload the suspect leaked file to verify its embedded cryptographic access trailer.", uploaderName)
			result.ExfiltrationVerdict = "No physical suspect file uploaded for cryptographic trailer extraction. Showing registered workspace details and download/view history."
		}

		// Download history
		result.DownloadHistory = h.getDownloadHistory(fileID, foundSecretUUID)

		db.LogActivity(
			actorID,
			actorName,
			"forensic_inspect",
			"file",
			fileID,
			fileName,
			fmt.Sprintf("Forensic analysis run by @%s identified leaked file '%s' [Secret UUID: %s, Uploader: %s]", actorName, fileName, foundSecretUUID, uploaderName),
		)

		utils.RespondJSON(w, http.StatusOK, result)
		return
	}

	// 4. Query folders table in database
	var folderID, folderName, folderOwnerID, fUploaderName, fUploaderEmail, fUploaderUsername string
	var folderCreatedAt time.Time
	err = db.DB.QueryRow(`
		SELECT f.id, f.name, f.user_id, COALESCE(u.name, 'Workspace User'), COALESCE(u.email, 'unknown@eledrive.local'), COALESCE(u.username, 'user'), f.created_at
		FROM folders f
		LEFT JOIN users u ON f.user_id = u.id
		WHERE f.secret_uuid = ? OR f.id = ? OR LOWER(f.name) = LOWER(?)
		LIMIT 1
	`, foundSecretUUID, foundSecretUUID, foundSecretUUID).Scan(
		&folderID, &folderName, &folderOwnerID, &fUploaderName, &fUploaderEmail, &fUploaderUsername, &folderCreatedAt,
	)

	if err == nil {
		result.Matched = true
		result.SecretUUID = foundSecretUUID
		result.OriginalFilename = folderName
		result.FileType = "application/x-directory"
		result.UploaderID = folderOwnerID
		result.UploaderName = fUploaderName
		result.UploaderEmail = fUploaderEmail
		result.UploaderUsername = fUploaderUsername
		result.UploadedAt = &folderCreatedAt
		result.TargetID = folderID
		result.IsFolder = true
		result.RiskAssessment = "LEAK_IDENTIFIED"
		result.SignatureValid = true
		if result.SHA256Checksum == "" && checksum != "" {
			result.SHA256Checksum = checksum
		}

		if result.LeakerIdentified {
			result.MetadataSummary = fmt.Sprintf("CONFIRMED LEAK: Folder export / ZIP exfiltrated by %s (@%s - %s) on %s.", result.LeakerName, result.LeakerUsername, result.LeakerEmail, result.AccessedAt.Format("2006-01-02 15:04:05 MST"))
		} else {
			result.MetadataSummary = fmt.Sprintf("Folder registered in workspace (Owner: %s).", fUploaderName)
		}

		result.DownloadHistory = h.getDownloadHistory(folderID, foundSecretUUID)

		db.LogActivity(
			actorID,
			actorName,
			"forensic_inspect",
			"folder",
			folderID,
			folderName,
			fmt.Sprintf("Forensic analysis run by @%s identified leaked folder '%s' [Secret UUID: %s]", actorName, folderName, foundSecretUUID),
		)

		utils.RespondJSON(w, http.StatusOK, result)
		return
	}

	// 5. Query download_logs
	var logTargetType, logTargetID, logUserName, logUserEmail string
	var logDownloadedAt time.Time
	err = db.DB.QueryRow(`
		SELECT target_type, target_id, user_name, user_email, downloaded_at
		FROM download_logs
		WHERE secret_uuid = ?
		ORDER BY downloaded_at DESC LIMIT 1
	`, foundSecretUUID).Scan(&logTargetType, &logTargetID, &logUserName, &logUserEmail, &logDownloadedAt)

	if err == nil {
		result.Matched = true
		result.SecretUUID = foundSecretUUID
		result.OriginalFilename = fmt.Sprintf("Exfiltrated %s (%s)", logTargetType, logTargetID)
		result.UploaderName = logUserName
		result.UploaderEmail = logUserEmail
		result.UploadedAt = &logDownloadedAt
		result.TargetID = logTargetID
		result.RiskAssessment = "LEAK_IDENTIFIED"
		result.SignatureValid = true
		if result.SHA256Checksum == "" && checksum != "" {
			result.SHA256Checksum = checksum
		}
		result.MetadataSummary = fmt.Sprintf("Historical download event found in security audit logs. User '%s' downloaded this asset on %s.", logUserName, logDownloadedAt.Format("2006-01-02 15:04:05"))
		result.DownloadHistory = h.getDownloadHistory(logTargetID, foundSecretUUID)

		db.LogActivity(
			actorID,
			actorName,
			"forensic_inspect",
			"download_log",
			logTargetID,
			foundSecretUUID,
			fmt.Sprintf("Forensic analysis run by @%s matched Secret UUID '%s' in download ledger", actorName, foundSecretUUID),
		)

		utils.RespondJSON(w, http.StatusOK, result)
		return
	}

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

func (h *ForensicHandler) getDownloadHistory(targetID, secretUUID string) []models.DownloadRecord {
	history := make([]models.DownloadRecord, 0)
	rows, err := db.DB.Query(`
		SELECT id, target_type, target_id, COALESCE(secret_uuid, ''), user_id, user_name, user_email, ip_address, user_agent, COALESCE(access_type, 'download'), downloaded_at
		FROM download_logs
		WHERE target_id = ? OR secret_uuid = ?
		ORDER BY downloaded_at DESC
		LIMIT 50
	`, targetID, secretUUID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var rec models.DownloadRecord
			if err := rows.Scan(&rec.ID, &rec.TargetType, &rec.TargetID, &rec.SecretUUID, &rec.UserID, &rec.UserName, &rec.UserEmail, &rec.IPAddress, &rec.UserAgent, &rec.AccessType, &rec.DownloadedAt); err == nil {
				history = append(history, rec)
			}
		}
	}
	return history
}

// GetStats returns security stats, tracked files count, and recent download history (Authorized users)
func (h *ForensicHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	if claims == nil {
		utils.RespondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	hasAccess, _, _ := db.CheckForensicAccess(claims.UserID, claims.Role)
	if !hasAccess {
		utils.RespondError(w, http.StatusForbidden, "You do not have permission to access forensic tools. Contact Workspace Owner for access.")
		return
	}

	var stats models.SecurityStats
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM files WHERE secret_uuid IS NOT NULL AND secret_uuid != ''").Scan(&stats.TotalTrackedFiles)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM folders WHERE secret_uuid IS NOT NULL AND secret_uuid != ''").Scan(&stats.TotalTrackedFolders)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM download_logs").Scan(&stats.TotalDownloadsLogged)

	// Recent downloads
	stats.RecentDownloads = make([]models.DownloadRecord, 0)
	rows, err := db.DB.Query(`
		SELECT id, target_type, target_id, COALESCE(secret_uuid, ''), user_id, user_name, user_email, ip_address, user_agent, COALESCE(access_type, 'download'), downloaded_at
		FROM download_logs
		ORDER BY downloaded_at DESC LIMIT 20
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var rec models.DownloadRecord
			if err := rows.Scan(&rec.ID, &rec.TargetType, &rec.TargetID, &rec.SecretUUID, &rec.UserID, &rec.UserName, &rec.UserEmail, &rec.IPAddress, &rec.UserAgent, &rec.AccessType, &rec.DownloadedAt); err == nil {
				stats.RecentDownloads = append(stats.RecentDownloads, rec)
			}
		}
	}

	// Recent tracked files
	stats.RecentTrackedFiles = make([]models.File, 0)
	fRows, err := db.DB.Query(`
		SELECT id, name, size, mime_type, secret_uuid, created_at, updated_at
		FROM files
		WHERE secret_uuid IS NOT NULL AND secret_uuid != ''
		ORDER BY created_at DESC LIMIT 20
	`)
	if err == nil {
		defer fRows.Close()
		for fRows.Next() {
			var f models.File
			var sUUID sql.NullString
			if err := fRows.Scan(&f.ID, &f.Name, &f.Size, &f.MimeType, &sUUID, &f.CreatedAt, &f.UpdatedAt); err == nil {
				if sUUID.Valid {
					f.SecretUUID = sUUID.String
				}
				stats.RecentTrackedFiles = append(stats.RecentTrackedFiles, f)
			}
		}
	}

	utils.RespondJSON(w, http.StatusOK, stats)
}
