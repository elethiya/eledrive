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
	CurrentLogFilePath   string
	currentLogFile       *os.File
	logMu                sync.Mutex
)

// InitLogger creates <logsBaseDir>/<date>/ folder and opens a single <time>.log file inside it.
// No subfolder for time is created, and all logs (server, activity, requests) are unified into this single file.
func InitLogger(logsBaseDir string) (string, error) {
	logMu.Lock()
	defer logMu.Unlock()

	now := time.Now()
	dateFolder := now.Format("2006-01-02")
	timeFileName := fmt.Sprintf("%s.log", now.Format("15:04:05"))

	dateDir := filepath.Join(logsBaseDir, dateFolder)
	if err := os.MkdirAll(dateDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create log date directory: %w", err)
	}

	CurrentLogSessionDir = dateDir

	logFilePath := filepath.Join(dateDir, timeFileName)
	file, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return "", fmt.Errorf("failed to open log file %s: %w", logFilePath, err)
	}

	// Close previously active log file if any
	if currentLogFile != nil {
		_ = currentLogFile.Close()
	}
	currentLogFile = file
	CurrentLogFilePath = logFilePath

	// Server console runtime log: route standard output to stdout and this single log file
	log.SetOutput(io.MultiWriter(os.Stdout, file))

	return logFilePath, nil
}

// LogActivityToFile records an audit event to the single session log file
func LogActivityToFile(userID, userName, action, itemType, itemID, itemName, details string) {
	logMu.Lock()
	defer logMu.Unlock()

	if currentLogFile != nil {
		line := fmt.Sprintf("[%s] [ACTIVITY] [USER: %s (%s)] [ACTION: %s] [TARGET: %s:%s (%s)] %s\n",
			time.Now().Format("2006-01-02 15:04:05"),
			userName, userID,
			action,
			itemType, itemID, itemName,
			details,
		)
		_, _ = currentLogFile.WriteString(line)
	}
}

// LogRequestToFile logs HTTP requests to the single session log file
func LogRequestToFile(method, path, status, duration, ip string) {
	logMu.Lock()
	defer logMu.Unlock()

	if currentLogFile != nil {
		line := fmt.Sprintf("[%s] [REQUEST] %s %s | STATUS: %s | DURATION: %s | IP: %s\n",
			time.Now().Format("2006-01-02 15:04:05"),
			method, path, status, duration, ip,
		)
		_, _ = currentLogFile.WriteString(line)
	}
}
