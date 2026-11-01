package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"paper-platform/internal/domain"
)

type tagRepo struct {
	db *sql.DB
}

func NewTagRepository(db *sql.DB) domain.TagRepository {
	return &tagRepo{db: db}
}

func (r *tagRepo) GetOrCreate(ctx context.Context, userID uuid.UUID, name string) (*domain.Tag, error) {
	query := `
		INSERT INTO tags (id, user_id, name, created_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
		RETURNING id, user_id, name, created_at
	`
	var t domain.Tag
	err := r.db.QueryRowContext(ctx, query, uuid.New(), userID, name, time.Now().UTC()).
		Scan(&t.ID, &t.UserID, &t.Name, &t.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("tagRepo.GetOrCreate: %w", err)
	}
	return &t, nil
}

func (r *tagRepo) ListByUser(ctx context.Context, userID uuid.UUID) ([]*domain.Tag, error) {
	query := `SELECT id, user_id, name, created_at FROM tags WHERE user_id = $1 ORDER BY name ASC`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("tagRepo.ListByUser: %w", err)
	}
	defer rows.Close()

	var tags []*domain.Tag
	for rows.Next() {
		var t domain.Tag
		if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &t.CreatedAt); err != nil {
			return nil, err
		}
		tags = append(tags, &t)
	}
	return tags, rows.Err()
}

func (r *tagRepo) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM tags WHERE id = $1 AND user_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("tagRepo.Delete: %w", err)
	}
	return nil
}
