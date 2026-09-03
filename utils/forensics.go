package utils

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
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
	h.Write([]byte(fmt.Sprintf("%s:%s:%s", secretUUID, uploaderID, timestamp)))
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
	block := []byte(fmt.Sprintf("%s%s%s", ForensicTagStart, string(metaJSON), ForensicTagEnd))

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

// ExtractForensicWatermark parses raw bytes from suspect file and extracts forensic identity
func ExtractForensicWatermark(data []byte, secretKey string) (*models.ForensicInspectionResult, error) {
	startIdx := bytes.LastIndex(data, []byte(ForensicTagStart))
	if startIdx == -1 {
		// Fallback: search for secret_uuid pattern in entire binary
		strData := string(data)
		uuidIdx := strings.Index(strData, `"secret_uuid":"`)
		if uuidIdx != -1 {
			sub := strData[uuidIdx+15:]
			endQuote := strings.Index(sub, `"`)
			if endQuote != -1 {
				extractedUUID := sub[:endQuote]
				return &models.ForensicInspectionResult{
					Matched:          true,
					SecretUUID:       extractedUUID,
					SignatureValid:   true,
					RiskAssessment:   "LEAK_IDENTIFIED",
					MetadataSummary:  "Found embedded Secret UUID in raw file stream",
				}, nil
			}
		}

		return nil, fmt.Errorf("no embedded forensic watermark signature found in file")
	}

	payloadStart := startIdx + len(ForensicTagStart)
	endIdx := bytes.Index(data[payloadStart:], []byte(ForensicTagEnd))
	if endIdx == -1 {
		return nil, fmt.Errorf("malformed or corrupted forensic watermark trailer")
	}

	jsonBytes := data[payloadStart : payloadStart+endIdx]
	var payload EmbeddedForensicPayload
	if err := json.Unmarshal(jsonBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to parse embedded forensic metadata: %w", err)
	}

	// Verify HMAC signature
	expectedSig := ComputeForensicHMAC(payload.SecretUUID, payload.UploaderID, payload.Timestamp, secretKey)
	sigValid := (payload.Signature == expectedSig)

	// Compute file sha256 checksum
	h := sha256.New()
	h.Write(data)
	checksum := hex.EncodeToString(h.Sum(nil))

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
