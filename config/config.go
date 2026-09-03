package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	Port          string
	DBPath        string
	StorageDir    string
	JWTSecret     string
	MaxUploadSize int64 // in bytes (e.g., 1GB)
	BaseURL       string
}

func LoadConfig() *Config {
	port := getEnv("PORT", "8080")
	dbPath := getEnv("DB_PATH", filepath.Join("data", "eledrive.db"))
	storageDir := getEnv("STORAGE_DIR", filepath.Join("data", "uploads"))
	jwtSecret := getEnv("JWT_SECRET", "eledrive-super-secure-jwt-secret-key-2025")
	baseURL := getEnv("BASE_URL", "http://localhost:8080")

	// Ensure data and uploads dirs exist
	_ = os.MkdirAll(filepath.Dir(dbPath), 0755)
	_ = os.MkdirAll(storageDir, 0755)

	return &Config{
		Port:          port,
		DBPath:        dbPath,
		StorageDir:    storageDir,
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
