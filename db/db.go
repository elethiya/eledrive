package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"eledrive/config"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB(cfg *config.Config) (*sql.DB, error) {
	// Ensure directory exists
	dir := filepath.Dir(cfg.DBPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	database, err := sql.Open("sqlite", cfg.DBPath+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	database.SetMaxOpenConns(1) // SQLite works best with 1 writer or managed pool

	if err := database.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping sqlite database: %w", err)
	}

	DB = database

	if err := migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	if err := seedDefaultData(); err != nil {
		log.Printf("Warning: failed to seed default data: %v", err)
	}

	EnsureDefaultSettings()

	return DB, nil
}

func migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		email TEXT UNIQUE NOT NULL,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		name TEXT NOT NULL,
		avatar_color TEXT DEFAULT '#3b82f6',
		role TEXT DEFAULT 'member',
		storage_used INTEGER DEFAULT 0,
		storage_limit INTEGER DEFAULT 10737418240, -- 10GB
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS folders (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		parent_id TEXT NULL,
		owner_id TEXT NOT NULL,
		is_starred INTEGER DEFAULT 0,
		is_trashed INTEGER DEFAULT 0,
		trashed_at DATETIME NULL,
		color TEXT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE CASCADE,
		FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS files (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		original_name TEXT NOT NULL,
		folder_id TEXT NULL,
		owner_id TEXT NOT NULL,
		storage_path TEXT NOT NULL,
		size INTEGER NOT NULL,
		mime_type TEXT NOT NULL,
		extension TEXT NOT NULL,
		is_starred INTEGER DEFAULT 0,
		is_trashed INTEGER DEFAULT 0,
		trashed_at DATETIME NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE,
		FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS shares (
		id TEXT PRIMARY KEY,
		target_type TEXT NOT NULL, -- 'folder' or 'file'
		target_id TEXT NOT NULL,
		shared_by_user_id TEXT NOT NULL,
		shared_with_user_id TEXT NOT NULL,
		permission TEXT NOT NULL DEFAULT 'viewer', -- 'viewer' or 'editor'
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(shared_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY(shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
		UNIQUE(target_type, target_id, shared_with_user_id)
	);

	CREATE TABLE IF NOT EXISTS share_links (
		id TEXT PRIMARY KEY,
		token TEXT UNIQUE NOT NULL,
		target_type TEXT NOT NULL, -- 'folder' or 'file'
		target_id TEXT NOT NULL,
		created_by_user_id TEXT NOT NULL,
		permission TEXT NOT NULL DEFAULT 'view', -- 'view' or 'upload_and_view'
		password_hash TEXT NULL,
		expires_at DATETIME NULL,
		download_count INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS activity_logs (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		user_name TEXT NOT NULL,
		action TEXT NOT NULL,
		item_type TEXT NOT NULL,
		item_id TEXT NOT NULL,
		item_name TEXT NOT NULL,
		details TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS system_settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_id, parent_id, is_trashed);
	CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id, folder_id, is_trashed);
	CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(shared_with_user_id);
	CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
	CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
	`

	_, err := DB.Exec(schema)
	return err
}

func seedDefaultData() error {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	// Create a default team admin user: admin@eledrive.local / password123
	// and a teammate user: alex@eledrive.local / password123
	hashedPw, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	adminID := uuid.New().String()
	_, err = DB.Exec(`
		INSERT INTO users (id, email, username, password_hash, name, avatar_color, role, storage_limit, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, adminID, "admin@eledrive.local", "admin", string(hashedPw), "Admin User", "#3b82f6", "admin", int64(20*1024*1024*1024), time.Now(), time.Now())
	if err != nil {
		return err
	}

	alexID := uuid.New().String()
	_, err = DB.Exec(`
		INSERT INTO users (id, email, username, password_hash, name, avatar_color, role, storage_limit, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, alexID, "alex@eledrive.local", "alex", string(hashedPw), "Alex Miller", "#10b981", "member", int64(10*1024*1024*1024), time.Now(), time.Now())
	if err != nil {
		return err
	}

	sarahID := uuid.New().String()
	_, err = DB.Exec(`
		INSERT INTO users (id, email, username, password_hash, name, avatar_color, role, storage_limit, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, sarahID, "sarah@eledrive.local", "sarah", string(hashedPw), "Sarah Connor", "#8b5cf6", "member", int64(10*1024*1024*1024), time.Now(), time.Now())
	if err != nil {
		return err
	}

	// Create sample project folders for Admin
	projectFolderID := uuid.New().String()
	_, err = DB.Exec(`
		INSERT INTO folders (id, name, parent_id, owner_id, color, created_at, updated_at)
		VALUES (?, ?, NULL, ?, ?, ?, ?)
	`, projectFolderID, "Alpha Web Project", adminID, "#3b82f6", time.Now(), time.Now())
	if err != nil {
		return err
	}

	docsFolderID := uuid.New().String()
	_, err = DB.Exec(`
		INSERT INTO folders (id, name, parent_id, owner_id, color, created_at, updated_at)
		VALUES (?, ?, NULL, ?, ?, ?, ?)
	`, docsFolderID, "Team Documentation", adminID, "#10b981", time.Now(), time.Now())
	if err != nil {
		return err
	}

	// Share "Alpha Web Project" with Alex as Editor so collaboration works right away
	shareID := uuid.New().String()
	_, _ = DB.Exec(`
		INSERT INTO shares (id, target_type, target_id, shared_by_user_id, shared_with_user_id, permission, created_at)
		VALUES (?, 'folder', ?, ?, ?, 'editor', ?)
	`, shareID, projectFolderID, adminID, alexID, time.Now())

	log.Println("Initialized SQLite database with seed users (admin@eledrive.local, alex@eledrive.local, sarah@eledrive.local / password123)")
	return nil
}

func EnsureDefaultSettings() {
	defaults := map[string]string{
		"site_name":                 "EleDrive",
		"default_quota_gb":          "10",
		"allow_public_registration": "true",
		"allow_public_shares":       "true",
		"max_upload_size_mb":        "1024",
	}

	for k, v := range defaults {
		_, _ = DB.Exec(`
			INSERT OR IGNORE INTO system_settings (key, value, updated_at)
			VALUES (?, ?, CURRENT_TIMESTAMP)
		`, k, v)
	}
}

func LogActivity(userID, userName, action, itemType, itemID, itemName, details string) {
	if DB == nil {
		return
	}
	id := uuid.New().String()
	_, _ = DB.Exec(`
		INSERT INTO activity_logs (id, user_id, user_name, action, item_type, item_id, item_name, details, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, userID, userName, action, itemType, itemID, itemName, details, time.Now())
}

