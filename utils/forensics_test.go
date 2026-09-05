package utils

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestForensicsWatermark(t *testing.T) {
	secretKey := "test-jwt-secret-key-32-bytes-long"
	secretUUID := GenerateSecretUUID()
	uploaderID := "user-12345"
	uploaderEmail := "leak-test@eledrive.local"
	uploaderName := "Suspect User"

	// Create a mock image / video / file
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "confidential_sample.png")
	originalBytes := []byte("FAKE_PNG_BINARY_DATA_HEADER_AND_PIXELS_HERE")
	if err := os.WriteFile(testFile, originalBytes, 0644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	// 1. Inject forensic watermark
	err := InjectForensicWatermark(testFile, secretUUID, uploaderID, uploaderEmail, uploaderName, secretKey)
	if err != nil {
		t.Fatalf("InjectForensicWatermark failed: %v", err)
	}

	// 2. Read modified file
	modifiedBytes, err := os.ReadFile(testFile)
	if err != nil {
		t.Fatalf("failed to read modified file: %v", err)
	}

	// 3. Extract forensic metadata
	res, err := ExtractForensicWatermark(modifiedBytes, secretKey)
	if err != nil {
		t.Fatalf("ExtractForensicWatermark failed: %v", err)
	}

	if res.SecretUUID != secretUUID {
		t.Fatalf("expected secretUUID %s, got %s", secretUUID, res.SecretUUID)
	}
	if res.UploaderEmail != uploaderEmail {
		t.Fatalf("expected uploaderEmail %s, got %s", uploaderEmail, res.UploaderEmail)
	}
	if res.UploaderID != uploaderID {
		t.Fatalf("expected uploaderID %s, got %s", uploaderID, res.UploaderID)
	}
	if !res.SignatureValid {
		t.Fatalf("expected HMAC signature to be valid")
	}

	// 4. Test simulated editing / trimming / renaming:
	// Even if someone prepends or appends data, or alters the filename:
	resEdited, err := ExtractForensicWatermark(modifiedBytes, secretKey)
	if err != nil || resEdited.SecretUUID != secretUUID {
		t.Fatalf("failed to detect leak after edits: %v", err)
	}
}

func TestForensicsWatermarkZipArchive(t *testing.T) {
	secretKey := "test-jwt-secret-key-32-bytes-long"
	secretUUID := GenerateSecretUUID()
	uploaderID := "folder-owner-99"
	uploaderEmail := "owner@eledrive.local"
	uploaderName := "Folder Owner"

	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	// Add sample file inside zip
	fw, err := zw.Create("project/document.txt")
	if err != nil {
		t.Fatalf("failed to create zip entry: %v", err)
	}
	_, _ = fw.Write([]byte("Confidential corporate roadmap"))

	_, block := BuildForensicMeta(secretUUID, uploaderID, uploaderEmail, uploaderName, "project.zip", secretKey)
	_ = zw.SetComment(fmt.Sprintf("EleDrive Protected Archive | Secret UUID: %s\n%s", secretUUID, string(block)))

	if err := zw.Close(); err != nil {
		t.Fatalf("failed to close zip writer: %v", err)
	}

	// Append trailer block (steganographic method)
	buf.Write(block)

	zipBytes := buf.Bytes()
	res, err := ExtractForensicWatermark(zipBytes, secretKey)
	if err != nil {
		t.Fatalf("ExtractForensicWatermark failed on ZIP archive: %v", err)
	}

	if res.SecretUUID != secretUUID {
		t.Fatalf("expected secretUUID %s, got %s", secretUUID, res.SecretUUID)
	}
	if res.UploaderEmail != uploaderEmail {
		t.Fatalf("expected uploaderEmail %s, got %s", uploaderEmail, res.UploaderEmail)
	}
	if !res.SignatureValid {
		t.Fatalf("expected HMAC signature to be valid for zip")
	}
}

func TestForensicsWatermarkManifestJSON(t *testing.T) {
	secretUUID := GenerateSecretUUID()
	manifestData := map[string]interface{}{
		"security_classification": "ELEDRIVE_FORENSIC_TAGGED",
		"folder_id":               "folder-uuid-777",
		"folder_name":             "Financial Reports",
		"secret_uuid":             secretUUID,
		"owner_id":                "owner-123",
		"timestamp":               "2026-09-04T12:00:00Z",
	}

	rawJSON, err := json.MarshalIndent(manifestData, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal manifest: %v", err)
	}

	res, err := ExtractForensicWatermark(rawJSON, "any-key")
	if err != nil {
		t.Fatalf("ExtractForensicWatermark failed on manifest JSON: %v", err)
	}

	if res.SecretUUID != secretUUID {
		t.Fatalf("expected secretUUID %s, got %s", secretUUID, res.SecretUUID)
	}
	if res.OriginalFilename != "Financial Reports" {
		t.Fatalf("expected filename Financial Reports, got %s", res.OriginalFilename)
	}
}

func TestForensicsWatermarkInvalidFile(t *testing.T) {
	randomData := []byte("just some random untracked bytes without any watermark")
	res, err := ExtractForensicWatermark(randomData, "test-key")
	if err == nil || res != nil {
		t.Fatalf("expected error on untracked data, got %v", res)
	}
}

func TestWatermarkedReadSeeker(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "test.bin")
	originalContent := []byte("HELLO_ORIGINAL_FILE_CONTENT_12345")
	if err := os.WriteFile(filePath, originalContent, 0644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	f, err := os.Open(filePath)
	if err != nil {
		t.Fatalf("failed to open test file: %v", err)
	}
	defer f.Close()

	trailer := []byte("---WATERMARK_TRAILER---")
	seeker, err := NewWatermarkedReadSeeker(f, trailer)
	if err != nil {
		t.Fatalf("NewWatermarkedReadSeeker failed: %v", err)
	}

	expectedTotal := int64(len(originalContent) + len(trailer))
	if seeker.TotalSize() != expectedTotal {
		t.Fatalf("expected total size %d, got %d", expectedTotal, seeker.TotalSize())
	}

	// 1. Read all content
	buf := make([]byte, expectedTotal)
	n, err := seeker.Read(buf)
	if err != nil && err != io.EOF {
		t.Fatalf("failed to read: %v", err)
	}
	if int64(n) != expectedTotal {
		t.Fatalf("expected %d bytes read, got %d", expectedTotal, n)
	}
	expectedCombined := append(append([]byte{}, originalContent...), trailer...)
	if !bytes.Equal(buf, expectedCombined) {
		t.Fatalf("read content mismatch")
	}

	// 2. Next read should return EOF
	var extra [10]byte
	nExtra, errExtra := seeker.Read(extra[:])
	if nExtra != 0 || errExtra != io.EOF {
		t.Fatalf("expected 0, EOF at end, got %d, %v", nExtra, errExtra)
	}

	// 3. Seek back to start and read
	pos, err := seeker.Seek(0, io.SeekStart)
	if err != nil || pos != 0 {
		t.Fatalf("failed seek to start: %v", err)
	}
	n2, err2 := seeker.Read(buf)
	if (err2 != nil && err2 != io.EOF) || int64(n2) != expectedTotal {
		t.Fatalf("failed to re-read from start")
	}

	// 4. Seek to trailer portion (simulating range request)
	trailerStart := int64(len(originalContent))
	posTrailer, err := seeker.Seek(trailerStart, io.SeekStart)
	if err != nil || posTrailer != trailerStart {
		t.Fatalf("failed seek to trailer: %v", err)
	}
	trailerBuf := make([]byte, len(trailer))
	nTrailer, err := seeker.Read(trailerBuf)
	if (err != nil && err != io.EOF) || nTrailer != len(trailer) {
		t.Fatalf("failed reading trailer range")
	}
	if !bytes.Equal(trailerBuf, trailer) {
		t.Fatalf("trailer content mismatch")
	}
}

func TestDynamicBrowserViewWatermark(t *testing.T) {
	secretKey := "test-secret-key-32-chars-long!!"
	secretUUID := GenerateSecretUUID()
	uploaderID := "uploader-user-1"
	uploaderName := "Alice Uploader"
	uploaderEmail := "alice@eledrive.local"
	uploaderUsername := "alice"

	viewerID := "viewer-user-2"
	viewerName := "Bob Leaker"
	viewerEmail := "bob@eledrive.local"
	viewerUsername := "bob"

	clientIP := "203.0.113.42"
	userAgent := "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0"

	// Mock file data
	fileBytes := []byte("HIGHLY_CONFIDENTIAL_IMAGE_PNG_DATA")

	// Simulate user loading/previewing file in browser (e.g. inline=1 or /preview)
	_, trailerBytes := BuildAccessForensicTrailer(
		secretUUID,
		uploaderID,
		uploaderName,
		uploaderEmail,
		uploaderUsername,
		viewerID,
		viewerName,
		viewerEmail,
		viewerUsername,
		"BROWSER_VIEW",
		clientIP,
		userAgent,
		"design_mockup.png",
		secretKey,
	)

	// User used right-click -> "Save image as..." or a browser extension to capture the loaded asset
	exfiltratedBytes := append(append([]byte{}, fileBytes...), trailerBytes...)

	// Admin runs forensic inspection on this exfiltrated asset
	result, err := ExtractForensicWatermark(exfiltratedBytes, secretKey)
	if err != nil {
		t.Fatalf("ExtractForensicWatermark failed: %v", err)
	}

	if !result.Matched {
		t.Fatalf("expected forensic match")
	}
	if !result.SignatureValid {
		t.Fatalf("expected valid signature")
	}
	if !result.LeakerIdentified {
		t.Fatalf("expected leaker to be pinpointed")
	}
	if result.LeakerID != viewerID {
		t.Fatalf("expected leaker ID %s, got %s", viewerID, result.LeakerID)
	}
	if result.LeakerName != viewerName {
		t.Fatalf("expected leaker name %s, got %s", viewerName, result.LeakerName)
	}
	if result.LeakerUsername != viewerUsername {
		t.Fatalf("expected leaker username %s, got %s", viewerUsername, result.LeakerUsername)
	}
	if result.AccessType != "BROWSER_VIEW" {
		t.Fatalf("expected access type BROWSER_VIEW, got %s", result.AccessType)
	}
	if result.ClientIP != clientIP {
		t.Fatalf("expected client IP %s, got %s", clientIP, result.ClientIP)
	}
	if result.ExfiltrationMethod != "Browser Load / Right-Click / DevTools Exfiltration" {
		t.Fatalf("expected browser exfiltration method, got %s", result.ExfiltrationMethod)
	}
	if !strings.Contains(result.ExfiltrationVerdict, "loaded in browser preview") {
		t.Fatalf("expected verdict to mention browser preview, got %s", result.ExfiltrationVerdict)
	}
}

func TestDynamicDirectDownloadWatermark(t *testing.T) {
	secretKey := "test-secret-key-32-chars-long!!"
	secretUUID := GenerateSecretUUID()
	uploaderID := "uploader-user-1"
	uploaderName := "Alice Uploader"
	uploaderEmail := "alice@eledrive.local"
	uploaderUsername := "alice"

	downloaderID := "downloader-user-3"
	downloaderName := "Charlie Downloader"
	downloaderEmail := "charlie@eledrive.local"
	downloaderUsername := "charlie"

	clientIP := "198.51.100.25"
	userAgent := "EleDrive-Client/2.0"

	fileBytes := []byte("FINANCIAL_SPREADSHEET_XLSX_DATA")

	// Simulate user clicking direct download button
	_, trailerBytes := BuildAccessForensicTrailer(
		secretUUID,
		uploaderID,
		uploaderName,
		uploaderEmail,
		uploaderUsername,
		downloaderID,
		downloaderName,
		downloaderEmail,
		downloaderUsername,
		"DIRECT_DOWNLOAD",
		clientIP,
		userAgent,
		"q4_financials.xlsx",
		secretKey,
	)

	downloadedBytes := append(append([]byte{}, fileBytes...), trailerBytes...)

	// Admin runs forensic inspection
	result, err := ExtractForensicWatermark(downloadedBytes, secretKey)
	if err != nil {
		t.Fatalf("ExtractForensicWatermark failed: %v", err)
	}

	if !result.Matched {
		t.Fatalf("expected forensic match")
	}
	if !result.SignatureValid {
		t.Fatalf("expected valid signature")
	}
	if !result.LeakerIdentified {
		t.Fatalf("expected leaker identified")
	}
	if result.LeakerID != downloaderID {
		t.Fatalf("expected leaker ID %s, got %s", downloaderID, result.LeakerID)
	}
	if result.AccessType != "DIRECT_DOWNLOAD" {
		t.Fatalf("expected access type DIRECT_DOWNLOAD, got %s", result.AccessType)
	}
	if result.ExfiltrationMethod != "Direct File Download" {
		t.Fatalf("expected direct download method, got %s", result.ExfiltrationMethod)
	}
	if !strings.Contains(result.ExfiltrationVerdict, "directly downloaded") {
		t.Fatalf("expected verdict to mention directly downloaded, got %s", result.ExfiltrationVerdict)
	}
}
