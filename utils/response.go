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

	// Fallback for common development, office & media extensions
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
	case ".env", ".txt", ".log":
		return "text/plain"
	case ".html", ".htm":
		return "text/html"
	case ".css", ".scss", ".sass", ".less":
		return "text/css"
	case ".svg":
		return "image/svg+xml"
	case ".zip":
		return "application/zip"
	case ".tar":
		return "application/x-tar"
	case ".gz":
		return "application/gzip"
	case ".7z":
		return "application/x-7z-compressed"
	case ".rar":
		return "application/vnd.rar"
	case ".bz2":
		return "application/x-bzip2"
	case ".xz":
		return "application/x-xz"
	case ".pdf":
		return "application/pdf"
	case ".doc":
		return "application/msword"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".dot", ".dotx":
		return "application/msword"
	case ".odt":
		return "application/vnd.oasis.opendocument.text"
	case ".rtf":
		return "application/rtf"
	case ".epub":
		return "application/epub+zip"
	case ".xls":
		return "application/vnd.ms-excel"
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".csv":
		return "text/csv"
	case ".tsv":
		return "text/tab-separated-values"
	case ".ods":
		return "application/vnd.oasis.opendocument.spreadsheet"
	case ".ppt":
		return "application/vnd.ms-powerpoint"
	case ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	case ".odp":
		return "application/vnd.oasis.opendocument.presentation"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".bmp":
		return "image/bmp"
	case ".ico":
		return "image/x-icon"
	case ".tiff", ".tif":
		return "image/tiff"
	case ".avif":
		return "image/avif"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".mkv":
		return "video/x-matroska"
	case ".avi":
		return "video/x-msvideo"
	case ".mov":
		return "video/quicktime"
	case ".wmv":
		return "video/x-ms-wmv"
	case ".flv":
		return "video/x-flv"
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".ogg":
		return "audio/ogg"
	case ".flac":
		return "audio/flac"
	case ".m4a":
		return "audio/mp4"
	case ".aac":
		return "audio/aac"
	default:
		return "application/octet-stream"
	}
}
