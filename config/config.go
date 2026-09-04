package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Port          string
	FrontendPort  string
	DatabaseDir   string
	AccountDBPath string
	DriveDBPath   string
	StorageDir    string
	LogsDir       string
	JWTSecret     string
	MaxUploadSize int64 // in bytes (e.g., 1GB)
	BaseURL       string
}

// loadEnvFile reads key=value pairs from the given file paths (in order)
// and sets them in the process environment if not already set.
func loadEnvFile(filenames ...string) {
	for _, filename := range filenames {
		f, err := os.Open(filename)
		if err != nil {
			continue
		}
		defer f.Close()

		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				// Strip surrounding quotes if present
				if len(val) >= 2 {
					if (val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'') {
						val = val[1 : len(val)-1]
					}
				}
				if _, exists := os.LookupEnv(key); !exists {
					_ = os.Setenv(key, val)
				}
			}
		}
	}
}

func LoadConfig() *Config {
	// Auto-load .env or .evn from working directory or parent
	loadEnvFile(".env", ".evn", "../.env")

	port := getEnv("PORT", "8080")
	frontendPort := getEnv("FRONTEND_PORT", "5173")
	databaseDir := getEnv("DATABASE_DIR", "database")
	accountDBPath := getEnv("ACCOUNT_DB_PATH", filepath.Join(databaseDir, "account.db"))
	driveDBPath := getEnv("DRIVE_DB_PATH", filepath.Join(databaseDir, "drive.db"))
	storageDir := getEnv("STORAGE_DIR", filepath.Join(databaseDir, "uploads"))
	logsDir := getEnv("LOGS_DIR", filepath.Join(databaseDir, "logs"))
	jwtSecret := getEnv("JWT_SECRET", "eledrive-super-secure-jwt-secret-key-2025")
	baseURL := getEnv("BASE_URL", "http://localhost:"+port)

	// Ensure database and uploads directories exist
	_ = os.MkdirAll(databaseDir, 0755)
	_ = os.MkdirAll(storageDir, 0755)
	_ = os.MkdirAll(logsDir, 0755)

	return &Config{
		Port:          port,
		FrontendPort:  frontendPort,
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
