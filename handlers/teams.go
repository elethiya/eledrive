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
	"eledrive/events"
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

// ListTeams returns all teams the user belongs to or created, or all teams in workspace if caller is owner
func (h *TeamHandler) ListTeams(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	var rows *sql.Rows
	var err error

	if claims.Role == "owner" {
		rows, err = db.DB.Query(`
			SELECT t.id, t.name, t.description, t.avatar_color, t.created_by_user_id, u.name as creator_name, COALESCE(u.username, '') as creator_username, u.role as creator_role,
			       (SELECT COUNT(*) FROM main.team_members WHERE team_id = t.id) as members_count,
			       COALESCE(tm.role, CASE WHEN t.created_by_user_id = ? THEN 'leader' ELSE 'owner' END) as user_role,
			       t.created_at, t.updated_at
			FROM main.teams t
			JOIN main.users u ON t.created_by_user_id = u.id
			LEFT JOIN main.team_members tm ON tm.team_id = t.id AND tm.user_id = ?
			ORDER BY t.updated_at DESC
		`, claims.UserID, claims.UserID)
	} else {
		rows, err = db.DB.Query(`
			SELECT t.id, t.name, t.description, t.avatar_color, t.created_by_user_id, u.name as creator_name, COALESCE(u.username, '') as creator_username, u.role as creator_role,
			       (SELECT COUNT(*) FROM main.team_members WHERE team_id = t.id) as members_count,
			       COALESCE(tm.role, CASE WHEN t.created_by_user_id = ? THEN 'leader' ELSE 'member' END) as user_role,
			       t.created_at, t.updated_at
			FROM main.teams t
			JOIN main.users u ON t.created_by_user_id = u.id
			LEFT JOIN main.team_members tm ON tm.team_id = t.id AND tm.user_id = ?
			WHERE t.created_by_user_id = ? OR tm.user_id = ?
			ORDER BY t.updated_at DESC
		`, claims.UserID, claims.UserID, claims.UserID, claims.UserID)
	}

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
			&tm.ID, &tm.Name, &desc, &tm.AvatarColor, &tm.CreatedByUserID, &tm.CreatorName, &tm.CreatorUsername, &tm.CreatorRole,
			&tm.MembersCount, &tm.UserRole, &tm.CreatedAt, &tm.UpdatedAt,
		); err == nil {
			if desc.Valid {
				tm.Description = desc.String
			}
			teams = append(teams, tm)
		}
	}
	if err := rows.Err(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to read teams")
		return
	}

	utils.RespondJSON(w, http.StatusOK, teams)
}

// RequestTeam allows any user to submit a team creation request for administrator review
func (h *TeamHandler) RequestTeam(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	var req models.SubmitTeamRequestPayload
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

	if req.InitialMembers == nil {
		req.InitialMembers = make([]string, 0)
	}
	membersJSON, _ := json.Marshal(req.InitialMembers)
	requestID := uuid.New().String()
	now := time.Now().UTC().Truncate(time.Second)

	var requesterName string
	_ = db.DB.QueryRow("SELECT name FROM main.users WHERE id = ?", claims.UserID).Scan(&requesterName)
	if requesterName == "" {
		requesterName = claims.Username
	}

	_, err := db.DB.Exec(`
		INSERT INTO main.team_requests (id, user_id, user_name, user_email, user_username, name, description, avatar_color, initial_members, status, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
	`, requestID, claims.UserID, requesterName, claims.Email, claims.Username, name, req.Description, color, string(membersJSON), now)

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to submit team request")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "request_team", "team_request", requestID, name, fmt.Sprintf("Submitted request to create team '%s'", name))

	res := models.TeamCreationRequest{
		ID:             requestID,
		UserID:         claims.UserID,
		UserName:       requesterName,
		UserEmail:      claims.Email,
		UserUsername:   claims.Username,
		Name:           name,
		Description:    req.Description,
		AvatarColor:    color,
		InitialMembers: req.InitialMembers,
		Status:         "pending",
		CreatedAt:      now,
	}

	events.Broadcast("team:request_create", "team_request", "create", requestID, "", claims.UserID, res)
	utils.RespondJSON(w, http.StatusCreated, res)
}

// GetMyRequests returns team requests submitted by the current user
func (h *TeamHandler) GetMyRequests(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	rows, err := db.DB.Query(`
		SELECT id, user_id, user_name, user_email, user_username, name, description, avatar_color, initial_members, status, admin_note, created_at, reviewed_at, COALESCE(reviewed_by, '')
		FROM main.team_requests
		WHERE user_id = ?
		ORDER BY created_at DESC
	`, claims.UserID)
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

// CreateTeam creates a new team directly (available to workspace administrators and owner)
func (h *TeamHandler) CreateTeam(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	// Non-admin / non-owner users must submit a request
	if claims.Role != "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Team creation requires administrator approval. Please submit a team creation request.")
		return
	}

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

	events.Broadcast("team:create", "team", "create", teamID, "", claims.UserID, team)
	utils.RespondJSON(w, http.StatusCreated, team)
}

// GetTeam returns details and members of a team
func (h *TeamHandler) GetTeam(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	teamID := chi.URLParam(r, "id")

	var tm models.Team
	var desc sql.NullString

	err := db.DB.QueryRow(`
		SELECT t.id, t.name, t.description, t.avatar_color, t.created_by_user_id, u.name as creator_name, COALESCE(u.username, '') as creator_username, u.role as creator_role,
		       t.created_at, t.updated_at
		FROM main.teams t
		JOIN main.users u ON t.created_by_user_id = u.id
		WHERE t.id = ?
	`, teamID).Scan(
		&tm.ID, &tm.Name, &desc, &tm.AvatarColor, &tm.CreatedByUserID, &tm.CreatorName, &tm.CreatorUsername, &tm.CreatorRole,
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
	if userRole == "" && claims.Role == "owner" {
		userRole = "owner"
	}
	tm.UserRole = userRole

	// Fetch members
	membersRows, err := db.DB.Query(`
		SELECT tm.id, tm.team_id, tm.user_id, u.name, u.username, u.email, u.avatar_color, tm.role, tm.joined_at, u.role as workspace_role
		FROM main.team_members tm
		JOIN main.users u ON tm.user_id = u.id
		WHERE tm.team_id = ?
		ORDER BY CASE WHEN u.role = 'owner' THEN 1 WHEN tm.role = 'leader' THEN 2 ELSE 3 END, u.name ASC
	`, teamID)

	tm.Members = make([]models.TeamMember, 0)
	if err == nil {
		defer membersRows.Close()
		for membersRows.Next() {
			var m models.TeamMember
			if err := membersRows.Scan(&m.ID, &m.TeamID, &m.UserID, &m.Name, &m.Username, &m.Email, &m.AvatarColor, &m.Role, &m.JoinedAt, &m.WorkspaceRole); err == nil {
				tm.Members = append(tm.Members, m)
			}
		}
		if err := membersRows.Err(); err != nil {
			_ = err
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

	var role string
	var targetUserRole string
	_ = db.DB.QueryRow("SELECT role FROM main.users WHERE id = ?", targetUser.ID).Scan(&targetUserRole)
	if targetUserRole == "owner" {
		if claims.Role != "owner" {
			utils.RespondError(w, http.StatusForbidden, "Admins cannot modify the workspace owner's team membership")
			return
		}
		role = "leader"
	} else if req.Role == "leader" {
		role = "leader"
	} else {
		role = "member"
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

	events.Broadcast("team:member_add", "team", "member_add", teamID, "", claims.UserID, map[string]interface{}{"user_id": targetUser.ID})

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

	// Check if target user is workspace owner
	var targetUserRole string
	_ = db.DB.QueryRow("SELECT role FROM main.users WHERE id = ?", targetUserID).Scan(&targetUserRole)
	if targetUserRole == "owner" {
		utils.RespondError(w, http.StatusForbidden, "The workspace owner cannot be removed from any team")
		return
	}

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
	events.Broadcast("team:member_remove", "team", "member_remove", teamID, "", claims.UserID, map[string]interface{}{"user_id": targetUserID})
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

	var creatorRole string
	_ = db.DB.QueryRow("SELECT u.role FROM main.teams t JOIN main.users u ON t.created_by_user_id = u.id WHERE t.id = ?", teamID).Scan(&creatorRole)
	if creatorRole == "owner" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Admins cannot delete teams created by the workspace owner")
		return
	}

	if creatorID != claims.UserID && claims.Role != "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only the team creator or workspace owner can delete this team")
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
	events.Broadcast("team:delete", "team", "delete", teamID, "", claims.UserID, nil)
	utils.RespondSuccess(w, http.StatusOK, "Team deleted successfully", nil)
}

// GetAvailableUsers lists all approved users in the workspace to pick when creating/adding to teams
func (h *TeamHandler) GetAvailableUsers(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	rows, err := db.DB.Query(`
		SELECT id, email, username, name, avatar_color, role
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
		if err := rows.Scan(&u.ID, &u.Email, &u.Username, &u.Name, &u.AvatarColor, &u.Role); err == nil {
			users = append(users, u)
		}
	}
	if err := rows.Err(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to read users")
		return
	}

	utils.RespondJSON(w, http.StatusOK, users)
}

// UpdateTeam updates team settings: name, description, and avatar color
func (h *TeamHandler) UpdateTeam(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	teamID := chi.URLParam(r, "id")

	var creatorID string
	var callerRole string
	_ = db.DB.QueryRow("SELECT created_by_user_id FROM main.teams WHERE id = ?", teamID).Scan(&creatorID)
	_ = db.DB.QueryRow("SELECT role FROM main.team_members WHERE team_id = ? AND user_id = ?", teamID, claims.UserID).Scan(&callerRole)

	if creatorID != claims.UserID && callerRole != "leader" && claims.Role != "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only team leaders or workspace admins can update team settings")
		return
	}

	var req models.UpdateTeamRequest
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

	now := time.Now().UTC().Truncate(time.Second)
	_, err := db.DB.Exec(`
		UPDATE main.teams
		SET name = ?, description = ?, avatar_color = ?, updated_at = ?
		WHERE id = ?
	`, name, req.Description, color, now, teamID)

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update team settings")
		return
	}

	db.LogActivity(claims.UserID, claims.Username, "update_team", "team", teamID, name, fmt.Sprintf("Updated team '%s' settings", name))
	events.Broadcast("team:update", "team", "update", teamID, "", claims.UserID, map[string]interface{}{
		"id":           teamID,
		"name":         name,
		"description":  req.Description,
		"avatar_color": color,
	})

	utils.RespondSuccess(w, http.StatusOK, "Team settings updated successfully", map[string]interface{}{
		"id":           teamID,
		"name":         name,
		"description":  req.Description,
		"avatar_color": color,
	})
}

// UpdateMemberRole updates a member's role between leader and member
func (h *TeamHandler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	teamID := chi.URLParam(r, "id")
	targetUserID := chi.URLParam(r, "userId")

	var creatorID string
	var callerRole string
	_ = db.DB.QueryRow("SELECT created_by_user_id FROM main.teams WHERE id = ?", teamID).Scan(&creatorID)
	_ = db.DB.QueryRow("SELECT role FROM main.team_members WHERE team_id = ? AND user_id = ?", teamID, claims.UserID).Scan(&callerRole)

	if creatorID != claims.UserID && callerRole != "leader" && claims.Role != "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only team leaders or workspace admins can modify member roles")
		return
	}

	var req models.UpdateMemberRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role != "leader" && role != "member" {
		utils.RespondError(w, http.StatusBadRequest, "Role must be 'leader' or 'member'")
		return
	}

	var targetUserRole string
	_ = db.DB.QueryRow("SELECT role FROM main.users WHERE id = ?", targetUserID).Scan(&targetUserRole)
	if targetUserRole == "owner" {
		if claims.Role != "owner" {
			utils.RespondError(w, http.StatusForbidden, "Admins cannot change the workspace owner's role in any team")
			return
		}
		if role != "leader" {
			utils.RespondError(w, http.StatusForbidden, "The workspace owner cannot be demoted from leader")
			return
		}
	}

	if targetUserID == creatorID && role != "leader" && claims.Role != "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "The team creator cannot be demoted from leader")
		return
	}

	_, err := db.DB.Exec("UPDATE main.team_members SET role = ? WHERE team_id = ? AND user_id = ?", role, teamID, targetUserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to update member role")
		return
	}

	_, _ = db.DB.Exec("UPDATE main.teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", teamID)
	events.Broadcast("team:role_update", "team", "role_update", teamID, "", claims.UserID, map[string]interface{}{
		"user_id": targetUserID,
		"role":    role,
	})

	utils.RespondSuccess(w, http.StatusOK, fmt.Sprintf("Member role updated to %s", role), map[string]interface{}{
		"user_id": targetUserID,
		"role":    role,
	})
}

// TransferOwnership transfers team creator/ownership to another member
func (h *TeamHandler) TransferOwnership(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	teamID := chi.URLParam(r, "id")

	var creatorID string
	err := db.DB.QueryRow("SELECT created_by_user_id FROM main.teams WHERE id = ?", teamID).Scan(&creatorID)
	if err != nil {
		utils.RespondError(w, http.StatusNotFound, "Team not found")
		return
	}

	var creatorRole string
	_ = db.DB.QueryRow("SELECT u.role FROM main.teams t JOIN main.users u ON t.created_by_user_id = u.id WHERE t.id = ?", teamID).Scan(&creatorRole)
	if creatorRole == "owner" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Admins cannot transfer ownership of teams owned by the workspace owner")
		return
	}

	if creatorID != claims.UserID && claims.Role != "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only the team owner or workspace admin can transfer ownership")
		return
	}

	var req models.TransferOwnershipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	newOwnerID := strings.TrimSpace(req.NewOwnerID)
	if newOwnerID == "" || newOwnerID == creatorID {
		utils.RespondError(w, http.StatusBadRequest, "Invalid new owner ID")
		return
	}

	var isMember int
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM main.team_members WHERE team_id = ? AND user_id = ?", teamID, newOwnerID).Scan(&isMember)
	if isMember == 0 {
		utils.RespondError(w, http.StatusBadRequest, "New owner must already be a member of the team")
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Transaction failed")
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec("UPDATE main.teams SET created_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", newOwnerID, teamID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to transfer team ownership")
		return
	}

	_, _ = tx.Exec("UPDATE main.team_members SET role = 'leader' WHERE team_id = ? AND user_id = ?", teamID, newOwnerID)

	if err := tx.Commit(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to commit ownership transfer")
		return
	}

	events.Broadcast("team:transfer", "team", "transfer", teamID, "", claims.UserID, map[string]interface{}{
		"new_owner_id": newOwnerID,
	})
	utils.RespondSuccess(w, http.StatusOK, "Team ownership transferred successfully", nil)
}

// GetTeamShares lists all folders and files shared with this team
func (h *TeamHandler) GetTeamShares(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	teamID := chi.URLParam(r, "id")

	var count int
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM main.team_members WHERE team_id = ? AND user_id = ?", teamID, claims.UserID).Scan(&count)
	if count == 0 && claims.Role != "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "You are not a member of this team")
		return
	}

	rows, err := db.DB.Query(`
		SELECT ts.id, ts.team_id, ts.target_type, ts.target_id, ts.permission, ts.shared_by_user_id,
		       COALESCE(u.name, 'Unknown') as shared_by_name, ts.created_at,
		       CASE 
		            WHEN ts.target_type = 'drive' THEN COALESCE(u.name || '''s Drive', 'My Drive')
		            WHEN ts.target_type = 'folder' THEN COALESCE(fo.name, 'Shared Folder')
		            WHEN ts.target_type = 'file' THEN COALESCE(fi.name, 'Shared File')
		            ELSE 'Shared Resource'
		       END as target_name
		FROM drive.team_shares ts
		LEFT JOIN main.users u ON ts.shared_by_user_id = u.id
		LEFT JOIN drive.folders fo ON ts.target_type = 'folder' AND ts.target_id = fo.id
		LEFT JOIN drive.files fi ON ts.target_type = 'file' AND ts.target_id = fi.id
		WHERE ts.team_id = ?
		ORDER BY ts.created_at DESC
	`, teamID)

	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to fetch team shares")
		return
	}
	defer rows.Close()

	shares := make([]models.TeamShareInfo, 0)
	for rows.Next() {
		var s models.TeamShareInfo
		if err := rows.Scan(&s.ID, &s.TeamID, &s.TargetType, &s.TargetID, &s.Permission, &s.SharedByID, &s.SharedByName, &s.CreatedAt, &s.TargetName); err == nil {
			shares = append(shares, s)
		}
	}
	if err := rows.Err(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to parse team shares")
		return
	}

	utils.RespondJSON(w, http.StatusOK, shares)
}

// RemoveTeamShare revokes a shared resource from the team
func (h *TeamHandler) RemoveTeamShare(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	teamID := chi.URLParam(r, "id")
	shareID := chi.URLParam(r, "shareId")

	var creatorID string
	var callerRole string
	_ = db.DB.QueryRow("SELECT created_by_user_id FROM main.teams WHERE id = ?", teamID).Scan(&creatorID)
	_ = db.DB.QueryRow("SELECT role FROM main.team_members WHERE team_id = ? AND user_id = ?", teamID, claims.UserID).Scan(&callerRole)

	if creatorID != claims.UserID && callerRole != "leader" && claims.Role != "admin" && claims.Role != "owner" {
		utils.RespondError(w, http.StatusForbidden, "Only team leaders or workspace admins can remove shared items")
		return
	}

	var targetType, targetID, sharedBy string
	_ = db.DB.QueryRow("SELECT target_type, target_id, shared_by_user_id FROM drive.team_shares WHERE id = ?", shareID).
		Scan(&targetType, &targetID, &sharedBy)

	_, err := db.DB.Exec("DELETE FROM drive.team_shares WHERE id = ? AND team_id = ?", shareID, teamID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Failed to remove team share")
		return
	}

	if targetType != "" {
		_, _ = db.DB.Exec(`
			DELETE FROM drive.shares 
			WHERE shared_by_user_id = ? AND target_type = ? AND (target_id = ? OR (target_id = 'root' AND ? = 'drive'))
		`, sharedBy, targetType, targetID, targetType)
	}

	events.Broadcast("team:share_remove", "team", "share_remove", teamID, "", claims.UserID, map[string]interface{}{"share_id": shareID})
	events.Broadcast("share:delete", "share", "delete", shareID, "", claims.UserID, nil)
	utils.RespondSuccess(w, http.StatusOK, "Shared resource removed from team", nil)
}
