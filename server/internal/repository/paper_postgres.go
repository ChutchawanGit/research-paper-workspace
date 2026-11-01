package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"paper-platform/internal/domain"
)

type paperRepo struct {
	db *sql.DB
}

func NewPaperRepository(db *sql.DB) domain.PaperRepository {
	return &paperRepo{db: db}
}

func (r *paperRepo) Create(ctx context.Context, p *domain.Paper) error {
	query := `
		INSERT INTO papers (
			id, user_id, collection_id, title, authors, abstract, publication_date,
			doi, file_hash, file_path, file_size, page_count, reading_status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	now := time.Now().UTC()
	p.CreatedAt = now
	p.UpdatedAt = now
	if p.ReadingStatus == "" {
		p.ReadingStatus = domain.StatusToRead
	}

	_, err := r.db.ExecContext(ctx, query,
		p.ID, p.UserID, p.CollectionID, p.Title, p.Authors, p.Abstract, p.PublicationDate,
		p.DOI, p.FileHash, p.FilePath, p.FileSize, p.PageCount, p.ReadingStatus, p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("paperRepo.Create: %w", err)
	}
	return nil
}

func (r *paperRepo) GetByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*domain.Paper, error) {
	query := `
		SELECT p.id, p.user_id, p.collection_id, COALESCE(c.name, ''), COALESCE(c.color, ''),
		       p.title, p.authors, p.abstract, p.publication_date, p.doi, p.file_hash,
		       p.file_path, p.file_size, p.page_count, p.reading_status, p.created_at, p.updated_at,
		       (SELECT COUNT(*) FROM highlights h WHERE h.paper_id = p.id) as highlight_count,
		       (SELECT COUNT(*) FROM notes n WHERE n.paper_id = p.id) as note_count
		FROM papers p
		LEFT JOIN collections c ON c.id = p.collection_id
		WHERE p.id = $1 AND p.user_id = $2
	`
	var p domain.Paper
	var colID *uuid.UUID
	err := r.db.QueryRowContext(ctx, query, id, userID).Scan(
		&p.ID, &p.UserID, &colID, &p.CollectionName, &p.CollectionColor,
		&p.Title, &p.Authors, &p.Abstract, &p.PublicationDate, &p.DOI, &p.FileHash,
		&p.FilePath, &p.FileSize, &p.PageCount, &p.ReadingStatus, &p.CreatedAt, &p.UpdatedAt,
		&p.HighlightCount, &p.NoteCount,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("paperRepo.GetByID: %w", err)
	}
	p.CollectionID = colID
	p.Tags, _ = r.getTagsForPaper(ctx, p.ID)
	return &p, nil
}

func (r *paperRepo) GetByIDPublic(ctx context.Context, id uuid.UUID) (*domain.Paper, error) {
	query := `
		SELECT p.id, p.user_id, p.collection_id, COALESCE(c.name, ''), COALESCE(c.color, ''),
		       p.title, p.authors, p.abstract, p.publication_date, p.doi, p.file_hash,
		       p.file_path, p.file_size, p.page_count, p.reading_status, p.created_at, p.updated_at,
		       (SELECT COUNT(*) FROM highlights h WHERE h.paper_id = p.id) as highlight_count,
		       (SELECT COUNT(*) FROM notes n WHERE n.paper_id = p.id) as note_count
		FROM papers p
		LEFT JOIN collections c ON c.id = p.collection_id
		WHERE p.id = $1
	`
	var p domain.Paper
	var colID *uuid.UUID
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&p.ID, &p.UserID, &colID, &p.CollectionName, &p.CollectionColor,
		&p.Title, &p.Authors, &p.Abstract, &p.PublicationDate, &p.DOI, &p.FileHash,
		&p.FilePath, &p.FileSize, &p.PageCount, &p.ReadingStatus, &p.CreatedAt, &p.UpdatedAt,
		&p.HighlightCount, &p.NoteCount,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("paperRepo.GetByIDPublic: %w", err)
	}
	p.CollectionID = colID
	p.Tags, _ = r.getTagsForPaper(ctx, p.ID)
	return &p, nil
}

func (r *paperRepo) List(ctx context.Context, filter domain.PaperFilter) ([]*domain.Paper, int, error) {
	var conditions []string
	var args []interface{}
	idx := 1

	conditions = append(conditions, fmt.Sprintf("p.user_id = $%d", idx))
	args = append(args, filter.UserID)
	idx++

	if filter.CollectionID != nil {
		conditions = append(conditions, fmt.Sprintf("p.collection_id = $%d", idx))
		args = append(args, *filter.CollectionID)
		idx++
	}

	if filter.ReadingStatus != nil && *filter.ReadingStatus != "" {
		conditions = append(conditions, fmt.Sprintf("p.reading_status = $%d", idx))
		args = append(args, *filter.ReadingStatus)
		idx++
	}

	if filter.TagID != nil {
		conditions = append(conditions, fmt.Sprintf("EXISTS (SELECT 1 FROM paper_tags pt WHERE pt.paper_id = p.id AND pt.tag_id = $%d)", idx))
		args = append(args, *filter.TagID)
		idx++
	}

	if filter.SearchQuery != "" {
		search := "%" + strings.ToLower(filter.SearchQuery) + "%"
		conditions = append(conditions, fmt.Sprintf(
			"(LOWER(p.title) LIKE $%d OR LOWER(p.abstract) LIKE $%d OR LOWER(p.authors) LIKE $%d)",
			idx, idx, idx,
		))
		args = append(args, search)
		idx++
	}

	whereClause := strings.Join(conditions, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM papers p WHERE %s", whereClause)
	var totalCount int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&totalCount); err != nil {
		return nil, 0, fmt.Errorf("paperRepo.List count: %w", err)
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT p.id, p.user_id, p.collection_id, COALESCE(c.name, ''), COALESCE(c.color, ''),
		       p.title, p.authors, p.abstract, p.publication_date, p.doi, p.file_hash,
		       p.file_path, p.file_size, p.page_count, p.reading_status, p.created_at, p.updated_at,
		       (SELECT COUNT(*) FROM highlights h WHERE h.paper_id = p.id) as highlight_count,
		       (SELECT COUNT(*) FROM notes n WHERE n.paper_id = p.id) as note_count
		FROM papers p
		LEFT JOIN collections c ON c.id = p.collection_id
		WHERE %s
		ORDER BY p.updated_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, idx, idx+1)

	args = append(args, limit, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("paperRepo.List: %w", err)
	}
	defer rows.Close()

	var papers []*domain.Paper
	for rows.Next() {
		var p domain.Paper
		var colID *uuid.UUID
		if err := rows.Scan(
			&p.ID, &p.UserID, &colID, &p.CollectionName, &p.CollectionColor,
			&p.Title, &p.Authors, &p.Abstract, &p.PublicationDate, &p.DOI, &p.FileHash,
			&p.FilePath, &p.FileSize, &p.PageCount, &p.ReadingStatus, &p.CreatedAt, &p.UpdatedAt,
			&p.HighlightCount, &p.NoteCount,
		); err != nil {
			return nil, 0, err
		}
		p.CollectionID = colID
		p.Tags, _ = r.getTagsForPaper(ctx, p.ID)
		papers = append(papers, &p)
	}

	return papers, totalCount, rows.Err()
}

func (r *paperRepo) Update(ctx context.Context, p *domain.Paper) error {
	query := `
		UPDATE papers
		SET collection_id = $1, title = $2, authors = $3, abstract = $4,
		    publication_date = $5, doi = $6, reading_status = $7, updated_at = $8
		WHERE id = $9 AND user_id = $10
	`
	p.UpdatedAt = time.Now().UTC()
	res, err := r.db.ExecContext(ctx, query,
		p.CollectionID, p.Title, p.Authors, p.Abstract,
		p.PublicationDate, p.DOI, p.ReadingStatus, p.UpdatedAt,
		p.ID, p.UserID,
	)
	if err != nil {
		return fmt.Errorf("paperRepo.Update: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("paper not found or permission denied")
	}
	return nil
}

func (r *paperRepo) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM papers WHERE id = $1 AND user_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("paperRepo.Delete: %w", err)
	}
	return nil
}

func (r *paperRepo) AddTags(ctx context.Context, paperID uuid.UUID, tagIDs []uuid.UUID) error {
	for _, tid := range tagIDs {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO paper_tags (paper_id, tag_id)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`, paperID, tid)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *paperRepo) SyncTags(ctx context.Context, paperID uuid.UUID, tagNames []string, userID uuid.UUID) error {
	// Delete existing tags for paper
	_, err := r.db.ExecContext(ctx, `DELETE FROM paper_tags WHERE paper_id = $1`, paperID)
	if err != nil {
		return err
	}

	for _, name := range tagNames {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			continue
		}
		// Upsert tag
		var tagID uuid.UUID
		err := r.db.QueryRowContext(ctx, `
			INSERT INTO tags (user_id, name)
			VALUES ($1, $2)
			ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
			RETURNING id
		`, userID, trimmed).Scan(&tagID)
		if err != nil {
			return err
		}

		_, err = r.db.ExecContext(ctx, `
			INSERT INTO paper_tags (paper_id, tag_id)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`, paperID, tagID)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *paperRepo) getTagsForPaper(ctx context.Context, paperID uuid.UUID) ([]domain.Tag, error) {
	query := `
		SELECT t.id, t.user_id, t.name, t.created_at
		FROM tags t
		JOIN paper_tags pt ON pt.tag_id = t.id
		WHERE pt.paper_id = $1
		ORDER BY t.name ASC
	`
	rows, err := r.db.QueryContext(ctx, query, paperID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []domain.Tag
	for rows.Next() {
		var t domain.Tag
		if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &t.CreatedAt); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	return tags, nil
}
