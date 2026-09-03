package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"eledrive/config"
	"eledrive/db"
	"eledrive/events"
	"eledrive/middleware"
	"eledrive/models"
	"eledrive/storage"
	"eledrive/utils"
)

type StatsHandler struct {
	cfg     *config.Config
	storage *storage.StorageService
}

func NewStatsHandler(cfg *config.Config, storage *storage.StorageService) *StatsHandler {
	return &StatsHandler{cfg: cfg, storage: storage}
}

func (h *StatsHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	var storageLimit, storageUsed int64
	_ = db.DB.QueryRow("SELECT storage_limit, storage_used FROM users WHERE id = ?", claims.UserID).Scan(&storageLimit, &storageUsed)

	var filesCount, foldersCount int
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM files WHERE owner_id = ? AND is_trashed = 0", claims.UserID).Scan(&filesCount)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM folders WHERE owner_id = ? AND is_trashed = 0", claims.UserID).Scan(&foldersCount)

	// Breakdown by type
	typeStats := map[string]int64{
		"documents": 0,
		"images":    0,
		"videos":    0,
		"audio":     0,
		"code":      0,
		"archives":  0,
		"other":     0,
	}

	rows, err := db.DB.Query(`
		SELECT size, mime_type, extension 
		FROM files 
		WHERE owner_id = ? AND is_trashed = 0
	`, claims.UserID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var sz int64
			var mime, ext string
			if err := rows.Scan(&sz, &mime, &ext); err == nil {
				mime = strings.ToLower(mime)
				ext = strings.ToLower(ext)

				if strings.HasPrefix(mime, "image/") {
					typeStats["images"] += sz
				} else if strings.HasPrefix(mime, "video/") {
					typeStats["videos"] += sz
				} else if strings.HasPrefix(mime, "audio/") {
					typeStats["audio"] += sz
				} else if strings.Contains(mime, "pdf") || strings.Contains(mime, "word") || strings.Contains(mime, "document") {
					typeStats["documents"] += sz
				} else if isCodeExtension(ext) || strings.Contains(mime, "javascript") || strings.Contains(mime, "json") {
					typeStats["code"] += sz
				} else if strings.Contains(mime, "zip") || strings.Contains(mime, "tar") || strings.Contains(mime, "gzip") {
					typeStats["archives"] += sz
				} else {
					typeStats["other"] += sz
				}
			}
		}
		if err := rows.Err(); err != nil {
			_ = err
		}
	}

	utils.RespondJSON(w, http.StatusOK, models.DriveStats{
		StorageUsed:  storageUsed,
		StorageLimit: storageLimit,
		FilesCount:   filesCount,
		FoldersCount: foldersCount,
		TypeStats:    typeStats,
	})
}

func (h *StatsHandler) GetRecent(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	rows, err := db.DB.Query(`
		SELECT f.id, f.name, f.original_name, f.folder_id, f.owner_id, u.name, u.email,
		       f.size, f.mime_type, f.extension, f.is_starred, f.is_trashed, f.created_at, f.updated_at
		FROM files f
		JOIN users u ON f.owner_id = u.id
		WHERE (f.owner_id = ? OR f.id IN (SELECT target_id FROM shares WHERE target_type = 'file' AND shared_with_user_id = ?))
		  AND f.is_trashed = 0
		ORDER BY f.updated_at DESC
		LIMIT 40
	`, claims.UserID, claims.UserID)
	if err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer rows.Close()

	files := make([]models.File, 0)
	for rows.Next() {
		var f models.File
		var folderID sql.NullString
		if err := rows.Scan(
			&f.ID, &f.Name, &f.OriginalName, &folderID, &f.OwnerID, &f.OwnerName, &f.OwnerEmail,
			&f.Size, &f.MimeType, &f.Extension, &f.IsStarred, &f.IsTrashed, &f.CreatedAt, &f.UpdatedAt,
		); err == nil {
			if folderID.Valid {
				f.FolderID = &folderID.String
			}
			files = append(files, f)
		}
	}
	if err := rows.Err(); err != nil {
		utils.RespondError(w, http.StatusInternalServerError, "Database error")
		return
	}

	utils.RespondJSON(w, http.StatusOK, files)
}

func (h *StatsHandler) GetStarred(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	// Folders
	fRows, err := db.DB.Query(`
		SELECT f.id, f.name, f.parent_id, f.owner_id, u.name, u.email, f.is_starred, f.is_trashed, f.color, f.created_at, f.updated_at,
		       (SELECT COUNT(*) FROM files WHERE folder_id = f.id AND is_trashed = 0) +
		       (SELECT COUNT(*) FROM folders WHERE parent_id = f.id AND is_trashed = 0) AS item_count
		FROM folders f
		JOIN users u ON f.owner_id = u.id
		WHERE f.owner_id = ? AND f.is_starred = 1 AND f.is_trashed = 0
		ORDER BY f.name ASC
	`, claims.UserID)

	folders := make([]models.Folder, 0)
	if err == nil {
		defer fRows.Close()
		for fRows.Next() {
			var f models.Folder
			var pID, col sql.NullString
			if err := fRows.Scan(
				&f.ID, &f.Name, &pID, &f.OwnerID, &f.OwnerName, &f.OwnerEmail,
				&f.IsStarred, &f.IsTrashed, &col, &f.CreatedAt, &f.UpdatedAt, &f.ItemCount,
			); err == nil {
				if pID.Valid {
					f.ParentID = &pID.String
				}
				if col.Valid {
					f.Color = &col.String
				}
				folders = append(folders, f)
			}
		}
		if err := fRows.Err(); err != nil {
			_ = err
		}
	}

	// Files
	fileRows, err := db.DB.Query(`
		SELECT f.id, f.name, f.original_name, f.folder_id, f.owner_id, u.name, u.email,
		       f.size, f.mime_type, f.extension, f.is_starred, f.is_trashed, f.created_at, f.updated_at
		FROM files f
		JOIN users u ON f.owner_id = u.id
		WHERE f.owner_id = ? AND f.is_starred = 1 AND f.is_trashed = 0
		ORDER BY f.name ASC
	`, claims.UserID)

	files := make([]models.File, 0)
	if err == nil {
		defer fileRows.Close()
		for fileRows.Next() {
			var fl models.File
			var pID sql.NullString
			if err := fileRows.Scan(
				&fl.ID, &fl.Name, &fl.OriginalName, &pID, &fl.OwnerID, &fl.OwnerName, &fl.OwnerEmail,
				&fl.Size, &fl.MimeType, &fl.Extension, &fl.IsStarred, &fl.IsTrashed, &fl.CreatedAt, &fl.UpdatedAt,
			); err == nil {
				if pID.Valid {
					fl.FolderID = &pID.String
				}
				files = append(files, fl)
			}
		}
		if err := fileRows.Err(); err != nil {
			_ = err
		}
	}

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"folders": folders,
		"files":   files,
	})
}

func (h *StatsHandler) GetTrash(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	// Trashed folders
	fRows, err := db.DB.Query(`
		SELECT f.id, f.name, f.parent_id, f.owner_id, u.name, u.email, f.is_starred, f.is_trashed, f.trashed_at, f.color, f.created_at, f.updated_at
		FROM folders f
		JOIN users u ON f.owner_id = u.id
		WHERE f.owner_id = ? AND f.is_trashed = 1
		ORDER BY f.trashed_at DESC
	`, claims.UserID)

	folders := make([]models.Folder, 0)
	if err == nil {
		defer fRows.Close()
		for fRows.Next() {
			var f models.Folder
			var pID, col sql.NullString
			var trashedAt sql.NullTime
			if err := fRows.Scan(
				&f.ID, &f.Name, &pID, &f.OwnerID, &f.OwnerName, &f.OwnerEmail,
				&f.IsStarred, &f.IsTrashed, &trashedAt, &col, &f.CreatedAt, &f.UpdatedAt,
			); err == nil {
				if pID.Valid {
					f.ParentID = &pID.String
				}
				if col.Valid {
					f.Color = &col.String
				}
				if trashedAt.Valid {
					f.TrashedAt = &trashedAt.Time
				}
				folders = append(folders, f)
			}
		}
		if err := fRows.Err(); err != nil {
			_ = err
		}
	}

	// Trashed files
	fileRows, err := db.DB.Query(`
		SELECT f.id, f.name, f.original_name, f.folder_id, f.owner_id, u.name, u.email,
		       f.size, f.mime_type, f.extension, f.is_starred, f.is_trashed, f.trashed_at, f.created_at, f.updated_at
		FROM files f
		JOIN users u ON f.owner_id = u.id
		WHERE f.owner_id = ? AND f.is_trashed = 1
		ORDER BY f.trashed_at DESC
	`, claims.UserID)

	files := make([]models.File, 0)
	if err == nil {
		defer fileRows.Close()
		for fileRows.Next() {
			var fl models.File
			var pID sql.NullString
			var trashedAt sql.NullTime
			if err := fileRows.Scan(
				&fl.ID, &fl.Name, &fl.OriginalName, &pID, &fl.OwnerID, &fl.OwnerName, &fl.OwnerEmail,
				&fl.Size, &fl.MimeType, &fl.Extension, &fl.IsStarred, &fl.IsTrashed, &trashedAt, &fl.CreatedAt, &fl.UpdatedAt,
			); err == nil {
				if pID.Valid {
					fl.FolderID = &pID.String
				}
				if trashedAt.Valid {
					fl.TrashedAt = &trashedAt.Time
				}
				files = append(files, fl)
			}
		}
		if err := fileRows.Err(); err != nil {
			_ = err
		}
	}

	utils.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"folders": folders,
		"files":   files,
	})
}

func (h *StatsHandler) EmptyTrash(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())

	// Delete all trashed files from disk & db
	rows, err := db.DB.Query("SELECT storage_path FROM files WHERE owner_id = ? AND is_trashed = 1", claims.UserID)
	if err == nil {
		for rows.Next() {
			var path string
			if err := rows.Scan(&path); err == nil {
				_ = h.storage.DeleteFile(path)
			}
		}
		if err := rows.Err(); err != nil {
			_ = err
		}
		rows.Close()
	}

	_, _ = db.DB.Exec("DELETE FROM files WHERE owner_id = ? AND is_trashed = 1", claims.UserID)
	_, _ = db.DB.Exec("DELETE FROM folders WHERE owner_id = ? AND is_trashed = 1", claims.UserID)

	_, _ = h.storage.UpdateUserStorage(claims.UserID)
	events.Broadcast("trash:empty", "trash", "empty", "", "", claims.UserID, nil)
	utils.RespondSuccess(w, http.StatusOK, "Trash emptied", nil)
}
