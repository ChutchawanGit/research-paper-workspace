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

type noteRepo struct {
	db *sql.DB
}

func NewNoteRepository(db *sql.DB) domain.NoteRepository {
	return &noteRepo{db: db}
}

func (r *noteRepo) Create(ctx context.Context, note *domain.Note) error {
	query := `
		INSERT INTO notes (id, paper_id, user_id, highlight_id, title, content, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	if note.ID == uuid.Nil {
		note.ID = uuid.New()
	}
	now := time.Now().UTC()
	note.CreatedAt = now
	note.UpdatedAt = now

	_, err := r.db.ExecContext(ctx, query,
		note.ID, note.PaperID, note.UserID, note.HighlightID, note.Title, note.Content, note.CreatedAt, note.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("noteRepo.Create: %w", err)
	}
	return nil
}

func (r *noteRepo) GetByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*domain.Note, error) {
	query := `
		SELECT id, paper_id, user_id, highlight_id, title, content, created_at, updated_at
		FROM notes
		WHERE id = $1 AND user_id = $2
	`
	var n domain.Note
	var hlID *uuid.UUID
	err := r.db.QueryRowContext(ctx, query, id, userID).Scan(
		&n.ID, &n.PaperID, &n.UserID, &hlID, &n.Title, &n.Content, &n.CreatedAt, &n.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("noteRepo.GetByID: %w", err)
	}
	n.HighlightID = hlID
	return &n, nil
}

func (r *noteRepo) ListByPaper(ctx context.Context, paperID uuid.UUID, userID uuid.UUID) ([]*domain.Note, error) {
	query := `
		SELECT id, paper_id, user_id, highlight_id, title, content, created_at, updated_at
		FROM notes
		WHERE paper_id = $1 AND user_id = $2
		ORDER BY created_at ASC
	`
	return r.scanNotes(ctx, query, paperID, userID)
}

func (r *noteRepo) ListByPaperPublic(ctx context.Context, paperID uuid.UUID) ([]*domain.Note, error) {
	query := `
		SELECT id, paper_id, user_id, highlight_id, title, content, created_at, updated_at
		FROM notes
		WHERE paper_id = $1
		ORDER BY created_at ASC
	`
	return r.scanNotes(ctx, query, paperID)
}

func (r *noteRepo) scanNotes(ctx context.Context, query string, args ...interface{}) ([]*domain.Note, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("noteRepo.scanNotes: %w", err)
	}
	defer rows.Close()

	var list []*domain.Note
	for rows.Next() {
		var n domain.Note
		var hlID *uuid.UUID
		if err := rows.Scan(
			&n.ID, &n.PaperID, &n.UserID, &hlID, &n.Title, &n.Content, &n.CreatedAt, &n.UpdatedAt,
		); err != nil {
			return nil, err
		}
		n.HighlightID = hlID
		list = append(list, &n)
	}
	return list, rows.Err()
}

func (r *noteRepo) Update(ctx context.Context, note *domain.Note) error {
	query := `
		UPDATE notes
		SET title = $1, content = $2, highlight_id = $3, updated_at = $4
		WHERE id = $5 AND user_id = $6
	`
	note.UpdatedAt = time.Now().UTC()
	res, err := r.db.ExecContext(ctx, query, note.Title, note.Content, note.HighlightID, note.UpdatedAt, note.ID, note.UserID)
	if err != nil {
		return fmt.Errorf("noteRepo.Update: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("note not found or permission denied")
	}
	return nil
}

func (r *noteRepo) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM notes WHERE id = $1 AND user_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("noteRepo.Delete: %w", err)
	}
	return nil
}
