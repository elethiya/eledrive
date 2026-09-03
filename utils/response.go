package utils

import (
	"encoding/json"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
)

type JSONResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func RespondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(JSONResponse{
		Success: status >= 200 && status < 300,
		Data:    data,
	})
}

func RespondSuccess(w http.ResponseWriter, status int, message string, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(JSONResponse{
		Success: true,
		Message: message,
		Data:    data,
	})
}

func RespondError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(JSONResponse{
		Success: false,
		Error:   message,
	})
}

func DetectMimeType(fileName string) string {
	ext := strings.ToLower(filepath.Ext(fileName))
	mimeType := mime.TypeByExtension(ext)
	if mimeType != "" {
		return strings.Split(mimeType, ";")[0]
	}

	// Fallback for common development & code extensions
	switch ext {
	case ".go":
		return "text/x-go"
	case ".js", ".mjs":
		return "application/javascript"
	case ".jsx":
		return "text/jsx"
	case ".ts":
		return "application/typescript"
	case ".tsx":
		return "text/tsx"
	case ".py":
		return "text/x-python"
	case ".json":
		return "application/json"
	case ".md":
		return "text/markdown"
	case ".sql":
		return "text/x-sql"
	case ".yml", ".yaml":
		return "text/yaml"
	case ".sh", ".bash":
		return "application/x-sh"
	case ".env":
		return "text/plain"
	case ".html", ".htm":
		return "text/html"
	case ".css":
		return "text/css"
	case ".svg":
		return "image/svg+xml"
	case ".zip":
		return "application/zip"
	case ".tar":
		return "application/x-tar"
	case ".gz":
		return "application/gzip"
	case ".pdf":
		return "application/pdf"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".mp4":
		return "video/mp4"
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	default:
		return "application/octet-stream"
	}
}
