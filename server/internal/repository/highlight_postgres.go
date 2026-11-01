package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"paper-platform/internal/domain"
)

type highlightRepo struct {
	db *sql.DB
}

func NewHighlightRepository(db *sql.DB) domain.HighlightRepository {
	return &highlightRepo{db: db}
}

func (r *highlightRepo) Create(ctx context.Context, hl *domain.Highlight) error {
	query := `
		INSERT INTO highlights (id, paper_id, user_id, page_index, rects, selected_text, color, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	if hl.ID == uuid.Nil {
		hl.ID = uuid.New()
	}
	hl.CreatedAt = time.Now().UTC()
	if hl.Color == "" {
		hl.Color = "#FBBF24"
	}

	rectsJSON, err := json.Marshal(hl.Rects)
	if err != nil {
		return fmt.Errorf("failed to marshal highlight rects: %w", err)
	}

	_, err = r.db.ExecContext(ctx, query,
		hl.ID, hl.PaperID, hl.UserID, hl.PageIndex, rectsJSON, hl.SelectedText, hl.Color, hl.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("highlightRepo.Create: %w", err)
	}
	return nil
}

func (r *highlightRepo) GetByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*domain.Highlight, error) {
	query := `
		SELECT id, paper_id, user_id, page_index, rects, selected_text, color, created_at
		FROM highlights
		WHERE id = $1 AND user_id = $2
	`
	var hl domain.Highlight
	var rectsRaw []byte
	err := r.db.QueryRowContext(ctx, query, id, userID).Scan(
		&hl.ID, &hl.PaperID, &hl.UserID, &hl.PageIndex, &rectsRaw, &hl.SelectedText, &hl.Color, &hl.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("highlightRepo.GetByID: %w", err)
	}
	if err := json.Unmarshal(rectsRaw, &hl.Rects); err != nil {
		return nil, fmt.Errorf("failed to unmarshal rects: %w", err)
	}
	return &hl, nil
}

func (r *highlightRepo) ListByPaper(ctx context.Context, paperID uuid.UUID, userID uuid.UUID) ([]*domain.Highlight, error) {
	query := `
		SELECT id, paper_id, user_id, page_index, rects, selected_text, color, created_at
		FROM highlights
		WHERE paper_id = $1 AND user_id = $2
		ORDER BY page_index ASC, created_at ASC
	`
	return r.scanHighlights(ctx, query, paperID, userID)
}

func (r *highlightRepo) ListByPaperPublic(ctx context.Context, paperID uuid.UUID) ([]*domain.Highlight, error) {
	query := `
		SELECT id, paper_id, user_id, page_index, rects, selected_text, color, created_at
		FROM highlights
		WHERE paper_id = $1
		ORDER BY page_index ASC, created_at ASC
	`
	return r.scanHighlights(ctx, query, paperID)
}

func (r *highlightRepo) scanHighlights(ctx context.Context, query string, args ...interface{}) ([]*domain.Highlight, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("highlightRepo scan: %w", err)
	}
	defer rows.Close()

	var list []*domain.Highlight
	for rows.Next() {
		var hl domain.Highlight
		var rectsRaw []byte
		if err := rows.Scan(
			&hl.ID, &hl.PaperID, &hl.UserID, &hl.PageIndex, &rectsRaw, &hl.SelectedText, &hl.Color, &hl.CreatedAt,
		); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(rectsRaw, &hl.Rects); err != nil {
			return nil, err
		}
		list = append(list, &hl)
	}
	return list, rows.Err()
}

func (r *highlightRepo) UpdateColor(ctx context.Context, id uuid.UUID, userID uuid.UUID, color string) error {
	query := `UPDATE highlights SET color = $1 WHERE id = $2 AND user_id = $3`
	_, err := r.db.ExecContext(ctx, query, color, id, userID)
	if err != nil {
		return fmt.Errorf("highlightRepo.UpdateColor: %w", err)
	}
	return nil
}

func (r *highlightRepo) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM highlights WHERE id = $1 AND user_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("highlightRepo.Delete: %w", err)
	}
	return nil
}
