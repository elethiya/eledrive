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
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	cfg     *config.Config
	storage *storage.StorageService
}

func NewAuthHandler(cfg *config.Config, storage *storage.StorageService) *AuthHandler {
	return &AuthHandler{cfg: cfg, storage: storage}
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type LoginRequest struct {
	EmailOrUsername string `json:"email_or_username"`
	Password        string `json:"password"`
}

type AuthResponse struct {
	Token string             `json:"token"`
	User  *models.User       `json:"user"`
}

var avatarColors = []string{
	"#3b82f6", "#10b981", "#8b5cf6", "#f59e0b",
	"#ef4444", "#ec4899", "#06b6d4", "#14b8a6",
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Username = strings.TrimSpace(strings.ToLower(req.Username))
	req.Name = strings.TrimSpace(req.Name)

	if req.Email == "" || req.Username == "" || req.Password == "" || req.Name == "" {
		utils.RespondError(w, http.StatusBadRequest, "Email, username, name, and password are required")
		return
	}

	if len(req.Password) < 6 {
		utils.RespondError(w, http.StatusBadRequest, "Password must be at least 6 characters")
		return
	}

	// Check if platform is under maintenance
	if isMaint, notice := db.GetMaintenanceStatus(); isMaint {
		if notice == "" {
			notice = "The platform is currently undergoing scheduled maintenance. Please check back shortly."
		}
		utils.RespondError(w, http.StatusServiceUnavailable, "Registration is currently unavailable: "+notice)
		return
	}

	// Check if email or username already exists
	var existingCount int
	err := db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE email = ? OR username = ?", req.Email, req.Username).Scan(&existingCount)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if existingCount > 0 {
		utils.RespondError(w, http.StatusConflict, "Email or username already in use")
		return
	}

	// Check if public registration is enabled in system settings
	var allowRegStr string
	err = db.DB.QueryRow("SELECT value FROM main.system_settings WHERE key = 'allow_public_registration'").Scan(&allowRegStr)
	if err == nil && (allowRegStr == "false" || allowRegStr == "0") {
		utils.RespondError(w, http.StatusForbidden, "Public user registration is currently disabled by administrator")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	userID := uuid.New().String()
	colorIndex := len(req.Username) % len(avatarColors)
	avatarColor := avatarColors[colorIndex]
	now := time.Now()

	// Check if this is the first user registering in the system
	var totalUsers int
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&totalUsers)

	role := "member"
	status := "pending"

	// Resolve settings for default quota and approval requirement
	quotaGB := int64(10)
	var quotaStr string
	if err := db.DB.QueryRow("SELECT value FROM main.system_settings WHERE key = 'default_quota_gb'").Scan(&quotaStr); err == nil {
		if qVal, err := strconv.ParseInt(quotaStr, 10, 64); err == nil && qVal > 0 {
			quotaGB = qVal
		}
	}
	quotaLimit := quotaGB * 1024 * 1024 * 1024

	var requireApprovalStr string
	if err := db.DB.QueryRow("SELECT value FROM main.system_settings WHERE key = 'require_admin_approval'").Scan(&requireApprovalStr); err == nil {
		if requireApprovalStr == "false" || requireApprovalStr == "0" {
			status = "approved"
		}
	}

	if totalUsers == 0 {
		role = "owner"
		status = "approved"
		quotaLimit = int64(20 * 1024 * 1024 * 1024) // 20 GB for Workspace Owner
	}

	_, err = db.DB.Exec(`
		INSERT INTO users (id, email, username, password_hash, name, avatar_color, role, status, storage_limit, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, userID, req.Email, req.Username, string(hashedPassword), req.Name, avatarColor, role, status, quotaLimit, now, now)

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to create user account")
		return
	}

	user := &models.User{
		ID:           userID,
		Email:        req.Email,
		Username:     req.Username,
		Name:         req.Name,
		AvatarColor:  avatarColor,
		Role:         role,
		Status:       status,
		StorageUsed:  0,
		StorageLimit: quotaLimit,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if status == "approved" {
		// First user becomes Owner and receives active session token
		token, tokenErr := middleware.GenerateToken(userID, req.Username, req.Email, role, h.cfg)
		if tokenErr == nil {
			db.LogActivity(userID, req.Username, "register", "user", userID, req.Name, "First workspace user registered as Workspace Owner")
			utils.RespondJSON(w, http.StatusCreated, map[string]interface{}{
				"success": true,
				"message": "Workspace initialized successfully! You are the Workspace Owner.",
				"status":  "approved",
				"token":   token,
				"user":    user,
			})
			return
		}
	}

	db.LogActivity(userID, req.Username, "register", "user", userID, req.Name, "New account registered (pending administrator approval)")

	utils.RespondJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Account created successfully! Your account is pending administrator verification and approval before you can sign in.",
		"status":  "pending",
		"user":    user,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	req.EmailOrUsername = strings.TrimSpace(strings.ToLower(req.EmailOrUsername))
	if req.EmailOrUsername == "" || req.Password == "" {
		utils.RespondError(w, http.StatusBadRequest, "Email/username and password are required")
		return
	}

	var user models.User
	err := db.DB.QueryRow(`
		SELECT id, email, username, password_hash, name, avatar_color, role, status, storage_used, storage_limit, created_at, updated_at
		FROM users
		WHERE email = ? OR username = ?
	`, req.EmailOrUsername, req.EmailOrUsername).Scan(
		&user.ID, &user.Email, &user.Username, &user.PasswordHash, &user.Name,
		&user.AvatarColor, &user.Role, &user.Status, &user.StorageUsed, &user.StorageLimit,
		&user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		utils.RespondError(w, http.StatusUnauthorized, "Invalid email/username or password")
		return
	} else if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		utils.RespondError(w, http.StatusUnauthorized, "Invalid email/username or password")
		return
	}

	// Verify account status
	if user.Role != "admin" && user.Role != "owner" {
		// Check platform maintenance mode
		if isMaint, notice := db.GetMaintenanceStatus(); isMaint {
			if notice == "" {
				notice = "The platform is currently undergoing scheduled maintenance. Please check back shortly."
			}
			utils.RespondError(w, http.StatusServiceUnavailable, "Platform is currently under maintenance: "+notice)
			return
		}

		switch user.Status {
		case "pending":
			utils.RespondError(w, http.StatusForbidden, "Your account is pending administrator verification and approval. Please wait for an administrator to approve your account.")
			return
		case "rejected":
			utils.RespondError(w, http.StatusForbidden, "Your account registration was rejected by an administrator.")
			return
		}
	}

	// Update storage used
	if updatedUsed, err := h.storage.UpdateUserStorage(user.ID); err == nil {
		user.StorageUsed = updatedUsed
	}

	token, err := middleware.GenerateToken(user.ID, user.Username, user.Email, user.Role, h.cfg)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	db.LogActivity(user.ID, user.Username, "login", "user", user.ID, user.Name, "User logged in successfully")

	utils.RespondJSON(w, http.StatusOK, AuthResponse{
		Token: token,
		User:  &user,
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	if claims == nil {
		utils.RespondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var user models.User
	err := db.DB.QueryRow(`
		SELECT id, email, username, name, avatar_color, role, status, storage_used, storage_limit, created_at, updated_at
		FROM users
		WHERE id = ?
	`, claims.UserID).Scan(
		&user.ID, &user.Email, &user.Username, &user.Name,
		&user.AvatarColor, &user.Role, &user.Status, &user.StorageUsed, &user.StorageLimit,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "User not found")
		return
	}

	if updatedUsed, err := h.storage.UpdateUserStorage(user.ID); err == nil {
		user.StorageUsed = updatedUsed
	}

	utils.RespondJSON(w, http.StatusOK, user)
}

func (h *AuthHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if query == "" {
		utils.RespondJSON(w, http.StatusOK, []models.UserPublic{})
		return
	}

	pattern := "%" + strings.ToLower(query) + "%"
	rows, err := db.DB.Query(`
		SELECT id, email, username, name, avatar_color
		FROM users
		WHERE (LOWER(email) LIKE ? OR LOWER(username) LIKE ? OR LOWER(name) LIKE ?)
		  AND id != ?
		LIMIT 10
	`, pattern, pattern, pattern, claims.UserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to search users")
		return
	}
	defer rows.Close()

	users := make([]models.UserPublic, 0)
	for rows.Next() {
		var u models.UserPublic
		if err := rows.Scan(&u.ID, &u.Email, &u.Username, &u.Name, &u.AvatarColor); err == nil {
			users = append(users, u)
		}
	}
	if err := rows.Err(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to read users")
		return
	}

	utils.RespondJSON(w, http.StatusOK, users)
}

func (h *AuthHandler) ListTeamMembers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query(`
		SELECT id, email, username, name, avatar_color
		FROM users
		ORDER BY name ASC
	`)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to list members")
		return
	}
	defer rows.Close()

	users := make([]models.UserPublic, 0)
	for rows.Next() {
		var u models.UserPublic
		if err := rows.Scan(&u.ID, &u.Email, &u.Username, &u.Name, &u.AvatarColor); err == nil {
			users = append(users, u)
		}
	}
	if err := rows.Err(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to read members")
		return
	}

	utils.RespondJSON(w, http.StatusOK, users)
}

// GetMembers returns the complete workspace member directory with online status, category, and team affiliations
func (h *AuthHandler) GetMembers(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	// 1. Fetch team affiliations for all users
	teamRows, err := db.DB.Query(`
		SELECT tm.user_id, t.id, t.name, COALESCE(tm.role, 'member'), COALESCE(t.avatar_color, '#3b82f6')
		FROM main.team_members tm
		JOIN main.teams t ON tm.team_id = t.id
		ORDER BY t.name ASC
	`)
	userTeamsMap := make(map[string][]models.MemberTeamInfo)
	if err == nil {
		defer teamRows.Close()
		for teamRows.Next() {
			var uid, tid, tname, trole, tcolor string
			if scanErr := teamRows.Scan(&uid, &tid, &tname, &trole, &tcolor); scanErr == nil {
				userTeamsMap[uid] = append(userTeamsMap[uid], models.MemberTeamInfo{
					ID:    tid,
					Name:  tname,
					Role:  trole,
					Color: tcolor,
				})
			}
		}
	}

	// 2. Fetch all approved users
	rows, err := db.DB.Query(`
		SELECT id, email, username, name, avatar_color, role, COALESCE(status, 'approved') AS status,
		       created_at, updated_at
		FROM main.users
		WHERE status = 'approved' OR status IS NULL
		ORDER BY 
			CASE 
				WHEN role = 'owner' THEN 1 
				WHEN role = 'admin' THEN 2 
				ELSE 3 
			END, 
			name ASC
	`)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to fetch workspace members")
		return
	}
	defer rows.Close()

	members := make([]models.WorkspaceMember, 0)
	for rows.Next() {
		var m models.WorkspaceMember
		if err := rows.Scan(
			&m.ID, &m.Email, &m.Username, &m.Name, &m.AvatarColor, &m.Role, &m.Status,
			&m.CreatedAt, &m.UpdatedAt,
		); err == nil {
			// Teams
			teams, ok := userTeamsMap[m.ID]
			if !ok || teams == nil {
				teams = []models.MemberTeamInfo{}
			}
			m.Teams = teams

			// Determine Category: owner, admin, team_member, user
			switch m.Role {
			case "owner":
				m.Category = "owner"
			case "admin":
				m.Category = "admin"
			default:
				if len(m.Teams) > 0 {
					m.Category = "team_member"
				} else {
					m.Category = "user"
				}
			}

			// Online Presence & Last Seen
			m.IsOnline = events.GlobalHub.IsUserOnline(m.ID)
			m.LastSeen = events.GlobalHub.GetUserLastSeen(m.ID)

			// Owner Email Privacy Protection (if caller is not owner and target is owner)
			if claims.Role != "owner" && m.Role == "owner" {
				m.Email = "[Owner Protected]"
			}

			members = append(members, m)
		}
	}

	if err := rows.Err(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to read workspace members")
		return
	}

	utils.RespondJSON(w, http.StatusOK, members)
}

// GetMembersPresence returns map of currently online users
func (h *AuthHandler) GetMembersPresence(w http.ResponseWriter, r *http.Request) {
	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"presence":  events.GlobalHub.GetAllPresence(),
		"timestamp": time.Now().UnixMilli(),
	})
}

type PasswordResetRequestPayload struct {
	EmailOrUsername string `json:"email_or_username"`
	Reason          string `json:"reason"`
}

// RequestPasswordReset creates a password reset request for administrator review
func (h *AuthHandler) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req PasswordResetRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	identifier := strings.TrimSpace(req.EmailOrUsername)
	if identifier == "" {
		utils.RespondError(w, http.StatusBadRequest, "Email or username is required")
		return
	}

	// Check if password reset requests are allowed by system configuration
	var allowResetStr string
	if err := db.DB.QueryRow("SELECT value FROM main.system_settings WHERE key = 'allow_password_reset_requests'").Scan(&allowResetStr); err == nil {
		if allowResetStr == "false" || allowResetStr == "0" {
			utils.RespondError(w, http.StatusForbidden, "Password reset requests are currently disabled by administrator")
			return
		}
	}

	// Ensure table exists safely
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

	var user models.User
	err := db.DB.QueryRow(`
		SELECT id, email, username, name, avatar_color, role, status
		FROM main.users
		WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)
		LIMIT 1
	`, identifier, identifier).Scan(
		&user.ID, &user.Email, &user.Username, &user.Name, &user.AvatarColor, &user.Role, &user.Status,
	)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "No account found matching this email or username")
		return
	}

	if user.Role == "owner" {
		utils.RespondError(w, http.StatusForbidden, "The workspace owner account cannot be reset by administrators. Please use the server-side ownership CLI (ownership.sh) to manage owner credentials.")
		return
	}

	// Check if already has a pending reset request
	var existingID string
	err = db.DB.QueryRow(`
		SELECT id FROM main.password_resets
		WHERE user_id = ? AND status = 'pending'
		LIMIT 1
	`, user.ID).Scan(&existingID)
	if err == nil && existingID != "" {
		utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
			"message":         "A password reset request is already pending administrator review.",
			"already_pending": true,
			"username":        user.Username,
			"email":           user.Email,
		})
		return
	}

	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = "User requested password reset via login portal"
	}

	resetID := uuid.New().String()
	_, err = db.DB.Exec(`
		INSERT INTO main.password_resets (id, user_id, user_name, user_email, user_username, status, reason, created_at)
		VALUES (?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP)
	`, resetID, user.ID, user.Name, user.Email, user.Username, reason)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to submit reset request")
		return
	}

	// Log activity
	db.LogActivity(user.ID, user.Username, "password_reset_request", "user", user.ID, user.Name, fmt.Sprintf("User @%s requested password reset. Reason: %s", user.Username, reason))

	// Broadcast real-time event to active admin panels
	events.Broadcast("admin:password_reset_request", "user", "reset_request", user.ID, user.Name, "", map[string]interface{}{
		"reset_id":  resetID,
		"user_id":   user.ID,
		"username":  user.Username,
		"user_name": user.Name,
		"email":     user.Email,
		"reason":    reason,
	})

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "Password reset request submitted successfully. Workspace administrators have been notified.",
		"username": user.Username,
		"email":    user.Email,
	})
}

func (h *AuthHandler) GetSystemStatus(w http.ResponseWriter, r *http.Request) {
	isMaint, notice := db.GetMaintenanceStatus()
	allowShares, requirePW, defaultExpiry := db.GetPublicSharingSettings()

	var allowRegStr string
	_ = db.DB.QueryRow("SELECT value FROM main.system_settings WHERE key = 'allow_public_registration'").Scan(&allowRegStr)
	allowReg := allowRegStr != "false" && allowRegStr != "0"

	var siteName string
	_ = db.DB.QueryRow("SELECT value FROM main.system_settings WHERE key = 'site_name'").Scan(&siteName)
	if siteName == "" {
		siteName = "EleDrive"
	}

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"maintenance_mode":          isMaint,
		"maintenance_notice":        notice,
		"allow_public_registration": allowReg,
		"site_name":                 siteName,
		"allow_public_shares":       allowShares,
		"require_link_passwords":    requirePW,
		"default_link_expiry_days":  defaultExpiry,
	})
}

