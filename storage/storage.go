package storage

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"eledrive/config"
	"eledrive/db"
	"eledrive/utils"
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
func (s *StorageService) ZipFolder(folderID string, folderName string, w io.Writer, downloaderID, downloaderName, downloaderEmail, downloaderUsername, ip, userAgent string) error {
	zipWriter := zip.NewWriter(w)

	// Look up folder secret UUID and creator info
	var secretUUID, ownerID, ownerName, ownerEmail string
	_ = db.DB.QueryRow(`
		SELECT COALESCE(f.secret_uuid, ''), f.owner_id, COALESCE(u.name, 'Unknown'), COALESCE(u.email, 'unknown@eledrive.local')
		FROM folders f
		LEFT JOIN users u ON f.owner_id = u.id
		WHERE f.id = ?
	`, folderID).Scan(&secretUUID, &ownerID, &ownerName, &ownerEmail)

	if secretUUID == "" {
		secretUUID = utils.GenerateSecretUUID()
		_, _ = db.DB.Exec("UPDATE folders SET secret_uuid = ? WHERE id = ?", secretUUID, folderID)
	}

	var block []byte
	if downloaderID != "" {
		_, block = utils.BuildAccessForensicTrailer(
			secretUUID,
			ownerID,
			ownerName,
			ownerEmail,
			"",
			downloaderID,
			downloaderName,
			downloaderEmail,
			downloaderUsername,
			"DIRECT_DOWNLOAD",
			ip,
			userAgent,
			folderName+".zip",
			s.cfg.JWTSecret,
		)
	} else {
		_, block = utils.BuildForensicMeta(secretUUID, ownerID, ownerEmail, ownerName, folderName+".zip", s.cfg.JWTSecret)
	}

	if secretUUID != "" {
		_ = zipWriter.SetComment(fmt.Sprintf("EleDrive Protected Archive | Secret UUID: %s\n%s", secretUUID, string(block)))
	}

	// Recursively collect items
	if err := s.addFolderToZip(folderID, folderName, zipWriter, downloaderID, downloaderName, downloaderEmail, downloaderUsername, ip, userAgent); err != nil {
		_ = zipWriter.Close()
		return err
	}

	if err := zipWriter.Close(); err != nil {
		return err
	}

	// Append steganographic forensic trailer block to ZIP stream
	_, _ = w.Write(block)
	return nil
}

func (s *StorageService) addFolderToZip(folderID string, currentPath string, zw *zip.Writer, downloaderID, downloaderName, downloaderEmail, downloaderUsername, ip, userAgent string) error {
	// Add an entry for current folder
	folderEntry := strings.Trim(currentPath, "/") + "/"
	_, err := zw.Create(folderEntry)
	if err != nil {
		return err
	}

	// Fetch files in this folder with secret_uuid and owner details
	rows, err := db.DB.Query(`
		SELECT f.id, f.name, f.storage_path, COALESCE(f.secret_uuid, ''), f.owner_id, COALESCE(u.name, 'Workspace User'), COALESCE(u.email, 'unknown@eledrive.local')
		FROM files f
		LEFT JOIN users u ON f.owner_id = u.id
		WHERE f.folder_id = ? AND f.is_trashed = 0
	`, folderID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var fID, fileName, storagePath, fileSecretUUID, fileOwnerID, fileOwnerName, fileOwnerEmail string
		if err := rows.Scan(&fID, &fileName, &storagePath, &fileSecretUUID, &fileOwnerID, &fileOwnerName, &fileOwnerEmail); err != nil {
			return err
		}

		if fileSecretUUID == "" {
			fileSecretUUID = utils.GenerateSecretUUID()
			_, _ = db.DB.Exec("UPDATE files SET secret_uuid = ? WHERE id = ?", fileSecretUUID, fID)
		}

		filePath := s.GetFilePath(storagePath)

		// Ensure the physical file contains the permanent cryptographic watermark trailer
		if fStat, err := os.Stat(filePath); err == nil && fStat.Size() < 50*1024*1024 {
			fileBytes, err := os.ReadFile(filePath)
			if err == nil && bytes.LastIndex(fileBytes, []byte(utils.ForensicTagStart)) == -1 {
				_ = utils.InjectForensicWatermark(filePath, fileSecretUUID, fileOwnerID, fileOwnerEmail, fileOwnerName, s.cfg.JWTSecret)
			}
		}

		fileData, err := os.Open(filePath)
		if err != nil {
			continue // skip if missing file
		}

		entryPath := filepath.Join(currentPath, fileName)
		header := &zip.FileHeader{
			Name:   entryPath,
			Method: zip.Deflate,
		}
		if downloaderID != "" {
			header.Comment = fmt.Sprintf("EleDrive Forensic Asset | Secret UUID: %s | Downloader: %s (%s)", fileSecretUUID, downloaderName, downloaderEmail)
		} else {
			header.Comment = fmt.Sprintf("EleDrive Forensic Asset | Secret UUID: %s", fileSecretUUID)
		}
		w, err := zw.CreateHeader(header)
		if err != nil {
			fileData.Close()
			return err
		}

		_, _ = io.Copy(w, fileData)
		fileData.Close()

		// If dynamic downloader info is present, also append dynamic access trailer to file inside ZIP
		if downloaderID != "" {
			_, fileTrailer := utils.BuildAccessForensicTrailer(
				fileSecretUUID,
				fileOwnerID,
				fileOwnerName,
				fileOwnerEmail,
				"",
				downloaderID,
				downloaderName,
				downloaderEmail,
				downloaderUsername,
				"DIRECT_DOWNLOAD",
				ip,
				userAgent,
				fileName,
				s.cfg.JWTSecret,
			)
			_, _ = w.Write(fileTrailer)
		}
	}
	if err := rows.Err(); err != nil {
		return err
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
		if err := subRows.Scan(&id, &name); err != nil {
			return err
		}
		subfolders = append(subfolders, struct {
			id   string
			name string
		}{id: id, name: name})
	}
	if err := subRows.Err(); err != nil {
		return err
	}

	for _, sf := range subfolders {
		nextPath := filepath.Join(currentPath, sf.name)
		if err := s.addFolderToZip(sf.id, nextPath, zw, downloaderID, downloaderName, downloaderEmail, downloaderUsername, ip, userAgent); err != nil {
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
