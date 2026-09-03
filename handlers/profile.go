package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"eledrive/db"
	"eledrive/events"
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

// UpdateSelfStorageLimit allows the Workspace Owner to change their own storage limit
func (h *ProfileHandler) UpdateSelfStorageLimit(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	if claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only the workspace Owner can change their self storage limit")
		return
	}

	var req struct {
		StorageLimitGB int64 `json:"storage_limit_gb"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.StorageLimitGB <= 0 {
		utils.RespondError(w, http.StatusBadRequest, "Invalid storage limit")
		return
	}

	limitBytes := req.StorageLimitGB * 1024 * 1024 * 1024
	_, err := db.DB.Exec("UPDATE users SET storage_limit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", limitBytes, claims.UserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update storage limit")
		return
	}

	events.Broadcast("storage:update", "storage", "update", claims.UserID, "", claims.UserID, map[string]interface{}{
		"storage_limit": limitBytes,
	})

	db.LogActivity(claims.UserID, claims.Username, "update_self_storage_limit", "user", claims.UserID, claims.Username, fmt.Sprintf("Owner updated self storage limit to %d GB", req.StorageLimitGB))

	utils.RespondSuccess(w, http.StatusOK, "Self storage limit updated successfully", map[string]interface{}{
		"storage_limit": limitBytes,
	})
}
