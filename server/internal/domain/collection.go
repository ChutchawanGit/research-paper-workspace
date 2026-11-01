package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Collection struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Color       string    `json:"color"`
	PaperCount  int       `json:"paper_count,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CollectionRepository interface {
	Create(ctx context.Context, col *Collection) error
	GetByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*Collection, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]*Collection, error)
	Update(ctx context.Context, col *Collection) error
	Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}
