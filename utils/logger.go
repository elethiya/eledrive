package utils

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

var (
	CurrentLogSessionDir string
	serverLogFile        *os.File
	activityLogFile      *os.File
	requestLogFile       *os.File
	logMu                sync.Mutex
)

// InitLogger creates database/logs/<date>/<time>/ folders
// and sets up log outputs
func InitLogger(logsBaseDir string) (string, error) {
	logMu.Lock()
	defer logMu.Unlock()

	now := time.Now()
	dateFolder := now.Format("2006-01-02")
	timeFolder := now.Format("15:04:05")

	sessionDir := filepath.Join(logsBaseDir, dateFolder, timeFolder)
	if err := os.MkdirAll(sessionDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create log session directory: %w", err)
	}

	CurrentLogSessionDir = sessionDir

	// Server console runtime log
	sFile, err := os.OpenFile(filepath.Join(sessionDir, "server.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err == nil {
		serverLogFile = sFile
		log.SetOutput(io.MultiWriter(os.Stdout, sFile))
	}

	// Activity audit log
	aFile, err := os.OpenFile(filepath.Join(sessionDir, "activity.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err == nil {
		activityLogFile = aFile
	}

	// Request log
	rFile, err := os.OpenFile(filepath.Join(sessionDir, "requests.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err == nil {
		requestLogFile = rFile
	}

	return sessionDir, nil
}

// LogActivityToFile records an audit event to activity.log in the current log folder
func LogActivityToFile(userID, userName, action, itemType, itemID, itemName, details string) {
	logMu.Lock()
	defer logMu.Unlock()

	if activityLogFile != nil {
		line := fmt.Sprintf("[%s] [USER: %s (%s)] [ACTION: %s] [TARGET: %s:%s (%s)] %s\n",
			time.Now().Format("2006-01-02 15:04:05"),
			userName, userID,
			action,
			itemType, itemID, itemName,
			details,
		)
		_, _ = activityLogFile.WriteString(line)
	}
}

// LogRequestToFile logs HTTP requests to requests.log in the current log folder
func LogRequestToFile(method, path, status, duration, ip string) {
	logMu.Lock()
	defer logMu.Unlock()

	if requestLogFile != nil {
		line := fmt.Sprintf("[%s] %s %s | STATUS: %s | DURATION: %s | IP: %s\n",
			time.Now().Format("2006-01-02 15:04:05"),
			method, path, status, duration, ip,
		)
		_, _ = requestLogFile.WriteString(line)
	}
}
