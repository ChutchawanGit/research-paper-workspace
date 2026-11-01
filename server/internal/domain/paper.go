package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type ReadingStatus string

const (
	StatusToRead    ReadingStatus = "to_read"
	StatusReading   ReadingStatus = "reading"
	StatusCompleted ReadingStatus = "completed"
)

type Tag struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Paper struct {
	ID              uuid.UUID     `json:"id"`
	UserID          uuid.UUID     `json:"user_id"`
	CollectionID    *uuid.UUID    `json:"collection_id,omitempty"`
	CollectionName  string        `json:"collection_name,omitempty"`
	CollectionColor string        `json:"collection_color,omitempty"`
	Title           string        `json:"title"`
	Authors         string        `json:"authors"`
	Abstract        string        `json:"abstract"`
	PublicationDate string        `json:"publication_date"`
	DOI             string        `json:"doi"`
	FileHash        string        `json:"file_hash"`
	FilePath        string        `json:"file_path,omitempty"`
	FileSize        int64         `json:"file_size"`
	PageCount       int           `json:"page_count"`
	ReadingStatus   ReadingStatus `json:"reading_status"`
	Tags            []Tag         `json:"tags,omitempty"`
	HighlightCount  int           `json:"highlight_count,omitempty"`
	NoteCount       int           `json:"note_count,omitempty"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

type PaperFilter struct {
	UserID        uuid.UUID
	CollectionID  *uuid.UUID
	TagID         *uuid.UUID
	ReadingStatus *ReadingStatus
	SearchQuery   string
	Limit         int
	Offset        int
}

type PaperRepository interface {
	Create(ctx context.Context, paper *Paper) error
	GetByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*Paper, error)
	GetByIDPublic(ctx context.Context, id uuid.UUID) (*Paper, error)
	List(ctx context.Context, filter PaperFilter) ([]*Paper, int, error)
	Update(ctx context.Context, paper *Paper) error
	Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
	AddTags(ctx context.Context, paperID uuid.UUID, tagIDs []uuid.UUID) error
	SyncTags(ctx context.Context, paperID uuid.UUID, tagNames []string, userID uuid.UUID) error
}

type TagRepository interface {
	GetOrCreate(ctx context.Context, userID uuid.UUID, name string) (*Tag, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]*Tag, error)
	Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}
