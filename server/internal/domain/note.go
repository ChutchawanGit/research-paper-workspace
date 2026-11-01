package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Note struct {
	ID          uuid.UUID  `json:"id"`
	PaperID     uuid.UUID  `json:"paper_id"`
	UserID      uuid.UUID  `json:"user_id"`
	HighlightID *uuid.UUID `json:"highlight_id,omitempty"`
	Title       string     `json:"title"`
	Content     string     `json:"content"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type NoteRepository interface {
	Create(ctx context.Context, note *Note) error
	GetByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*Note, error)
	ListByPaper(ctx context.Context, paperID uuid.UUID, userID uuid.UUID) ([]*Note, error)
	ListByPaperPublic(ctx context.Context, paperID uuid.UUID) ([]*Note, error)
	Update(ctx context.Context, note *Note) error
	Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}
