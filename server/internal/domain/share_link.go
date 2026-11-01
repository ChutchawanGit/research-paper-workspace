package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type ShareLink struct {
	ID           uuid.UUID  `json:"id"`
	PaperID      uuid.UUID  `json:"paper_id"`
	UserID       uuid.UUID  `json:"user_id"`
	Token        string     `json:"token"`
	IncludeNotes bool       `json:"include_notes"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

type ShareLinkRepository interface {
	Create(ctx context.Context, sl *ShareLink) error
	GetByToken(ctx context.Context, token string) (*ShareLink, error)
	GetByPaperID(ctx context.Context, paperID uuid.UUID, userID uuid.UUID) (*ShareLink, error)
	Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}
