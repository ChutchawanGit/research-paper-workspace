package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"paper-platform/internal/domain"
)

type HighlightService struct {
	hlRepo    domain.HighlightRepository
	paperRepo domain.PaperRepository
}

func NewHighlightService(hlRepo domain.HighlightRepository, paperRepo domain.PaperRepository) *HighlightService {
	return &HighlightService{
		hlRepo:    hlRepo,
		paperRepo: paperRepo,
	}
}

type CreateHighlightInput struct {
	PaperID      uuid.UUID              `json:"paper_id"`
	UserID       uuid.UUID              `json:"user_id"`
	PageIndex    int                    `json:"page_index"`
	Rects        []domain.HighlightRect `json:"rects"`
	SelectedText string                 `json:"selected_text"`
	Color        string                 `json:"color"`
}

func (s *HighlightService) Create(ctx context.Context, input CreateHighlightInput) (*domain.Highlight, error) {
	if len(input.Rects) == 0 {
		return nil, errors.New("at least one rect is required")
	}
	if input.PageIndex < 1 {
		input.PageIndex = 1
	}
	if input.Color == "" {
		input.Color = "#FBBF24"
	}

	hl := &domain.Highlight{
		ID:           uuid.New(),
		PaperID:      input.PaperID,
		UserID:       input.UserID,
		PageIndex:    input.PageIndex,
		Rects:        input.Rects,
		SelectedText: input.SelectedText,
		Color:        input.Color,
	}

	if err := s.hlRepo.Create(ctx, hl); err != nil {
		return nil, err
	}
	return hl, nil
}

func (s *HighlightService) ListByPaper(ctx context.Context, paperID, userID uuid.UUID) ([]*domain.Highlight, error) {
	return s.hlRepo.ListByPaper(ctx, paperID, userID)
}

func (s *HighlightService) ListByPaperPublic(ctx context.Context, paperID uuid.UUID) ([]*domain.Highlight, error) {
	return s.hlRepo.ListByPaperPublic(ctx, paperID)
}

func (s *HighlightService) UpdateColor(ctx context.Context, id, userID uuid.UUID, color string) error {
	return s.hlRepo.UpdateColor(ctx, id, userID, color)
}

func (s *HighlightService) Delete(ctx context.Context, id, userID uuid.UUID) error {
	return s.hlRepo.Delete(ctx, id, userID)
}
