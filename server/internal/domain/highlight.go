package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type HighlightRect struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type Highlight struct {
	ID           uuid.UUID       `json:"id"`
	PaperID      uuid.UUID       `json:"paper_id"`
	UserID       uuid.UUID       `json:"user_id"`
	PageIndex    int             `json:"page_index"`
	Rects        []HighlightRect `json:"rects"`
	SelectedText string          `json:"selected_text"`
	Color        string          `json:"color"`
	CreatedAt    time.Time       `json:"created_at"`
}

type HighlightRepository interface {
	Create(ctx context.Context, hl *Highlight) error
	GetByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*Highlight, error)
	ListByPaper(ctx context.Context, paperID uuid.UUID, userID uuid.UUID) ([]*Highlight, error)
	ListByPaperPublic(ctx context.Context, paperID uuid.UUID) ([]*Highlight, error)
	UpdateColor(ctx context.Context, id uuid.UUID, userID uuid.UUID, color string) error
	Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}
