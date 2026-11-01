package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"paper-platform/internal/domain"
)

type ShareService struct {
	shareRepo domain.ShareLinkRepository
	paperRepo domain.PaperRepository
	hlRepo    domain.HighlightRepository
	noteRepo  domain.NoteRepository
}

func NewShareService(
	shareRepo domain.ShareLinkRepository,
	paperRepo domain.PaperRepository,
	hlRepo domain.HighlightRepository,
	noteRepo domain.NoteRepository,
) *ShareService {
	return &ShareService{
		shareRepo: shareRepo,
		paperRepo: paperRepo,
		hlRepo:    hlRepo,
		noteRepo:  noteRepo,
	}
}

type PublicSharedPaperData struct {
	Paper      *domain.Paper       `json:"paper"`
	Highlights []*domain.Highlight `json:"highlights"`
	Notes      []*domain.Note      `json:"notes,omitempty"`
}

func (s *ShareService) CreateShareLink(ctx context.Context, paperID, userID uuid.UUID, includeNotes bool, expiresInDays int) (*domain.ShareLink, error) {
	// Verify user owns the paper
	paper, err := s.paperRepo.GetByID(ctx, paperID, userID)
	if err != nil {
		return nil, err
	}
	if paper == nil {
		return nil, errors.New("paper not found")
	}

	// Check if active share link already exists
	existing, err := s.shareRepo.GetByPaperID(ctx, paperID, userID)
	if err == nil && existing != nil {
		return existing, nil
	}

	// Generate secure token
	tokenBytes := make([]byte, 24)
	if _, err := rand.Read(tokenBytes); err != nil {
		return nil, err
	}
	token := hex.EncodeToString(tokenBytes)

	var expiresAt *time.Time
	if expiresInDays > 0 {
		exp := time.Now().UTC().AddDate(0, 0, expiresInDays)
		expiresAt = &exp
	}

	sl := &domain.ShareLink{
		ID:           uuid.New(),
		PaperID:      paperID,
		UserID:       userID,
		Token:        token,
		IncludeNotes: includeNotes,
		ExpiresAt:    expiresAt,
	}

	if err := s.shareRepo.Create(ctx, sl); err != nil {
		return nil, err
	}
	return sl, nil
}

func (s *ShareService) GetPublicSharedPaper(ctx context.Context, token string) (*PublicSharedPaperData, error) {
	sl, err := s.shareRepo.GetByToken(ctx, token)
	if err != nil {
		return nil, err
	}
	if sl == nil {
		return nil, errors.New("share link is invalid or expired")
	}

	paper, err := s.paperRepo.GetByIDPublic(ctx, sl.PaperID)
	if err != nil {
		return nil, err
	}
	if paper == nil {
		return nil, errors.New("shared paper not found")
	}

	highlights, err := s.hlRepo.ListByPaperPublic(ctx, sl.PaperID)
	if err != nil {
		highlights = []*domain.Highlight{}
	}

	var notes []*domain.Note
	if sl.IncludeNotes {
		notes, _ = s.noteRepo.ListByPaperPublic(ctx, sl.PaperID)
	}

	return &PublicSharedPaperData{
		Paper:      paper,
		Highlights: highlights,
		Notes:      notes,
	}, nil
}

func (s *ShareService) Revoke(ctx context.Context, id, userID uuid.UUID) error {
	return s.shareRepo.Delete(ctx, id, userID)
}

func (s *ShareService) GetByPaperID(ctx context.Context, paperID, userID uuid.UUID) (*domain.ShareLink, error) {
	return s.shareRepo.GetByPaperID(ctx, paperID, userID)
}
