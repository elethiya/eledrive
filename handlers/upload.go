package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"eledrive/config"
	"eledrive/db"
	"eledrive/middleware"
	"eledrive/models"
	"eledrive/storage"
	"eledrive/utils"
	"github.com/google/uuid"
)

type UploadHandler struct {
	cfg     *config.Config
	storage *storage.StorageService
}

func NewUploadHandler(cfg *config.Config, storage *storage.StorageService) *UploadHandler {
	return &UploadHandler{cfg: cfg, storage: storage}
}

// Upload handles standard files or nested project folder uploads
func (h *UploadHandler) Upload(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	// Parse multipart form up to max upload size
	err := r.ParseMultipartForm(h.cfg.MaxUploadSize)
	if err != nil {
		utils.RespondError(w, http.StatusBadRequest, "Failed to parse upload form or file exceeds max size")
		return
	}

	targetFolderID := r.FormValue("folder_id")
	targetOwnerID := claims.UserID

	// If uploading into a folder, verify permissions
	if targetFolderID != "" {
		targetFolder, perm, err := CheckFolderAccess(claims.UserID, targetFolderID)
		if err != nil || (perm != "owner" && perm != "editor") {
			utils.RespondError(w, http.StatusForbidden, "No permission to upload into this folder")
			return
		}
		targetOwnerID = targetFolder.OwnerID
	}

	form := r.MultipartForm
	filesHeader := form.File["files"]
	if len(filesHeader) == 0 {
		// Also check "file" (singular)
		filesHeader = form.File["file"]
	}

	if len(filesHeader) == 0 {
		utils.RespondError(w, http.StatusBadRequest, "No files provided")
		return
	}

	// Relative paths map if uploaded via directory upload (relative_path[] or paths[])
	relativePaths := form.Value["paths"]
	if len(relativePaths) == 0 {
		relativePaths = form.Value["paths[]"]
	}

	// Fetch target owner storage limit & usage
	var storageLimit, storageUsed int64
	_ = db.DB.QueryRow("SELECT storage_limit, storage_used FROM users WHERE id = ?", targetOwnerID).Scan(&storageLimit, &storageUsed)

	uploadedFiles := make([]models.File, 0)
	folderCache := make(map[string]string) // relative path -> folder_id

	for i, fileHeader := range filesHeader {
		// Check quota
		if storageUsed+fileHeader.Size > storageLimit {
			utils.RespondError(w, http.StatusInsufficientStorage, fmt.Sprintf("Storage quota exceeded. File %s could not be uploaded", fileHeader.Filename))
			return
		}

		relPath := ""
		if i < len(relativePaths) {
			relPath = relativePaths[i]
		}

		// Resolve or create nested folder hierarchy if relPath is present (e.g. "my-project/src/index.js")
		var destFolderID *string
		if targetFolderID != "" {
			destFolderID = &targetFolderID
		}

		if relPath != "" {
			cleanRel := filepath.Clean(relPath)
			dirPart := filepath.Dir(cleanRel)
			if dirPart != "." && dirPart != "/" && dirPart != "" {
				// Navigate/create subfolder hierarchy
				resolvedFolderID, err := h.ensureFolderPath(dirPart, destFolderID, targetOwnerID, folderCache)
				if err == nil && resolvedFolderID != "" {
					destFolderID = &resolvedFolderID
				}
			}
		}

		// Open source file stream
		srcFile, err := fileHeader.Open()
		if err != nil {
			continue
		}

		filename := filepath.Base(fileHeader.Filename)
		if relPath != "" {
			filename = filepath.Base(relPath)
		}

		storageDiskName, writtenBytes, err := h.storage.SaveUploadedFile(srcFile, filename)
		srcFile.Close()
		if err != nil {
			continue
		}

		fileID := uuid.New().String()
		now := time.Now()
		ext := filepath.Ext(filename)
		mimeType := utils.DetectMimeType(filename)

		_, err = db.DB.Exec(`
			INSERT INTO files (id, name, original_name, folder_id, owner_id, storage_path, size, mime_type, extension, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, fileID, filename, filename, destFolderID, targetOwnerID, storageDiskName, writtenBytes, mimeType, ext, now, now)

		if err != nil {
			_ = h.storage.DeleteFile(storageDiskName)
			continue
		}

		storageUsed += writtenBytes
		uploadedFiles = append(uploadedFiles, models.File{
			ID:           fileID,
			Name:         filename,
			OriginalName: filename,
			FolderID:     destFolderID,
			OwnerID:      targetOwnerID,
			Size:         writtenBytes,
			MimeType:     mimeType,
			Extension:    ext,
			CreatedAt:    now,
			UpdatedAt:    now,
		})
	}

	// Update user storage
	_, _ = h.storage.UpdateUserStorage(targetOwnerID)

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"count": len(uploadedFiles),
		"files": uploadedFiles,
	})
}

// ensureFolderPath creates or finds nested folders for relative paths (e.g. "my-project/components")
func (h *UploadHandler) ensureFolderPath(relDir string, parentFolderID *string, ownerID string, cache map[string]string) (string, error) {
	segments := strings.Split(filepath.ToSlash(relDir), "/")
	var currentParentID *string = parentFolderID
	builtPath := ""

	if parentFolderID != nil {
		builtPath = *parentFolderID
	}

	for _, seg := range segments {
		seg = strings.TrimSpace(seg)
		if seg == "" || seg == "." {
			continue
		}
		builtPath += "/" + seg

		if cachedID, ok := cache[builtPath]; ok {
			currentParentID = &cachedID
			continue
		}

		// Look up in database
		var existingID string
		var err error
		if currentParentID == nil {
			err = db.DB.QueryRow(`
				SELECT id FROM folders 
				WHERE name = ? AND parent_id IS NULL AND owner_id = ? AND is_trashed = 0
			`, seg, ownerID).Scan(&existingID)
		} else {
			err = db.DB.QueryRow(`
				SELECT id FROM folders 
				WHERE name = ? AND parent_id = ? AND owner_id = ? AND is_trashed = 0
			`, seg, *currentParentID, ownerID).Scan(&existingID)
		}

		if err == nil {
			cache[builtPath] = existingID
			currentParentID = &existingID
		} else {
			// Create folder
			newFolderID := uuid.New().String()
			now := time.Now()
			_, err = db.DB.Exec(`
				INSERT INTO folders (id, name, parent_id, owner_id, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`, newFolderID, seg, currentParentID, ownerID, now, now)
			if err != nil {
				return "", err
			}
			cache[builtPath] = newFolderID
			currentParentID = &newFolderID
		}
	}

	if currentParentID != nil {
		return *currentParentID, nil
	}
	return "", nil
}
