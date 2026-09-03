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
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	UserName  string    `json:"user_name"`
	Action    string    `json:"action"` // upload, download, share, create_folder, delete, rename, move
	ItemType  string    `json:"item_type"` // file or folder
	ItemID    string    `json:"item_id"`
	ItemName  string    `json:"item_name"`
	Details   string    `json:"details,omitempty"`
	CreatedAt time.Time `json:"created_at"`
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
	SiteName                string `json:"site_name"`
	DefaultQuotaGB          int64  `json:"default_quota_gb"`
	AllowPublicRegistration bool   `json:"allow_public_registration"`
	AllowPublicShares       bool   `json:"allow_public_shares"`
	MaxUploadSizeMB         int64  `json:"max_upload_size_mb"`
}

type AdminStats struct {
	TotalUsers        int   `json:"total_users"`
	TotalFiles        int   `json:"total_files"`
	TotalFolders      int   `json:"total_folders"`
	TotalStorageUsed  int64 `json:"total_storage_used"`
	TotalShareLinks   int   `json:"total_share_links"`
	TotalDirectShares int   `json:"total_direct_shares"`
	PendingApprovals  int   `json:"pending_approvals"`
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
