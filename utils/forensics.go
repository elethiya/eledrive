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
	"net"
	"net/http"
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
	Platform          string `json:"platform"`
	SecretUUID        string `json:"secret_uuid"`
	SessionUUID       string `json:"session_uuid,omitempty"`
	UploaderID        string `json:"uploader_id,omitempty"`
	UploaderName      string `json:"uploader_name,omitempty"`
	UploaderEmail     string `json:"uploader_email,omitempty"`
	UploaderUsername  string `json:"uploader_username,omitempty"`
	RecipientID       string `json:"recipient_id,omitempty"`
	RecipientName     string `json:"recipient_name,omitempty"`
	RecipientEmail    string `json:"recipient_email,omitempty"`
	RecipientUsername string `json:"recipient_username,omitempty"`
	AccessType        string `json:"access_type,omitempty"` // "BROWSER_VIEW", "DIRECT_DOWNLOAD", "WORKSPACE_ORIGIN"
	AccessedAt        string `json:"accessed_at,omitempty"`
	ClientIP          string `json:"client_ip,omitempty"`
	UserAgent         string `json:"user_agent,omitempty"`
	Filename          string `json:"filename"`
	Timestamp         string `json:"timestamp"`
	Signature         string `json:"signature"`
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

// ComputeDynamicForensicHMAC computes a verifiable digital signature for dynamic access attribution
func ComputeDynamicForensicHMAC(secretUUID, recipientID, accessType, accessedAt, secretKey string) string {
	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write(fmt.Appendf(nil, "%s:%s:%s:%s", secretUUID, recipientID, accessType, accessedAt))
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

// BuildAccessForensicTrailer creates dynamic personalized forensic trailer for browser preview or direct download
func BuildAccessForensicTrailer(
	secretUUID, uploaderID, uploaderName, uploaderEmail, uploaderUsername string,
	recipientID, recipientName, recipientEmail, recipientUsername string,
	accessType, clientIP, userAgent, filename, secretKey string,
) (string, []byte) {
	ts := time.Now().UTC().Format(time.RFC3339)
	sig := ComputeDynamicForensicHMAC(secretUUID, recipientID, accessType, ts, secretKey)
	sessionUUID := uuid.New().String()

	payload := EmbeddedForensicPayload{
		Platform:          "EleDrive Protected Asset",
		SecretUUID:        secretUUID,
		SessionUUID:       sessionUUID,
		UploaderID:        uploaderID,
		UploaderName:      uploaderName,
		UploaderEmail:     uploaderEmail,
		UploaderUsername:  uploaderUsername,
		RecipientID:       recipientID,
		RecipientName:     recipientName,
		RecipientEmail:    recipientEmail,
		RecipientUsername: recipientUsername,
		AccessType:        accessType,
		AccessedAt:        ts,
		ClientIP:          clientIP,
		UserAgent:         userAgent,
		Filename:          filename,
		Timestamp:         ts,
		Signature:         sig,
	}

	metaJSON, _ := json.Marshal(payload)
	block := fmt.Appendf(nil, "%s%s%s", ForensicTagStart, string(metaJSON), ForensicTagEnd)

	return string(metaJSON), block
}

// WatermarkedReadSeeker wraps an *os.File and virtually appends a dynamic forensic trailer without modifying disk
type WatermarkedReadSeeker struct {
	file          *os.File
	trailer       []byte
	fileSize      int64
	totalSize     int64
	currentOffset int64
}

// NewWatermarkedReadSeeker creates a new WatermarkedReadSeeker
func NewWatermarkedReadSeeker(file *os.File, trailer []byte) (*WatermarkedReadSeeker, error) {
	fi, err := file.Stat()
	if err != nil {
		return nil, err
	}
	fileSize := fi.Size()
	return &WatermarkedReadSeeker{
		file:          file,
		trailer:       trailer,
		fileSize:      fileSize,
		totalSize:     fileSize + int64(len(trailer)),
		currentOffset: 0,
	}, nil
}

func (ws *WatermarkedReadSeeker) TotalSize() int64 {
	return ws.totalSize
}

func (ws *WatermarkedReadSeeker) Close() error {
	return ws.file.Close()
}

func (ws *WatermarkedReadSeeker) Seek(offset int64, whence int) (int64, error) {
	var newOffset int64
	switch whence {
	case io.SeekStart:
		newOffset = offset
	case io.SeekCurrent:
		newOffset = ws.currentOffset + offset
	case io.SeekEnd:
		newOffset = ws.totalSize + offset
	default:
		return 0, fmt.Errorf("invalid whence: %d", whence)
	}

	if newOffset < 0 {
		return 0, fmt.Errorf("negative seek offset: %d", newOffset)
	}

	if newOffset <= ws.fileSize {
		if _, err := ws.file.Seek(newOffset, io.SeekStart); err != nil {
			return 0, err
		}
	} else {
		if _, err := ws.file.Seek(ws.fileSize, io.SeekStart); err != nil {
			return 0, err
		}
	}

	ws.currentOffset = newOffset
	return ws.currentOffset, nil
}

func (ws *WatermarkedReadSeeker) Read(p []byte) (int, error) {
	if ws.currentOffset >= ws.totalSize {
		return 0, io.EOF
	}

	totalRead := 0

	// Phase 1: Read from file if currentOffset is before fileSize
	if ws.currentOffset < ws.fileSize {
		availableInFile := ws.fileSize - ws.currentOffset
		toRead := int64(len(p))
		if toRead > availableInFile {
			toRead = availableInFile
		}

		n, err := ws.file.Read(p[:toRead])
		totalRead += n
		ws.currentOffset += int64(n)
		if err != nil && err != io.EOF {
			return totalRead, err
		}
	}

	// Phase 2: Read from trailer if buffer has room and offset is in trailer region
	if totalRead < len(p) && ws.currentOffset >= ws.fileSize && ws.currentOffset < ws.totalSize {
		trailerOffset := ws.currentOffset - ws.fileSize
		trailerAvail := int64(len(ws.trailer)) - trailerOffset
		toRead := int64(len(p) - totalRead)
		if toRead > trailerAvail {
			toRead = trailerAvail
		}

		copy(p[totalRead:totalRead+int(toRead)], ws.trailer[trailerOffset:trailerOffset+toRead])
		totalRead += int(toRead)
		ws.currentOffset += toRead
	}

	if totalRead == 0 && ws.currentOffset >= ws.totalSize {
		return 0, io.EOF
	}

	return totalRead, nil
}

// GetClientIP extracts real client IP from headers or RemoteAddr
func GetClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		return strings.TrimSpace(xrip)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
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

func payloadToInspectionResult(payload EmbeddedForensicPayload, checksum, secretKey string) *models.ForensicInspectionResult {
	var sigValid bool
	if payload.RecipientID != "" && payload.AccessType != "" {
		expectedSig := ComputeDynamicForensicHMAC(payload.SecretUUID, payload.RecipientID, payload.AccessType, payload.AccessedAt, secretKey)
		sigValid = (payload.Signature == expectedSig)
		if !sigValid && payload.Timestamp != "" {
			expectedSig2 := ComputeForensicHMAC(payload.SecretUUID, payload.UploaderID, payload.Timestamp, secretKey)
			sigValid = (payload.Signature == expectedSig2)
		}
	} else {
		expectedSig := ComputeForensicHMAC(payload.SecretUUID, payload.UploaderID, payload.Timestamp, secretKey)
		sigValid = (payload.Signature == expectedSig)
	}

	var parsedUploadedAt *time.Time
	if payload.Timestamp != "" {
		if t, err := time.Parse(time.RFC3339, payload.Timestamp); err == nil {
			parsedUploadedAt = &t
		}
	}

	var parsedAccessedAt *time.Time
	if payload.AccessedAt != "" {
		if t, err := time.Parse(time.RFC3339, payload.AccessedAt); err == nil {
			parsedAccessedAt = &t
		}
	}

	res := &models.ForensicInspectionResult{
		Matched:          true,
		SecretUUID:       payload.SecretUUID,
		OriginalFilename: payload.Filename,
		UploaderID:       payload.UploaderID,
		UploaderName:     payload.UploaderName,
		UploaderEmail:    payload.UploaderEmail,
		UploaderUsername: payload.UploaderUsername,
		UploadedAt:       parsedUploadedAt,
		SignatureValid:   sigValid,
		SHA256Checksum:   checksum,
		RiskAssessment:   "LEAK_IDENTIFIED",
		SessionUUID:      payload.SessionUUID,
		ClientIP:         payload.ClientIP,
		UserAgent:        payload.UserAgent,
	}

	if payload.RecipientID != "" {
		res.LeakerIdentified = true
		res.LeakerID = payload.RecipientID
		res.LeakerName = payload.RecipientName
		res.LeakerEmail = payload.RecipientEmail
		res.LeakerUsername = payload.RecipientUsername
		res.AccessType = payload.AccessType
		res.AccessedAt = parsedAccessedAt

		timeStr := payload.AccessedAt
		if parsedAccessedAt != nil {
			timeStr = parsedAccessedAt.Format("2006-01-02 15:04:05 MST")
		}

		if payload.AccessType == "BROWSER_VIEW" {
			res.ExfiltrationMethod = "Browser Load / Right-Click / DevTools Exfiltration"
			res.ExfiltrationVerdict = fmt.Sprintf("CONFIRMED LEAK: Asset was loaded in browser preview by %s (@%s - %s) on %s and illegally exfiltrated via browser right-click save, DevTools, or browser extension.", payload.RecipientName, payload.RecipientUsername, payload.RecipientEmail, timeStr)
			res.MetadataSummary = fmt.Sprintf("Exfiltrated via browser preview by %s (@%s) on %s. IP: %s", payload.RecipientName, payload.RecipientUsername, timeStr, payload.ClientIP)
		} else if payload.AccessType == "DIRECT_DOWNLOAD" {
			res.ExfiltrationMethod = "Direct File Download"
			res.ExfiltrationVerdict = fmt.Sprintf("CONFIRMED LEAK: Asset was directly downloaded from workspace by %s (@%s - %s) on %s.", payload.RecipientName, payload.RecipientUsername, payload.RecipientEmail, timeStr)
			res.MetadataSummary = fmt.Sprintf("Directly downloaded by %s (@%s) on %s. IP: %s", payload.RecipientName, payload.RecipientUsername, timeStr, payload.ClientIP)
		} else {
			res.ExfiltrationMethod = payload.AccessType
			res.ExfiltrationVerdict = fmt.Sprintf("Asset accessed by %s (@%s) on %s.", payload.RecipientName, payload.RecipientUsername, timeStr)
			res.MetadataSummary = res.ExfiltrationVerdict
		}
	} else {
		// Only uploader info was present
		res.LeakerIdentified = true
		res.LeakerID = payload.UploaderID
		res.LeakerName = payload.UploaderName
		res.LeakerEmail = payload.UploaderEmail
		res.LeakerUsername = payload.UploaderUsername
		res.AccessType = "WORKSPACE_ORIGIN"
		res.AccessedAt = parsedUploadedAt
		res.ExfiltrationMethod = "Direct Uploader Exfiltration / Workspace Master Copy"
		res.ExfiltrationVerdict = fmt.Sprintf("CONFIRMED LEAK: Asset was exfiltrated directly from workspace storage by original uploader %s (@%s). No recipient download/view trailer was detected.", payload.UploaderName, payload.UploaderUsername)
		res.MetadataSummary = fmt.Sprintf("Original upload by %s (%s) with verified Secret UUID", payload.UploaderName, payload.UploaderEmail)
	}

	return res
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

	recipientID, _ := m["recipient_id"].(string)
	recipientName, _ := m["recipient_name"].(string)
	recipientEmail, _ := m["recipient_email"].(string)
	recipientUsername, _ := m["recipient_username"].(string)
	accessType, _ := m["access_type"].(string)
	clientIP, _ := m["client_ip"].(string)

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

	res := &models.ForensicInspectionResult{
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
		ClientIP:         clientIP,
	}

	if recipientID != "" {
		res.LeakerIdentified = true
		res.LeakerID = recipientID
		res.LeakerName = recipientName
		res.LeakerEmail = recipientEmail
		res.LeakerUsername = recipientUsername
		res.AccessType = accessType
		res.AccessedAt = parsedTime
		if accessType == "BROWSER_VIEW" {
			res.ExfiltrationMethod = "Browser Load / Right-Click / DevTools Exfiltration"
			res.ExfiltrationVerdict = fmt.Sprintf("CONFIRMED LEAK: Manifest attributes asset to browser view exfiltration by %s (@%s - %s).", recipientName, recipientUsername, recipientEmail)
		} else {
			res.ExfiltrationMethod = "Direct File Download"
			res.ExfiltrationVerdict = fmt.Sprintf("CONFIRMED LEAK: Manifest attributes asset to direct download by %s (@%s - %s).", recipientName, recipientUsername, recipientEmail)
		}
	} else if ownerID != "" {
		res.LeakerIdentified = true
		res.LeakerID = ownerID
		res.LeakerName = uploaderName
		res.LeakerEmail = uploaderEmail
		res.AccessType = "WORKSPACE_ORIGIN"
		res.AccessedAt = parsedTime
		res.ExfiltrationMethod = "Direct Uploader Exfiltration / Workspace Master Copy"
		res.ExfiltrationVerdict = fmt.Sprintf("CONFIRMED LEAK: Asset was exfiltrated directly from workspace storage by original creator %s (%s).", uploaderName, uploaderEmail)
	}

	return res, nil
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

	// 1. Check for standard EleDrive binary forensic tag trailer (searches backwards for latest tag)
	startIdx := bytes.LastIndex(data, []byte(ForensicTagStart))
	if startIdx != -1 {
		payloadStart := startIdx + len(ForensicTagStart)
		endIdx := bytes.Index(data[payloadStart:], []byte(ForensicTagEnd))
		if endIdx != -1 {
			jsonBytes := data[payloadStart : payloadStart+endIdx]
			var payload EmbeddedForensicPayload
			if err := json.Unmarshal(jsonBytes, &payload); err == nil && payload.SecretUUID != "" {
				return payloadToInspectionResult(payload, checksum, secretKey), nil
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
						return payloadToInspectionResult(payload, checksum, secretKey), nil
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

// LogDownloadEvent records an access/download event to download_logs table
func LogDownloadEvent(database *sql.DB, targetType, targetID, secretUUID, userID, userName, userEmail, ip, userAgent string, accessType ...string) {
	if database == nil {
		return
	}
	act := "download"
	if len(accessType) > 0 && accessType[0] != "" {
		act = accessType[0]
	}
	id := uuid.New().String()
	_, _ = database.Exec(`
		INSERT INTO main.download_logs (id, target_type, target_id, secret_uuid, user_id, user_name, user_email, ip_address, user_agent, access_type, downloaded_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, targetType, targetID, secretUUID, userID, userName, userEmail, ip, userAgent, act, time.Now())
}
