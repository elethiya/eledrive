package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"eledrive/config"
	"eledrive/utils"
	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB(cfg *config.Config) (*sql.DB, error) {
	// Ensure directories exist
	if err := os.MkdirAll(cfg.DatabaseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}
	if err := os.MkdirAll(cfg.StorageDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create storage directory: %w", err)
	}

	// Auto-migrate legacy data/eledrive.db if database/account.db does not exist
	migrateLegacyData(cfg)

	// 1. Open account.db as primary database
	database, err := sql.Open("sqlite", cfg.AccountDBPath+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, fmt.Errorf("failed to open account sqlite database: %w", err)
	}

	database.SetMaxOpenConns(1) // SQLite works best with 1 writer

	if err := database.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping account sqlite database: %w", err)
	}

	// 2. Attach drive.db to allow seamless joins between users and drive assets
	attachQuery := fmt.Sprintf("ATTACH DATABASE '%s' AS drive;", cfg.DriveDBPath)
	if _, err := database.Exec(attachQuery); err != nil {
		return nil, fmt.Errorf("failed to attach drive database: %w", err)
	}

	DB = database

	if err := migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	EnsureDefaultSettings()

	return DB, nil
}

func migrateLegacyData(cfg *config.Config) {
	oldDBPath := filepath.Join("data", "eledrive.db")
	oldUploads := filepath.Join("data", "uploads")

	// If legacy database exists and new account.db doesn't exist yet:
	if _, err := os.Stat(oldDBPath); err == nil {
		if _, err := os.Stat(cfg.AccountDBPath); os.IsNotExist(err) {
			log.Printf("\033[1;34m[MIGRATE]\033[0m Migrating legacy data/eledrive.db to database/account.db and database/drive.db...")
			oldDB, err := sql.Open("sqlite", oldDBPath)
			if err == nil {
				defer oldDB.Close()

				// 1. Migrate account.db tables: users, activity_logs, system_settings
				accDB, err := sql.Open("sqlite", cfg.AccountDBPath)
				if err == nil {
					_, _ = accDB.Exec(fmt.Sprintf("ATTACH DATABASE '%s' AS old;", oldDBPath))
					_, _ = accDB.Exec("CREATE TABLE IF NOT EXISTS users AS SELECT * FROM old.users WHERE 1=1;")
					_, _ = accDB.Exec("CREATE TABLE IF NOT EXISTS activity_logs AS SELECT * FROM old.activity_logs WHERE 1=1;")
					_, _ = accDB.Exec("CREATE TABLE IF NOT EXISTS system_settings AS SELECT * FROM old.system_settings WHERE 1=1;")
					accDB.Close()
				}

				// 2. Migrate drive.db tables: folders, files, shares, share_links
				drvDB, err := sql.Open("sqlite", cfg.DriveDBPath)
				if err == nil {
					_, _ = drvDB.Exec(fmt.Sprintf("ATTACH DATABASE '%s' AS old;", oldDBPath))
					_, _ = drvDB.Exec("CREATE TABLE IF NOT EXISTS folders AS SELECT * FROM old.folders WHERE 1=1;")
					_, _ = drvDB.Exec("CREATE TABLE IF NOT EXISTS files AS SELECT * FROM old.files WHERE 1=1;")
					_, _ = drvDB.Exec("CREATE TABLE IF NOT EXISTS shares AS SELECT * FROM old.shares WHERE 1=1;")
					_, _ = drvDB.Exec("CREATE TABLE IF NOT EXISTS share_links AS SELECT * FROM old.share_links WHERE 1=1;")
					drvDB.Close()
				}
				log.Printf("\033[1;32m[SUCCESS]\033[0m Legacy database successfully migrated into separate account.db and drive.db!")
			}
		}
	}

	// Move/copy uploads from data/uploads to database/uploads if needed
	if _, err := os.Stat(oldUploads); err == nil {
		entries, err := os.ReadDir(oldUploads)
		if err == nil {
			for _, entry := range entries {
				src := filepath.Join(oldUploads, entry.Name())
				dst := filepath.Join(cfg.StorageDir, entry.Name())
				if _, err := os.Stat(dst); os.IsNotExist(err) {
					_ = os.Rename(src, dst)
				}
			}
		}
	}
}

func migrate() error {
	// Account tables in account.db (main)
	accountSchema := `
	CREATE TABLE IF NOT EXISTS main.users (
		id TEXT PRIMARY KEY,
		email TEXT UNIQUE NOT NULL,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		name TEXT NOT NULL,
		avatar_color TEXT DEFAULT '#3b82f6',
		role TEXT DEFAULT 'member',
		status TEXT DEFAULT 'pending', -- 'approved', 'pending', 'rejected'
		storage_used INTEGER DEFAULT 0,
		storage_limit INTEGER DEFAULT 10737418240, -- 10GB
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS main.activity_logs (
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

	CREATE TABLE IF NOT EXISTS main.system_settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS main.download_logs (
		id TEXT PRIMARY KEY,
		target_type TEXT NOT NULL, -- 'file' or 'folder'
		target_id TEXT NOT NULL,
		secret_uuid TEXT,
		user_id TEXT,
		user_name TEXT,
		user_email TEXT,
		ip_address TEXT,
		user_agent TEXT,
		downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS main.teams (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT DEFAULT '',
		avatar_color TEXT DEFAULT '#3b82f6',
		created_by_user_id TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS main.team_members (
		id TEXT PRIMARY KEY,
		team_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		role TEXT DEFAULT 'member', -- 'leader', 'member'
		joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(team_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS main.password_resets (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		user_name TEXT NOT NULL,
		user_email TEXT NOT NULL,
		user_username TEXT NOT NULL,
		status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'rejected'
		reason TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		resolved_at DATETIME,
		resolved_by TEXT
	);

	CREATE TABLE IF NOT EXISTS main.team_requests (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		user_name TEXT NOT NULL,
		user_email TEXT NOT NULL,
		user_username TEXT NOT NULL,
		name TEXT NOT NULL,
		description TEXT DEFAULT '',
		avatar_color TEXT DEFAULT '#3b82f6',
		initial_members TEXT DEFAULT '[]',
		status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
		admin_note TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		reviewed_at DATETIME,
		reviewed_by TEXT
	);

	CREATE INDEX IF NOT EXISTS main.idx_activity_logs_created ON activity_logs(created_at DESC);
	CREATE INDEX IF NOT EXISTS main.idx_download_logs_target ON download_logs(target_id, downloaded_at DESC);
	CREATE INDEX IF NOT EXISTS main.idx_download_logs_uuid ON download_logs(secret_uuid);
	CREATE INDEX IF NOT EXISTS main.idx_teams_creator ON teams(created_by_user_id);
	CREATE INDEX IF NOT EXISTS main.idx_team_members_team ON team_members(team_id);
	CREATE INDEX IF NOT EXISTS main.idx_team_members_user ON team_members(user_id);
	CREATE INDEX IF NOT EXISTS main.idx_password_resets_status ON password_resets(status, created_at DESC);
	CREATE INDEX IF NOT EXISTS main.idx_team_requests_status ON team_requests(status, created_at DESC);
	CREATE INDEX IF NOT EXISTS main.idx_team_requests_user ON team_requests(user_id);
	`

	if _, err := DB.Exec(accountSchema); err != nil {
		return fmt.Errorf("failed to create account tables: %w", err)
	}

	// Drive tables in drive.db (drive)
	driveSchema := `
	CREATE TABLE IF NOT EXISTS drive.folders (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		parent_id TEXT NULL,
		owner_id TEXT NOT NULL,
		is_starred INTEGER DEFAULT 0,
		is_trashed INTEGER DEFAULT 0,
		trashed_at DATETIME NULL,
		color TEXT NULL,
		secret_uuid TEXT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS drive.files (
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
		secret_uuid TEXT NULL,
		forensic_meta TEXT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS drive.shares (
		id TEXT PRIMARY KEY,
		target_type TEXT NOT NULL, -- 'folder' or 'file'
		target_id TEXT NOT NULL,
		shared_by_user_id TEXT NOT NULL,
		shared_with_user_id TEXT NOT NULL,
		permission TEXT NOT NULL DEFAULT 'viewer', -- 'viewer' or 'editor'
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(target_type, target_id, shared_with_user_id)
	);

	CREATE TABLE IF NOT EXISTS drive.team_shares (
		id TEXT PRIMARY KEY,
		team_id TEXT NOT NULL,
		target_type TEXT NOT NULL, -- 'folder' or 'file'
		target_id TEXT NOT NULL,
		shared_by_user_id TEXT NOT NULL,
		permission TEXT NOT NULL DEFAULT 'viewer', -- 'viewer' or 'editor'
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(team_id, target_type, target_id)
	);

	CREATE TABLE IF NOT EXISTS drive.share_links (
		id TEXT PRIMARY KEY,
		token TEXT UNIQUE NOT NULL,
		target_type TEXT NOT NULL, -- 'folder' or 'file'
		target_id TEXT NOT NULL,
		created_by_user_id TEXT NOT NULL,
		permission TEXT NOT NULL DEFAULT 'view', -- 'view' or 'upload_and_view'
		password_hash TEXT NULL,
		expires_at DATETIME NULL,
		download_count INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS drive.idx_folders_owner ON folders(owner_id, parent_id, is_trashed);
	CREATE INDEX IF NOT EXISTS drive.idx_files_owner ON files(owner_id, folder_id, is_trashed);
	CREATE INDEX IF NOT EXISTS drive.idx_shares_user ON shares(shared_with_user_id);
	CREATE INDEX IF NOT EXISTS drive.idx_team_shares_team ON team_shares(team_id);
	CREATE INDEX IF NOT EXISTS drive.idx_team_shares_target ON team_shares(target_type, target_id);
	CREATE INDEX IF NOT EXISTS drive.idx_share_links_token ON share_links(token);
	`

	if _, err := DB.Exec(driveSchema); err != nil {
		return fmt.Errorf("failed to create drive tables: %w", err)
	}

	// Ensure status column exists for users
	var colCount int
	_ = DB.QueryRow("SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='status'").Scan(&colCount)
	if colCount == 0 {
		_, _ = DB.Exec("ALTER TABLE main.users ADD COLUMN status TEXT DEFAULT 'pending'")
	}
	// Existing users and admins are set to approved
	_, _ = DB.Exec("UPDATE main.users SET status = 'approved' WHERE status IS NULL OR status = '' OR role = 'admin' OR role = 'owner'")

	// Ensure secret_uuid and forensic_meta exist in files
	var fUUIDCount int
	_ = DB.QueryRow("SELECT COUNT(*) FROM drive.pragma_table_info('files') WHERE name='secret_uuid'").Scan(&fUUIDCount)
	if fUUIDCount == 0 {
		_, _ = DB.Exec("ALTER TABLE drive.files ADD COLUMN secret_uuid TEXT")
		_, _ = DB.Exec("ALTER TABLE drive.files ADD COLUMN forensic_meta TEXT")
	}

	// Ensure secret_uuid exists in folders
	var fldUUIDCount int
	_ = DB.QueryRow("SELECT COUNT(*) FROM drive.pragma_table_info('folders') WHERE name='secret_uuid'").Scan(&fldUUIDCount)
	if fldUUIDCount == 0 {
		_, _ = DB.Exec("ALTER TABLE drive.folders ADD COLUMN secret_uuid TEXT")
	}

	// Create indices on secret_uuid now that columns are guaranteed to exist
	_, _ = DB.Exec("CREATE INDEX IF NOT EXISTS drive.idx_folders_secret_uuid ON folders(secret_uuid)")
	_, _ = DB.Exec("CREATE INDEX IF NOT EXISTS drive.idx_files_secret_uuid ON files(secret_uuid)")

	// Backfill missing secret UUIDs for any existing files and folders
	fileRows, err := DB.Query("SELECT id FROM drive.files WHERE secret_uuid IS NULL OR secret_uuid = ''")
	if err == nil {
		defer fileRows.Close()
		for fileRows.Next() {
			var fid string
			if err := fileRows.Scan(&fid); err == nil {
				_, _ = DB.Exec("UPDATE drive.files SET secret_uuid = ? WHERE id = ?", uuid.New().String(), fid)
			}
		}
		if err := fileRows.Err(); err != nil {
			_ = err
		}
	}

	folderRows, err := DB.Query("SELECT id FROM drive.folders WHERE secret_uuid IS NULL OR secret_uuid = ''")
	if err == nil {
		defer folderRows.Close()
		for folderRows.Next() {
			var fldID string
			if err := folderRows.Scan(&fldID); err == nil {
				_, _ = DB.Exec("UPDATE drive.folders SET secret_uuid = ? WHERE id = ?", uuid.New().String(), fldID)
			}
		}
		if err := folderRows.Err(); err != nil {
			_ = err
		}
	}

	// Ensure password_resets exists
	_, _ = DB.Exec(`
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
		);
		CREATE INDEX IF NOT EXISTS main.idx_password_resets_status ON password_resets(status, created_at DESC);
	`)

	// Ensure exactly one owner exists: if no owner exists, promote the first admin
	var ownerCount int
	_ = DB.QueryRow("SELECT COUNT(*) FROM main.users WHERE role = 'owner'").Scan(&ownerCount)
	if ownerCount == 0 {
		_, _ = DB.Exec(`
			UPDATE main.users 
			SET role = 'owner', status = 'approved' 
			WHERE id = (SELECT id FROM main.users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1)
		`)
	}

	return nil
}

func EnsureDefaultSettings() {
	defaults := map[string]string{
		"site_name":                      "EleDrive",
		"default_quota_gb":               "10",
		"allow_public_registration":      "true",
		"allow_public_shares":            "true",
		"max_upload_size_mb":             "1024",
		"require_admin_approval":         "true",
		"allow_password_reset_requests":   "true",
		"session_timeout_hours":          "72",
		"enforce_strong_passwords":       "false",
		"max_login_attempts":             "5",
		"require_link_passwords":         "false",
		"default_link_expiry_days":        "30",
		"allow_team_creation":            "true",
		"trash_retention_days":           "30",
		"activity_log_retention_days":     "90",
		"notify_quota_warning_percent":    "85",
		"forensic_watermarking_enabled":  "true",
		"steganographic_canary_enabled":  "true",
		"log_forensic_downloads":         "true",
		"maintenance_mode":               "false",
		"maintenance_notice":             "Platform is currently undergoing scheduled maintenance. Please check back shortly.",
		"allow_zip_downloads":            "true",
		"chunk_upload_enabled":           "true",
	}

	for k, v := range defaults {
		_, _ = DB.Exec(`
			INSERT OR IGNORE INTO main.system_settings (key, value, updated_at)
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
		INSERT INTO main.activity_logs (id, user_id, user_name, action, item_type, item_id, item_name, details, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, userID, userName, action, itemType, itemID, itemName, details, time.Now())

	utils.LogActivityToFile(userID, userName, action, itemType, itemID, itemName, details)
}

func GetMaintenanceStatus() (bool, string) {
	if DB == nil {
		return false, ""
	}
	var isMaintStr, notice string
	_ = DB.QueryRow("SELECT value FROM main.system_settings WHERE key = 'maintenance_mode'").Scan(&isMaintStr)
	_ = DB.QueryRow("SELECT value FROM main.system_settings WHERE key = 'maintenance_notice'").Scan(&notice)
	if notice == "" {
		notice = "Platform is currently undergoing scheduled maintenance. Please check back shortly."
	}
	return (isMaintStr == "true" || isMaintStr == "1"), notice
}
