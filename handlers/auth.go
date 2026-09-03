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
	var allowReg bool
	err = db.DB.QueryRow("SELECT allow_public_registration FROM system_settings WHERE id = 'default'").Scan(&allowReg)
	if err == nil && !allowReg {
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
	quotaLimit := int64(10 * 1024 * 1024 * 1024) // 10 GB

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
		if user.Status == "pending" {
			utils.RespondError(w, http.StatusForbidden, "Your account is pending administrator verification and approval. Please wait for an administrator to approve your account.")
			return
		} else if user.Status == "rejected" {
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

	utils.RespondJSON(w, http.StatusOK, users)
}
