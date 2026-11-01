package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/google/uuid"
	"paper-platform/internal/domain"
	"paper-platform/pkg/pdf"
	"paper-platform/pkg/storage"
)

type PaperService struct {
	paperRepo domain.PaperRepository
	tagRepo   domain.TagRepository
	storage   storage.Storage
}

func NewPaperService(paperRepo domain.PaperRepository, tagRepo domain.TagRepository, storage storage.Storage) *PaperService {
	return &PaperService{
		paperRepo: paperRepo,
		tagRepo:   tagRepo,
		storage:   storage,
	}
}

type UploadPaperInput struct {
	UserID          uuid.UUID
	CollectionID    *uuid.UUID
	Title           string
	Authors         string
	Abstract        string
	PublicationDate string
	DOI             string
	Tags            []string
	FileName        string
	FileReader      io.Reader
}

func (s *PaperService) UploadPaper(ctx context.Context, input UploadPaperInput) (*domain.Paper, error) {
	if input.FileReader == nil {
		return nil, errors.New("file reader is required")
	}

	// 1. Save file to storage & compute SHA-256
	filePath, fileHash, fileSize, err := s.storage.Save(ctx, input.FileName, input.FileReader)
	if err != nil {
		return nil, fmt.Errorf("storage save failed: %w", err)
	}

	// 2. Estimate page count and clean title
	fullLocalPath := ""
	if ls, ok := s.storage.(*storage.LocalStorage); ok {
		fullLocalPath = ls.GetFullPath(filePath)
	}

	pageCount := 1
	if fullLocalPath != "" {
		if count, err := pdf.EstimatePageCount(fullLocalPath); err == nil && count > 0 {
			pageCount = count
		}
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = pdf.CleanTitle(input.FileName)
	}

	paper := &domain.Paper{
		ID:              uuid.New(),
		UserID:          input.UserID,
		CollectionID:    input.CollectionID,
		Title:           title,
		Authors:         strings.TrimSpace(input.Authors),
		Abstract:        strings.TrimSpace(input.Abstract),
		PublicationDate: strings.TrimSpace(input.PublicationDate),
		DOI:             strings.TrimSpace(input.DOI),
		FileHash:        fileHash,
		FilePath:        filePath,
		FileSize:        fileSize,
		PageCount:       pageCount,
		ReadingStatus:   domain.StatusToRead,
	}

	// 3. Create record in database
	if err := s.paperRepo.Create(ctx, paper); err != nil {
		return nil, fmt.Errorf("failed to save paper metadata: %w", err)
	}

	// 4. Sync tags if provided
	if len(input.Tags) > 0 {
		_ = s.paperRepo.SyncTags(ctx, paper.ID, input.Tags, input.UserID)
	}

	return s.paperRepo.GetByID(ctx, paper.ID, input.UserID)
}

func (s *PaperService) GetByID(ctx context.Context, id, userID uuid.UUID) (*domain.Paper, error) {
	return s.paperRepo.GetByID(ctx, id, userID)
}

func (s *PaperService) GetByIDPublic(ctx context.Context, id uuid.UUID) (*domain.Paper, error) {
	return s.paperRepo.GetByIDPublic(ctx, id)
}

func (s *PaperService) List(ctx context.Context, filter domain.PaperFilter) ([]*domain.Paper, int, error) {
	return s.paperRepo.List(ctx, filter)
}

type UpdatePaperInput struct {
	ID              uuid.UUID
	UserID          uuid.UUID
	CollectionID    *uuid.UUID
	Title           string
	Authors         string
	Abstract        string
	PublicationDate string
	DOI             string
	ReadingStatus   domain.ReadingStatus
	Tags            []string
}

func (s *PaperService) Update(ctx context.Context, input UpdatePaperInput) (*domain.Paper, error) {
	paper, err := s.paperRepo.GetByID(ctx, input.ID, input.UserID)
	if err != nil {
		return nil, err
	}
	if paper == nil {
		return nil, errors.New("paper not found")
	}

	if strings.TrimSpace(input.Title) != "" {
		paper.Title = strings.TrimSpace(input.Title)
	}
	paper.Authors = strings.TrimSpace(input.Authors)
	paper.Abstract = strings.TrimSpace(input.Abstract)
	paper.PublicationDate = strings.TrimSpace(input.PublicationDate)
	paper.DOI = strings.TrimSpace(input.DOI)
	paper.CollectionID = input.CollectionID
	if input.ReadingStatus != "" {
		paper.ReadingStatus = input.ReadingStatus
	}

	if err := s.paperRepo.Update(ctx, paper); err != nil {
		return nil, err
	}

	if input.Tags != nil {
		_ = s.paperRepo.SyncTags(ctx, paper.ID, input.Tags, input.UserID)
	}

	return s.paperRepo.GetByID(ctx, paper.ID, input.UserID)
}

func (s *PaperService) Delete(ctx context.Context, id, userID uuid.UUID) error {
	paper, err := s.paperRepo.GetByID(ctx, id, userID)
	if err != nil {
		return err
	}
	if paper == nil {
		return errors.New("paper not found")
	}

	return s.paperRepo.Delete(ctx, id, userID)
}

func (s *PaperService) GetPDFStream(ctx context.Context, filePath string) (io.ReadCloser, error) {
	return s.storage.Get(ctx, filePath)
}
