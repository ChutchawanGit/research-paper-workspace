package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type Storage interface {
	Save(ctx context.Context, fileName string, src io.Reader) (filePath string, fileHash string, fileSize int64, err error)
	Get(ctx context.Context, filePath string) (io.ReadCloser, error)
	Delete(ctx context.Context, filePath string) error
}

type LocalStorage struct {
	baseDir string
}

func NewLocalStorage(baseDir string) (*LocalStorage, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create storage directory %s: %w", baseDir, err)
	}
	return &LocalStorage{baseDir: baseDir}, nil
}

func (s *LocalStorage) Save(ctx context.Context, fileName string, src io.Reader) (string, string, int64, error) {
	tempFile, err := os.CreateTemp(s.baseDir, "upload-*")
	if err != nil {
		return "", "", 0, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tempFile.Name()) // Clean up if rename fails

	hasher := sha256.New()
	writer := io.MultiWriter(tempFile, hasher)

	written, err := io.Copy(writer, src)
	if err != nil {
		tempFile.Close()
		return "", "", 0, fmt.Errorf("failed to stream upload to disk: %w", err)
	}
	tempFile.Close()

	hashStr := hex.EncodeToString(hasher.Sum(nil))
	ext := filepath.Ext(fileName)
	if ext == "" {
		ext = ".pdf"
	}
	finalFileName := fmt.Sprintf("%s%s", hashStr, ext)
	finalPath := filepath.Join(s.baseDir, finalFileName)

	// If file with same hash already exists, we reuse it (deduplication)
	if _, err := os.Stat(finalPath); os.IsNotExist(err) {
		if err := os.Rename(tempFile.Name(), finalPath); err != nil {
			return "", "", 0, fmt.Errorf("failed to save final file: %w", err)
		}
	}

	return finalFileName, hashStr, written, nil
}

func (s *LocalStorage) Get(ctx context.Context, filePath string) (io.ReadCloser, error) {
	fullPath := filepath.Join(s.baseDir, filePath)
	file, err := os.Open(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file %s: %w", fullPath, err)
	}
	return file, nil
}

func (s *LocalStorage) Delete(ctx context.Context, filePath string) error {
	fullPath := filepath.Join(s.baseDir, filePath)
	return os.Remove(fullPath)
}

func (s *LocalStorage) GetFullPath(filePath string) string {
	return filepath.Join(s.baseDir, filePath)
}
