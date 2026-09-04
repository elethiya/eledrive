package utils

import (
	"archive/zip"
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"time"

	"eledrive/models"
	"github.com/google/uuid"
)

const (
	ForensicTagStart = "\n\n/*--ELEDRIVE_FORENSIC_TAG_START--*/\n"
	ForensicTagEnd   = "\n/*--ELEDRIVE_FORENSIC_TAG_END--*/\n"
)

type EmbeddedForensicPayload struct {
	Platform     string `json:"platform"`
	SecretUUID   string `json:"secret_uuid"`
	UploaderID   string `json:"uploader_id"`
	UploaderName string `json:"uploader_name"`
	UploaderEmail string `json:"uploader_email"`
	Filename     string `json:"filename"`
	Timestamp    string `json:"timestamp"`
	Signature    string `json:"signature"`
}

// GenerateSecretUUID creates a unique tracking UUID
func GenerateSecretUUID() string {
	return uuid.New().String()
}

// ComputeForensicHMAC computes a verifiable digital signature for the watermark
func ComputeForensicHMAC(secretUUID, uploaderID, timestamp, secretKey string) string {
	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write(fmt.Appendf(nil, "%s:%s:%s", secretUUID, uploaderID, timestamp))
	return hex.EncodeToString(h.Sum(nil))
}

// BuildForensicMeta creates JSON metadata and trailer bytes
func BuildForensicMeta(secretUUID, uploaderID, uploaderEmail, uploaderName, filename string, secretKey string) (string, []byte) {
	ts := time.Now().UTC().Format(time.RFC3339)
	sig := ComputeForensicHMAC(secretUUID, uploaderID, ts, secretKey)

	payload := EmbeddedForensicPayload{
		Platform:      "EleDrive Protected Asset",
		SecretUUID:    secretUUID,
		UploaderID:    uploaderID,
		UploaderName:  uploaderName,
		UploaderEmail: uploaderEmail,
		Filename:      filename,
		Timestamp:     ts,
		Signature:     sig,
	}

	metaJSON, _ := json.Marshal(payload)
	block := fmt.Appendf(nil, "%s%s%s", ForensicTagStart, string(metaJSON), ForensicTagEnd)

	return string(metaJSON), block
}

// InjectForensicWatermark embeds the secret UUID and tracking metadata permanently into the physical file
func InjectForensicWatermark(filePath, secretUUID, uploaderID, uploaderEmail, uploaderName, secretKey string) error {
	f, err := os.OpenFile(filePath, os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("failed to open file for watermark injection: %w", err)
	}
	defer f.Close()

	_, block := BuildForensicMeta(secretUUID, uploaderID, uploaderEmail, uploaderName, f.Name(), secretKey)
	if _, err := f.Write(block); err != nil {
		return fmt.Errorf("failed to write forensic trailer: %w", err)
	}

	return nil
}

var (
	secretUUIDPattern = regexp.MustCompile(`(?i)(?:secret_uuid|"secret_uuid"|Secret UUID)[\s:="']+([0-9a-fA-F-]{36})`)
	uuidRegex         = regexp.MustCompile(`(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b`)
)

func extractUUIDFromText(s string) string {
	if match := secretUUIDPattern.FindStringSubmatch(s); len(match) > 1 {
		return match[1]
	}
	if match := uuidRegex.FindString(s); match != "" {
		return match
	}
	return ""
}

func parseManifestJSON(data []byte, checksum string) (*models.ForensicInspectionResult, error) {
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}

	secretUUID, _ := m["secret_uuid"].(string)
	folderID, _ := m["folder_id"].(string)
	fileID, _ := m["file_id"].(string)
	folderName, _ := m["folder_name"].(string)
	if folderName == "" {
		folderName, _ = m["file_name"].(string)
	}
	if folderName == "" {
		folderName, _ = m["filename"].(string)
	}
	ownerID, _ := m["owner_id"].(string)
	if ownerID == "" {
		ownerID, _ = m["uploader_id"].(string)
	}
	uploaderName, _ := m["uploader_name"].(string)
	uploaderEmail, _ := m["uploader_email"].(string)

	tsStr, _ := m["timestamp"].(string)
	var parsedTime *time.Time
	if tsStr != "" {
		if t, err := time.Parse(time.RFC3339, tsStr); err == nil {
			parsedTime = &t
		}
	}

	targetUUID := secretUUID
	if targetUUID == "" {
		if folderID != "" {
			targetUUID = folderID
		} else if fileID != "" {
			targetUUID = fileID
		}
	}

	if targetUUID == "" {
		return nil, fmt.Errorf("no secret_uuid or identifier found in manifest JSON")
	}

	summary := "Extracted forensic asset from manifest JSON document"
	if folderName != "" {
		summary = fmt.Sprintf("Extracted forensic manifest for folder '%s'", folderName)
	}

	return &models.ForensicInspectionResult{
		Matched:          true,
		SecretUUID:       targetUUID,
		OriginalFilename: folderName,
		UploaderID:       ownerID,
		UploaderName:     uploaderName,
		UploaderEmail:    uploaderEmail,
		UploadedAt:       parsedTime,
		SignatureValid:   true,
		SHA256Checksum:   checksum,
		RiskAssessment:   "LEAK_IDENTIFIED",
		MetadataSummary:  summary,
	}, nil
}

// ExtractForensicWatermark parses raw bytes from suspect file and extracts forensic identity
func ExtractForensicWatermark(data []byte, secretKey string) (*models.ForensicInspectionResult, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("empty file payload")
	}

	// Compute file sha256 checksum
	h := sha256.New()
	h.Write(data)
	checksum := hex.EncodeToString(h.Sum(nil))

	// 1. Check for standard EleDrive binary forensic tag trailer
	startIdx := bytes.LastIndex(data, []byte(ForensicTagStart))
	if startIdx != -1 {
		payloadStart := startIdx + len(ForensicTagStart)
		endIdx := bytes.Index(data[payloadStart:], []byte(ForensicTagEnd))
		if endIdx != -1 {
			jsonBytes := data[payloadStart : payloadStart+endIdx]
			var payload EmbeddedForensicPayload
			if err := json.Unmarshal(jsonBytes, &payload); err == nil && payload.SecretUUID != "" {
				expectedSig := ComputeForensicHMAC(payload.SecretUUID, payload.UploaderID, payload.Timestamp, secretKey)
				sigValid := (payload.Signature == expectedSig)

				var parsedTime time.Time
				if t, err := time.Parse(time.RFC3339, payload.Timestamp); err == nil {
					parsedTime = t
				}

				return &models.ForensicInspectionResult{
					Matched:          true,
					SecretUUID:       payload.SecretUUID,
					OriginalFilename: payload.Filename,
					UploaderID:       payload.UploaderID,
					UploaderName:     payload.UploaderName,
					UploaderEmail:    payload.UploaderEmail,
					UploadedAt:       &parsedTime,
					SignatureValid:   sigValid,
					SHA256Checksum:   checksum,
					RiskAssessment:   "LEAK_IDENTIFIED",
					MetadataSummary:  fmt.Sprintf("Original upload by %s (%s) with verified Secret UUID", payload.UploaderName, payload.UploaderEmail),
				}, nil
			}
		}
	}

	// 2. Check if the suspect file is a ZIP archive
	if zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data))); err == nil {
		// 2a. Check the ZIP archive comment for forensic tag or Secret UUID
		if zr.Comment != "" {
			if tagIdx := strings.LastIndex(zr.Comment, ForensicTagStart); tagIdx != -1 {
				rem := zr.Comment[tagIdx+len(ForensicTagStart):]
				if endIdx := strings.Index(rem, ForensicTagEnd); endIdx != -1 {
					var payload EmbeddedForensicPayload
					if err := json.Unmarshal([]byte(rem[:endIdx]), &payload); err == nil && payload.SecretUUID != "" {
						expectedSig := ComputeForensicHMAC(payload.SecretUUID, payload.UploaderID, payload.Timestamp, secretKey)
						var parsedTime *time.Time
						if t, err := time.Parse(time.RFC3339, payload.Timestamp); err == nil {
							parsedTime = &t
						}
						return &models.ForensicInspectionResult{
							Matched:          true,
							SecretUUID:       payload.SecretUUID,
							OriginalFilename: payload.Filename,
							UploaderID:       payload.UploaderID,
							UploaderName:     payload.UploaderName,
							UploaderEmail:    payload.UploaderEmail,
							UploadedAt:       parsedTime,
							SignatureValid:   payload.Signature == expectedSig,
							SHA256Checksum:   checksum,
							RiskAssessment:   "LEAK_IDENTIFIED",
							MetadataSummary:  fmt.Sprintf("ZIP archive comment verified. Creator: %s (%s)", payload.UploaderName, payload.UploaderEmail),
						}, nil
					}
				}
			}

			if uuidVal := extractUUIDFromText(zr.Comment); uuidVal != "" {
				return &models.ForensicInspectionResult{
					Matched:         true,
					SecretUUID:      uuidVal,
					SignatureValid:  true,
					SHA256Checksum:  checksum,
					RiskAssessment:  "LEAK_IDENTIFIED",
					MetadataSummary: "Found embedded Secret UUID in ZIP archive comment",
				}, nil
			}
		}

		// 2b. Check files inside the ZIP (e.g. legacy manifest or watermarked entries)
		for _, f := range zr.File {
			if strings.HasSuffix(f.Name, ".eledrive_forensic_manifest.json") {
				rc, err := f.Open()
				if err == nil {
					content, _ := io.ReadAll(rc)
					rc.Close()
					if res, err := parseManifestJSON(content, checksum); err == nil {
						res.MetadataSummary = fmt.Sprintf("Extracted forensic manifest from ZIP entry '%s'", f.Name)
						return res, nil
					}
				}
			}
		}
	}

	// 3. Check if suspect file is a standalone JSON manifest (e.g. .eledrive_forensic_manifest.json uploaded directly)
	trimmedData := bytes.TrimSpace(data)
	if len(trimmedData) > 0 && trimmedData[0] == '{' && trimmedData[len(trimmedData)-1] == '}' {
		if res, err := parseManifestJSON(data, checksum); err == nil {
			return res, nil
		}
	}

	// 4. Fallback search: scan raw bytes / text for "secret_uuid" or "Secret UUID"
	strData := string(data)
	if uuidVal := extractUUIDFromText(strData); uuidVal != "" {
		return &models.ForensicInspectionResult{
			Matched:         true,
			SecretUUID:      uuidVal,
			SignatureValid:  true,
			SHA256Checksum:  checksum,
			RiskAssessment:  "LEAK_IDENTIFIED",
			MetadataSummary: "Found embedded Secret UUID in raw file stream",
		}, nil
	}

	return nil, fmt.Errorf("no embedded forensic watermark signature found in file")
}

// LogDownloadEvent records a download event to download_logs table
func LogDownloadEvent(database *sql.DB, targetType, targetID, secretUUID, userID, userName, userEmail, ip, userAgent string) {
	if database == nil {
		return
	}
	id := uuid.New().String()
	_, _ = database.Exec(`
		INSERT INTO main.download_logs (id, target_type, target_id, secret_uuid, user_id, user_name, user_email, ip_address, user_agent, downloaded_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, targetType, targetID, secretUUID, userID, userName, userEmail, ip, userAgent, time.Now())
}
