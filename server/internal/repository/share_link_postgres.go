package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"paper-platform/internal/domain"
)

type shareLinkRepo struct {
	db *sql.DB
}

func NewShareLinkRepository(db *sql.DB) domain.ShareLinkRepository {
	return &shareLinkRepo{db: db}
}

func (r *shareLinkRepo) Create(ctx context.Context, sl *domain.ShareLink) error {
	query := `
		INSERT INTO share_links (id, paper_id, user_id, token, include_notes, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	if sl.ID == uuid.Nil {
		sl.ID = uuid.New()
	}
	sl.CreatedAt = time.Now().UTC()

	_, err := r.db.ExecContext(ctx, query,
		sl.ID, sl.PaperID, sl.UserID, sl.Token, sl.IncludeNotes, sl.ExpiresAt, sl.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("shareLinkRepo.Create: %w", err)
	}
	return nil
}

func (r *shareLinkRepo) GetByToken(ctx context.Context, token string) (*domain.ShareLink, error) {
	query := `
		SELECT id, paper_id, user_id, token, include_notes, expires_at, created_at
		FROM share_links
		WHERE token = $1 AND (expires_at IS NULL OR expires_at > NOW())
	`
	var sl domain.ShareLink
	err := r.db.QueryRowContext(ctx, query, token).Scan(
		&sl.ID, &sl.PaperID, &sl.UserID, &sl.Token, &sl.IncludeNotes, &sl.ExpiresAt, &sl.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("shareLinkRepo.GetByToken: %w", err)
	}
	return &sl, nil
}

func (r *shareLinkRepo) GetByPaperID(ctx context.Context, paperID uuid.UUID, userID uuid.UUID) (*domain.ShareLink, error) {
	query := `
		SELECT id, paper_id, user_id, token, include_notes, expires_at, created_at
		FROM share_links
		WHERE paper_id = $1 AND user_id = $2
		ORDER BY created_at DESC
		LIMIT 1
	`
	var sl domain.ShareLink
	err := r.db.QueryRowContext(ctx, query, paperID, userID).Scan(
		&sl.ID, &sl.PaperID, &sl.UserID, &sl.Token, &sl.IncludeNotes, &sl.ExpiresAt, &sl.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("shareLinkRepo.GetByPaperID: %w", err)
	}
	return &sl, nil
}

func (r *shareLinkRepo) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM share_links WHERE id = $1 AND user_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("shareLinkRepo.Delete: %w", err)
	}
	return nil
}
