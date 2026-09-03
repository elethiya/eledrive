package storage

import (
	"archive/zip"
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"eledrive/config"
	"eledrive/db"
	"github.com/google/uuid"
)

type StorageService struct {
	cfg *config.Config
}

func NewStorageService(cfg *config.Config) *StorageService {
	return &StorageService{cfg: cfg}
}

// SaveUploadedFile saves a stream to disk and returns the relative storage path and byte size
func (s *StorageService) SaveUploadedFile(r io.Reader, originalFilename string) (string, int64, error) {
	uniqueID := uuid.New().String()
	ext := filepath.Ext(originalFilename)
	diskName := fmt.Sprintf("%s%s", uniqueID, ext)

	fullPath := filepath.Join(s.cfg.StorageDir, diskName)
	out, err := os.Create(fullPath)
	if err != nil {
		return "", 0, fmt.Errorf("failed to create file on disk: %w", err)
	}
	defer out.Close()

	written, err := io.Copy(out, r)
	if err != nil {
		_ = os.Remove(fullPath)
		return "", 0, fmt.Errorf("failed to write file content: %w", err)
	}

	return diskName, written, nil
}

// GetFilePath returns the absolute path of a stored file
func (s *StorageService) GetFilePath(storagePath string) string {
	cleanName := filepath.Base(storagePath)
	return filepath.Join(s.cfg.StorageDir, cleanName)
}

// DeleteFile removes a file from disk
func (s *StorageService) DeleteFile(storagePath string) error {
	fullPath := s.GetFilePath(storagePath)
	if _, err := os.Stat(fullPath); err == nil {
		return os.Remove(fullPath)
	}
	return nil
}

// ZipFolder recursively packs all files and subfolders in folderID into the zip writer
func (s *StorageService) ZipFolder(folderID string, folderName string, w io.Writer) error {
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	// Recursively collect items
	return s.addFolderToZip(folderID, folderName, zipWriter)
}

func (s *StorageService) addFolderToZip(folderID string, currentPath string, zw *zip.Writer) error {
	// Add an entry for current folder
	folderEntry := strings.Trim(currentPath, "/") + "/"
	_, err := zw.Create(folderEntry)
	if err != nil {
		return err
	}

	// Fetch files in this folder
	rows, err := db.DB.Query(`
		SELECT name, storage_path FROM files 
		WHERE folder_id = ? AND is_trashed = 0
	`, folderID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var fileName, storagePath string
		if err := rows.Scan(&fileName, &storagePath); err != nil {
			return err
		}

		filePath := s.GetFilePath(storagePath)
		fileData, err := os.Open(filePath)
		if err != nil {
			continue // skip if missing file
		}

		entryPath := filepath.Join(currentPath, fileName)
		w, err := zw.Create(entryPath)
		if err != nil {
			fileData.Close()
			return err
		}

		_, _ = io.Copy(w, fileData)
		fileData.Close()
	}

	// Fetch subfolders
	subRows, err := db.DB.Query(`
		SELECT id, name FROM folders 
		WHERE parent_id = ? AND is_trashed = 0
	`, folderID)
	if err != nil {
		return err
	}
	defer subRows.Close()

	var subfolders []struct {
		id   string
		name string
	}
	for subRows.Next() {
		var id, name string
		if err := subRows.Scan(&id, &name); err == nil {
			subfolders = append(subfolders, struct {
				id   string
				name string
			}{id: id, name: name})
		}
	}

	for _, sf := range subfolders {
		nextPath := filepath.Join(currentPath, sf.name)
		if err := s.addFolderToZip(sf.id, nextPath, zw); err != nil {
			return err
		}
	}

	return nil
}

// UpdateUserStorage updates user's storage_used column
func (s *StorageService) UpdateUserStorage(userID string) (int64, error) {
	var totalBytes sql.NullInt64
	err := db.DB.QueryRow(`
		SELECT SUM(size) FROM files 
		WHERE owner_id = ? AND is_trashed = 0
	`, userID).Scan(&totalBytes)
	if err != nil {
		return 0, err
	}

	var used int64
	if totalBytes.Valid {
		used = totalBytes.Int64
	}

	_, err = db.DB.Exec("UPDATE users SET storage_used = ? WHERE id = ?", used, userID)
	return used, err
}
