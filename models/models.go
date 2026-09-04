package models

import "time"

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	AvatarColor  string    `json:"avatar_color"`
	Role         string    `json:"role"`
	Status       string    `json:"status"` // 'approved', 'pending', 'rejected'
	StorageUsed  int64     `json:"storage_used"`
	StorageLimit int64     `json:"storage_limit"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type UserPublic struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	Username    string `json:"username"`
	Name        string `json:"name"`
	AvatarColor string `json:"avatar_color"`
	Role        string `json:"role,omitempty"`
}

type Folder struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	ParentID         *string   `json:"parent_id"`
	OwnerID          string    `json:"owner_id"`
	OwnerName        string    `json:"owner_name,omitempty"`
	OwnerEmail       string    `json:"owner_email,omitempty"`
	IsStarred        bool      `json:"is_starred"`
	IsTrashed        bool      `json:"is_trashed"`
	TrashedAt        *time.Time`json:"trashed_at,omitempty"`
	Color            *string   `json:"color,omitempty"`
	SharedPermission *string   `json:"shared_permission,omitempty"` // viewer or editor
	ItemCount        int       `json:"item_count,omitempty"`
	IsTeamShared     bool      `json:"is_team_shared"`
	HasShareLink     bool      `json:"has_share_link"`
	SecretUUID       string    `json:"secret_uuid,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type File struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	OriginalName     string    `json:"original_name"`
	FolderID         *string   `json:"folder_id"`
	OwnerID          string    `json:"owner_id"`
	OwnerName        string    `json:"owner_name,omitempty"`
	OwnerEmail       string    `json:"owner_email,omitempty"`
	StoragePath      string    `json:"-"`
	Size             int64     `json:"size"`
	MimeType         string    `json:"mime_type"`
	Extension        string    `json:"extension"`
	IsStarred        bool      `json:"is_starred"`
	IsTrashed        bool      `json:"is_trashed"`
	TrashedAt        *time.Time`json:"trashed_at,omitempty"`
	SharedPermission *string   `json:"shared_permission,omitempty"` // viewer or editor
	IsTeamShared     bool      `json:"is_team_shared"`
	HasShareLink     bool      `json:"has_share_link"`
	SecretUUID       string    `json:"secret_uuid,omitempty"`
	ForensicMeta     string    `json:"forensic_meta,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type Share struct {
	ID               string      `json:"id"`
	TargetType       string      `json:"target_type"` // "folder" or "file"
	TargetID         string      `json:"target_id"`
	SharedByUserID   string      `json:"shared_by_user_id"`
	SharedWithUserID string      `json:"shared_with_user_id"`
	Permission       string      `json:"permission"` // "viewer" or "editor"
	CreatedAt        time.Time   `json:"created_at"`
	SharedWith       *UserPublic `json:"shared_with,omitempty"`
	SharedBy         *UserPublic `json:"shared_by,omitempty"`
	TargetName       string      `json:"target_name,omitempty"`
}

type ShareLink struct {
	ID              string     `json:"id"`
	Token           string     `json:"token"`
	TargetType      string     `json:"target_type"` // "folder" or "file"
	TargetID        string     `json:"target_id"`
	CreatedByUserID string     `json:"created_by_user_id"`
	Permission      string     `json:"permission"` // "view" or "upload_and_view"
	PasswordHash    *string    `json:"-"`
	HasPassword     bool       `json:"has_password"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
	DownloadCount   int        `json:"download_count"`
	CreatedAt       time.Time  `json:"created_at"`
	TargetName      string     `json:"target_name,omitempty"`
	TargetSize      int64      `json:"target_size,omitempty"`
}

type ActivityLog struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	UserName     string    `json:"user_name"`
	UserUsername string    `json:"user_username,omitempty"`
	Action       string    `json:"action"` // upload, download, share, create_folder, delete, rename, move
	ItemType     string    `json:"item_type"` // file or folder
	ItemID       string    `json:"item_id"`
	ItemName     string    `json:"item_name"`
	Details      string    `json:"details,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type Breadcrumb struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type FolderContentsResponse struct {
	Folder      *Folder      `json:"folder"`
	Breadcrumbs []Breadcrumb `json:"breadcrumbs"`
	Subfolders  []Folder     `json:"subfolders"`
	Files       []File       `json:"files"`
	Permission  string       `json:"permission"` // "owner", "editor", "viewer"
}

type DriveStats struct {
	StorageUsed  int64            `json:"storage_used"`
	StorageLimit int64            `json:"storage_limit"`
	FilesCount   int              `json:"files_count"`
	FoldersCount int              `json:"folders_count"`
	TypeStats    map[string]int64 `json:"type_stats"` // e.g. "documents": bytes, "images": bytes, etc.
}

type SystemSettings struct {
	SiteName                    string `json:"site_name"`
	DefaultQuotaGB              int64  `json:"default_quota_gb"`
	AllowPublicRegistration     bool   `json:"allow_public_registration"`
	AllowPublicShares           bool   `json:"allow_public_shares"`
	MaxUploadSizeMB             int64  `json:"max_upload_size_mb"`
	RequireAdminApproval        bool   `json:"require_admin_approval"`
	AllowPasswordResetRequests  bool   `json:"allow_password_reset_requests"`
	SessionTimeoutHours         int    `json:"session_timeout_hours"`
	EnforceStrongPasswords      bool   `json:"enforce_strong_passwords"`
	MaxLoginAttempts            int    `json:"max_login_attempts"`
	RequireLinkPasswords        bool   `json:"require_link_passwords"`
	DefaultLinkExpiryDays       int    `json:"default_link_expiry_days"`
	AllowTeamCreation           bool   `json:"allow_team_creation"`
	TrashRetentionDays          int    `json:"trash_retention_days"`
	ActivityLogRetentionDays    int    `json:"activity_log_retention_days"`
	NotifyQuotaWarningPercent   int    `json:"notify_quota_warning_percent"`
	ForensicWatermarkingEnabled bool   `json:"forensic_watermarking_enabled"`
	SteganographicCanaryEnabled bool   `json:"steganographic_canary_enabled"`
	LogForensicDownloads        bool   `json:"log_forensic_downloads"`
	MaintenanceMode             bool   `json:"maintenance_mode"`
	MaintenanceNotice           string `json:"maintenance_notice"`
	AllowZipDownloads           bool   `json:"allow_zip_downloads"`
	ChunkUploadEnabled          bool   `json:"chunk_upload_enabled"`
}

type AdminStats struct {
	TotalUsers          int   `json:"total_users"`
	TotalFiles          int   `json:"total_files"`
	TotalFolders        int   `json:"total_folders"`
	TotalStorageUsed    int64 `json:"total_storage_used"`
	TotalShareLinks     int   `json:"total_share_links"`
	TotalDirectShares   int   `json:"total_direct_shares"`
	PendingApprovals    int   `json:"pending_approvals"`
	PendingTeamRequests int   `json:"pending_team_requests"`
	PendingResets       int   `json:"pending_resets"`
}

type AdminUserDetail struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Username     string    `json:"username"`
	Name         string    `json:"name"`
	AvatarColor  string    `json:"avatar_color"`
	Role         string    `json:"role"`
	Status       string    `json:"status"`
	StorageUsed  int64     `json:"storage_used"`
	StorageLimit int64     `json:"storage_limit"`
	FilesCount   int       `json:"files_count"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type DownloadRecord struct {
	ID           string    `json:"id"`
	TargetType   string    `json:"target_type"` // "file" or "folder"
	TargetID     string    `json:"target_id"`
	SecretUUID   string    `json:"secret_uuid"`
	UserID       string    `json:"user_id"`
	UserName     string    `json:"user_name"`
	UserEmail    string    `json:"user_email"`
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	DownloadedAt time.Time `json:"downloaded_at"`
}

type ForensicInspectionResult struct {
	Matched          bool             `json:"matched"`
	SecretUUID       string           `json:"secret_uuid"`
	OriginalFilename string           `json:"original_filename"`
	FileType         string           `json:"file_type"`
	FileSize         int64            `json:"file_size"`
	UploaderID       string           `json:"uploader_id"`
	UploaderName     string           `json:"uploader_name"`
	UploaderEmail    string           `json:"uploader_email"`
	UploaderUsername string           `json:"uploader_username"`
	UploadedAt       *time.Time       `json:"uploaded_at,omitempty"`
	SignatureValid   bool             `json:"signature_valid"`
	SHA256Checksum   string           `json:"sha256_checksum,omitempty"`
	DownloadHistory  []DownloadRecord `json:"download_history"`
	TargetID         string           `json:"target_id,omitempty"`
	IsFolder         bool             `json:"is_folder"`
	RiskAssessment   string           `json:"risk_assessment"` // "LEAK_IDENTIFIED", "NOT_FOUND", "AUTHENTIC"
	MetadataSummary  string           `json:"metadata_summary"`
}

type SecurityStats struct {
	TotalTrackedFiles    int              `json:"total_tracked_files"`
	TotalTrackedFolders  int              `json:"total_tracked_folders"`
	TotalDownloadsLogged int              `json:"total_downloads_logged"`
	RecentDownloads      []DownloadRecord `json:"recent_downloads"`
	RecentTrackedFiles   []File           `json:"recent_tracked_files"`
}

type Team struct {
	ID              string       `json:"id"`
	Name            string       `json:"name"`
	Description     string       `json:"description"`
	AvatarColor     string       `json:"avatar_color"`
	CreatedByUserID string       `json:"created_by_user_id"`
	CreatorName     string       `json:"creator_name,omitempty"`
	CreatorUsername string       `json:"creator_username,omitempty"`
	CreatorRole     string       `json:"creator_role,omitempty"`
	MembersCount    int          `json:"members_count"`
	UserRole        string       `json:"user_role,omitempty"` // "leader", "member", or "owner"
	CreatedAt       time.Time    `json:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at"`
	Members         []TeamMember `json:"members,omitempty"`
}

type TeamMember struct {
	ID            string    `json:"id"`
	TeamID        string    `json:"team_id"`
	UserID        string    `json:"user_id"`
	Name          string    `json:"name"`
	Username      string    `json:"username"`
	Email         string    `json:"email"`
	AvatarColor   string    `json:"avatar_color"`
	Role          string    `json:"role"` // "leader" or "member"
	WorkspaceRole string    `json:"workspace_role,omitempty"`
	JoinedAt      time.Time `json:"joined_at"`
}

type CreateTeamRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	AvatarColor string `json:"avatar_color"`
}

type UpdateTeamRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	AvatarColor string `json:"avatar_color"`
}

type AddTeamMemberRequest struct {
	UserID    string `json:"user_id"`
	UserEmail string `json:"user_email"`
	Role      string `json:"role"` // "member" or "leader"
}

type UpdateMemberRoleRequest struct {
	Role string `json:"role"` // "member" or "leader"
}

type TransferOwnershipRequest struct {
	NewOwnerID string `json:"new_owner_id"`
}

type TeamShareInfo struct {
	ID           string    `json:"id"`
	TeamID       string    `json:"team_id"`
	TargetType   string    `json:"target_type"` // "folder" or "file"
	TargetID     string    `json:"target_id"`
	TargetName   string    `json:"target_name"`
	Permission   string    `json:"permission"` // "viewer" or "editor"
	SharedByID   string    `json:"shared_by_id"`
	SharedByName string    `json:"shared_by_name"`
	CreatedAt    time.Time `json:"created_at"`
}

type PasswordResetRequest struct {
	ID           string     `json:"id"`
	UserID       string     `json:"user_id"`
	UserName     string     `json:"user_name"`
	UserEmail    string     `json:"user_email"`
	UserUsername string     `json:"user_username"`
	AvatarColor  string     `json:"avatar_color,omitempty"`
	Status       string     `json:"status"` // 'pending', 'resolved', 'rejected'
	Reason       string     `json:"reason"`
	CreatedAt    time.Time  `json:"created_at"`
	ResolvedAt   *time.Time `json:"resolved_at,omitempty"`
	ResolvedBy   *string    `json:"resolved_by,omitempty"`
}

type TeamCreationRequest struct {
	ID             string     `json:"id"`
	UserID         string     `json:"user_id"`
	UserName       string     `json:"user_name"`
	UserEmail      string     `json:"user_email"`
	UserUsername   string     `json:"user_username"`
	Name           string     `json:"name"`
	Description    string     `json:"description"`
	AvatarColor    string     `json:"avatar_color"`
	InitialMembers []string   `json:"initial_members"`
	Status         string     `json:"status"` // 'pending', 'approved', 'rejected'
	AdminNote      string     `json:"admin_note"`
	CreatedAt      time.Time  `json:"created_at"`
	ReviewedAt     *time.Time `json:"reviewed_at,omitempty"`
	ReviewedBy     string     `json:"reviewed_by,omitempty"`
}

type SubmitTeamRequestPayload struct {
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	AvatarColor    string   `json:"avatar_color"`
	InitialMembers []string `json:"initial_members"`
}

type RejectTeamRequestPayload struct {
	Note string `json:"note"`
}

