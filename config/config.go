package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	Port          string
	DatabaseDir   string
	AccountDBPath string
	DriveDBPath   string
	StorageDir    string
	LogsDir       string
	JWTSecret     string
	MaxUploadSize int64 // in bytes (e.g., 1GB)
	BaseURL       string
}

func LoadConfig() *Config {
	port := getEnv("PORT", "8080")
	databaseDir := getEnv("DATABASE_DIR", "database")
	accountDBPath := getEnv("ACCOUNT_DB_PATH", filepath.Join(databaseDir, "account.db"))
	driveDBPath := getEnv("DRIVE_DB_PATH", filepath.Join(databaseDir, "drive.db"))
	storageDir := getEnv("STORAGE_DIR", filepath.Join(databaseDir, "uploads"))
	logsDir := getEnv("LOGS_DIR", filepath.Join(databaseDir, "logs"))
	jwtSecret := getEnv("JWT_SECRET", "eledrive-super-secure-jwt-secret-key-2025")
	baseURL := getEnv("BASE_URL", "http://localhost:8080")

	// Ensure database and uploads directories exist
	_ = os.MkdirAll(databaseDir, 0755)
	_ = os.MkdirAll(storageDir, 0755)
	_ = os.MkdirAll(logsDir, 0755)

	return &Config{
		Port:          port,
		DatabaseDir:   databaseDir,
		AccountDBPath: accountDBPath,
		DriveDBPath:   driveDBPath,
		StorageDir:    storageDir,
		LogsDir:       logsDir,
		JWTSecret:     jwtSecret,
		MaxUploadSize: 1024 * 1024 * 1024, // 1 GB max file upload per request
		BaseURL:       baseURL,
	}
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}
