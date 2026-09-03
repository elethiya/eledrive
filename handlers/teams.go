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
	"eledrive/utils"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type TeamHandler struct {
	cfg *config.Config
}

func NewTeamHandler(cfg *config.Config) *TeamHandler {
	return &TeamHandler{cfg: cfg}
}

// ListTeams returns all teams the user belongs to or created
func (h *TeamHandler) ListTeams(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	rows, err := db.DB.Query(`
		SELECT t.id, t.name, t.description, t.avatar_color, t.created_by_user_id, u.name as creator_name,
		       (SELECT COUNT(*) FROM main.team_members WHERE team_id = t.id) as members_count,
		       COALESCE(tm.role, CASE WHEN t.created_by_user_id = ? THEN 'leader' ELSE 'member' END) as user_role,
		       t.created_at, t.updated_at
		FROM main.teams t
		JOIN main.users u ON t.created_by_user_id = u.id
		LEFT JOIN main.team_members tm ON tm.team_id = t.id AND tm.user_id = ?
		WHERE t.created_by_user_id = ? OR tm.user_id = ?
		ORDER BY t.updated_at DESC
	`, claims.UserID, claims.UserID, claims.UserID, claims.UserID)

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to fetch teams")
		return
	}
	defer rows.Close()

	teams := make([]models.Team, 0)
	for rows.Next() {
		var tm models.Team
		var desc sql.NullString
		if err := rows.Scan(
			&tm.ID, &tm.Name, &desc, &tm.AvatarColor, &tm.CreatedByUserID, &tm.CreatorName,
			&tm.MembersCount, &tm.UserRole, &tm.CreatedAt, &tm.UpdatedAt,
		); err == nil {
			if desc.Valid {
				tm.Description = desc.String
			}
			teams = append(teams, tm)
		}
	}

	utils.RespondJSON(w, http.StatusOK, teams)
}

// CreateTeam creates a new team and adds the creator as leader
func (h *TeamHandler) CreateTeam(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	var req models.CreateTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		utils.RespondError(w, http.StatusBadRequest, "Team name cannot be empty")
		return
	}

	color := strings.TrimSpace(req.AvatarColor)
	if color == "" {
		color = "#3b82f6"
	}

	teamID := uuid.New().String()
	now := time.Now().UTC().Truncate(time.Second)

	tx, err := db.DB.Begin()
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to start transaction")
		return
	}
	defer tx.Rollback()

	// Insert team
	_, err = tx.Exec(`
		INSERT INTO main.teams (id, name, description, avatar_color, created_by_user_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, teamID, name, req.Description, color, claims.UserID, now, now)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to create team")
		return
	}

	// Insert creator as leader
	memberID := uuid.New().String()
	_, err = tx.Exec(`
		INSERT INTO main.team_members (id, team_id, user_id, role, joined_at)
		VALUES (?, ?, ?, 'leader', ?)
	`, memberID, teamID, claims.UserID, now)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to add creator as team leader")
		return
	}

	if err := tx.Commit(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to commit team creation")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "create_team", "team", teamID, name, fmt.Sprintf("Created team '%s'", name))

	team := models.Team{
		ID:              teamID,
		Name:            name,
		Description:     req.Description,
		AvatarColor:     color,
		CreatedByUserID: claims.UserID,
		MembersCount:    1,
		UserRole:        "leader",
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	utils.RespondJSON(w, http.StatusCreated, team)
}

// GetTeam returns details and members of a team
func (h *TeamHandler) GetTeam(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	teamID := chi.URLParam(r, "id")

	var tm models.Team
	var desc sql.NullString

	err := db.DB.QueryRow(`
		SELECT t.id, t.name, t.description, t.avatar_color, t.created_by_user_id, u.name as creator_name,
		       t.created_at, t.updated_at
		FROM main.teams t
		JOIN main.users u ON t.created_by_user_id = u.id
		WHERE t.id = ?
	`, teamID).Scan(
		&tm.ID, &tm.Name, &desc, &tm.AvatarColor, &tm.CreatedByUserID, &tm.CreatorName,
		&tm.CreatedAt, &tm.UpdatedAt,
	)

	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Team not found")
		return
	}
	if desc.Valid {
		tm.Description = desc.String
	}

	// Check if user is member or admin/owner
	var userRole string
	_ = db.DB.QueryRow(`
		SELECT role FROM main.team_members WHERE team_id = ? AND user_id = ?
	`, teamID, claims.UserID).Scan(&userRole)

	if userRole == "" && tm.CreatedByUserID != claims.UserID && claims.Role != "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "You are not a member of this team")
		return
	}
	if userRole == "" && tm.CreatedByUserID == claims.UserID {
		userRole = "leader"
	}
	tm.UserRole = userRole

	// Fetch members
	membersRows, err := db.DB.Query(`
		SELECT tm.id, tm.team_id, tm.user_id, u.name, u.username, u.email, u.avatar_color, tm.role, tm.joined_at
		FROM main.team_members tm
		JOIN main.users u ON tm.user_id = u.id
		WHERE tm.team_id = ?
		ORDER BY CASE tm.role WHEN 'leader' THEN 1 ELSE 2 END, u.name ASC
	`, teamID)

	tm.Members = make([]models.TeamMember, 0)
	if err == nil {
		defer membersRows.Close()
		for membersRows.Next() {
			var m models.TeamMember
			if err := membersRows.Scan(&m.ID, &m.TeamID, &m.UserID, &m.Name, &m.Username, &m.Email, &m.AvatarColor, &m.Role, &m.JoinedAt); err == nil {
				tm.Members = append(tm.Members, m)
			}
		}
	}
	tm.MembersCount = len(tm.Members)

	utils.RespondJSON(w, http.StatusOK, tm)
}

// AddMember adds a user to a team
func (h *TeamHandler) AddMember(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	teamID := chi.URLParam(r, "id")

	// Verify permissions: caller must be leader, creator, or workspace admin/owner
	var creatorID string
	var callerRole string
	_ = db.DB.QueryRow("SELECT created_by_user_id FROM main.teams WHERE id = ?", teamID).Scan(&creatorID)
	_ = db.DB.QueryRow("SELECT role FROM main.team_members WHERE team_id = ? AND user_id = ?", teamID, claims.UserID).Scan(&callerRole)

	if creatorID != claims.UserID && callerRole != "leader" && claims.Role != "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only team leaders or workspace admins can add members")
		return
	}

	var req models.AddTeamMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	// Resolve target user
	var targetUser models.UserPublic
	var err error
	if req.UserID != "" {
		err = db.DB.QueryRow("SELECT id, email, username, name, avatar_color FROM main.users WHERE id = ?", req.UserID).
			Scan(&targetUser.ID, &targetUser.Email, &targetUser.Username, &targetUser.Name, &targetUser.AvatarColor)
	} else if req.UserEmail != "" {
		err = db.DB.QueryRow("SELECT id, email, username, name, avatar_color FROM main.users WHERE LOWER(email) = ?", strings.ToLower(strings.TrimSpace(req.UserEmail))).
			Scan(&targetUser.ID, &targetUser.Email, &targetUser.Username, &targetUser.Name, &targetUser.AvatarColor)
	} else {
		utils.RespondError(w, http.StatusBadRequest, "User ID or email is required")
		return
	}

	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "User not found")
		return
	}

	role := "member"
	if req.Role == "leader" {
		role = "leader"
	}

	memberID := uuid.New().String()
	now := time.Now().UTC().Truncate(time.Second)

	_, err = db.DB.Exec(`
		INSERT INTO main.team_members (id, team_id, user_id, role, joined_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(team_id, user_id) DO UPDATE SET role = excluded.role
	`, memberID, teamID, targetUser.ID, role, now)

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to add member to team")
		return
	}

	// Update team updated_at
	_, _ = db.DB.Exec("UPDATE main.teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", teamID)

	db.LogActivity(claims.UserID, claims.Username, "add_team_member", "team", teamID, targetUser.Name, fmt.Sprintf("Added %s to team", targetUser.Name))

	utils.RespondSuccess(w, http.StatusOK, "Member added to team", models.TeamMember{
		ID:          memberID,
		TeamID:      teamID,
		UserID:      targetUser.ID,
		Name:        targetUser.Name,
		Username:    targetUser.Username,
		Email:       targetUser.Email,
		AvatarColor: targetUser.AvatarColor,
		Role:        role,
		JoinedAt:    now,
	})
}

// RemoveMember removes a member from a team
func (h *TeamHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	teamID := chi.URLParam(r, "id")
	targetUserID := chi.URLParam(r, "userId")

	var creatorID string
	var callerRole string
	_ = db.DB.QueryRow("SELECT created_by_user_id FROM main.teams WHERE id = ?", teamID).Scan(&creatorID)
	_ = db.DB.QueryRow("SELECT role FROM main.team_members WHERE team_id = ? AND user_id = ?", teamID, claims.UserID).Scan(&callerRole)

	// User can remove themselves (leave team) or leader/admin can remove them
	if targetUserID != claims.UserID && creatorID != claims.UserID && callerRole != "leader" && claims.Role != "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "No permission to remove member from team")
		return
	}

	_, err := db.DB.Exec("DELETE FROM main.team_members WHERE team_id = ? AND user_id = ?", teamID, targetUserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to remove member")
		return
	}

	_, _ = db.DB.Exec("UPDATE main.teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", teamID)
	utils.RespondSuccess(w, http.StatusOK, "Member removed from team", nil)
}

// DeleteTeam deletes a team
func (h *TeamHandler) DeleteTeam(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	teamID := chi.URLParam(r, "id")

	var creatorID, teamName string
	err := db.DB.QueryRow("SELECT created_by_user_id, name FROM main.teams WHERE id = ?", teamID).Scan(&creatorID, &teamName)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Team not found")
		return
	}

	if creatorID != claims.UserID && claims.Role != "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only the team creator or workspace admin can delete this team")
		return
	}

	_, _ = db.DB.Exec("DELETE FROM main.team_members WHERE team_id = ?", teamID)
	_, _ = db.DB.Exec("DELETE FROM drive.team_shares WHERE team_id = ?", teamID)
	_, err = db.DB.Exec("DELETE FROM main.teams WHERE id = ?", teamID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to delete team")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "delete_team", "team", teamID, teamName, fmt.Sprintf("Deleted team '%s'", teamName))
	utils.RespondSuccess(w, http.StatusOK, "Team deleted successfully", nil)
}

// GetAvailableUsers lists all approved users in the workspace to pick when creating/adding to teams
func (h *TeamHandler) GetAvailableUsers(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	rows, err := db.DB.Query(`
		SELECT id, email, username, name, avatar_color
		FROM main.users
		WHERE status = 'approved' AND id != ?
		ORDER BY name ASC
	`, claims.UserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to fetch users")
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
