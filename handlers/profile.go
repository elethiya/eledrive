package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"eledrive/db"
	"eledrive/middleware"
	"eledrive/utils"
	"golang.org/x/crypto/bcrypt"
)

type ProfileHandler struct{}

func NewProfileHandler() *ProfileHandler {
	return &ProfileHandler{}
}

type UpdateProfileRequest struct {
	Name        string `json:"name"`
	AvatarColor string `json:"avatar_color"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (h *ProfileHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		utils.RespondError(w, http.StatusBadRequest, "Name cannot be empty")
		return
	}

	if req.AvatarColor == "" {
		req.AvatarColor = "#3b82f6"
	}

	_, err := db.DB.Exec(`
		UPDATE users 
		SET name = ?, avatar_color = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`, req.Name, req.AvatarColor, claims.UserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update profile")
		return
	}

	db.LogActivity(claims.UserID, req.Name, "profile_update", "user", claims.UserID, req.Name, "Updated display name / avatar")

	utils.RespondSuccess(w, http.StatusOK, "Profile updated successfully", map[string]string{
		"name":         req.Name,
		"avatar_color": req.AvatarColor,
	})
}

func (h *ProfileHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		utils.RespondError(w, http.StatusBadRequest, "Current password and new password are required")
		return
	}

	if len(req.NewPassword) < 6 {
		utils.RespondError(w, http.StatusBadRequest, "New password must be at least 6 characters")
		return
	}

	var currentHash string
	err := db.DB.QueryRow("SELECT password_hash FROM users WHERE id = ?", claims.UserID).Scan(&currentHash)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "User not found")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(req.CurrentPassword)); err != nil {
		utils.RespondError(w, http.StatusUnauthorized, "Current password is incorrect")
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to hash new password")
		return
	}

	_, err = db.DB.Exec(`
		UPDATE users 
		SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`, string(newHash), claims.UserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "password_change", "user", claims.UserID, claims.Username, "Changed account password")

	utils.RespondSuccess(w, http.StatusOK, "Password changed successfully", nil)
}
