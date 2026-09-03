package utils

import (
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
