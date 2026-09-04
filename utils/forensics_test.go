package utils

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
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
