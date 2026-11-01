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

type collectionRepo struct {
	db *sql.DB
}

func NewCollectionRepository(db *sql.DB) domain.CollectionRepository {
	return &collectionRepo{db: db}
}

func (r *collectionRepo) Create(ctx context.Context, col *domain.Collection) error {
	query := `
		INSERT INTO collections (id, user_id, name, description, color, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	if col.ID == uuid.Nil {
		col.ID = uuid.New()
	}
	now := time.Now().UTC()
	col.CreatedAt = now
	col.UpdatedAt = now

	_, err := r.db.ExecContext(ctx, query, col.ID, col.UserID, col.Name, col.Description, col.Color, col.CreatedAt, col.UpdatedAt)
	if err != nil {
		return fmt.Errorf("collectionRepo.Create: %w", err)
	}
	return nil
}

func (r *collectionRepo) GetByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*domain.Collection, error) {
	query := `
		SELECT c.id, c.user_id, c.name, c.description, c.color, c.created_at, c.updated_at,
		       COUNT(p.id) as paper_count
		FROM collections c
		LEFT JOIN papers p ON p.collection_id = c.id
		WHERE c.id = $1 AND c.user_id = $2
		GROUP BY c.id
	`
	var col domain.Collection
	err := r.db.QueryRowContext(ctx, query, id, userID).Scan(
		&col.ID, &col.UserID, &col.Name, &col.Description, &col.Color, &col.CreatedAt, &col.UpdatedAt, &col.PaperCount,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("collectionRepo.GetByID: %w", err)
	}
	return &col, nil
}

func (r *collectionRepo) ListByUser(ctx context.Context, userID uuid.UUID) ([]*domain.Collection, error) {
	query := `
		SELECT c.id, c.user_id, c.name, c.description, c.color, c.created_at, c.updated_at,
		       COUNT(p.id) as paper_count
		FROM collections c
		LEFT JOIN papers p ON p.collection_id = c.id
		WHERE c.user_id = $1
		GROUP BY c.id
		ORDER BY c.name ASC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("collectionRepo.ListByUser: %w", err)
	}
	defer rows.Close()

	var cols []*domain.Collection
	for rows.Next() {
		var col domain.Collection
		if err := rows.Scan(
			&col.ID, &col.UserID, &col.Name, &col.Description, &col.Color, &col.CreatedAt, &col.UpdatedAt, &col.PaperCount,
		); err != nil {
			return nil, err
		}
		cols = append(cols, &col)
	}
	return cols, rows.Err()
}

func (r *collectionRepo) Update(ctx context.Context, col *domain.Collection) error {
	query := `
		UPDATE collections
		SET name = $1, description = $2, color = $3, updated_at = $4
		WHERE id = $5 AND user_id = $6
	`
	col.UpdatedAt = time.Now().UTC()
	res, err := r.db.ExecContext(ctx, query, col.Name, col.Description, col.Color, col.UpdatedAt, col.ID, col.UserID)
	if err != nil {
		return fmt.Errorf("collectionRepo.Update: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("collection not found or permission denied")
	}
	return nil
}

func (r *collectionRepo) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM collections WHERE id = $1 AND user_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("collectionRepo.Delete: %w", err)
	}
	return nil
}
