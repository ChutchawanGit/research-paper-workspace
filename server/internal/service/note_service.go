package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"paper-platform/internal/domain"
)

type NoteService struct {
	noteRepo domain.NoteRepository
}

func NewNoteService(noteRepo domain.NoteRepository) *NoteService {
	return &NoteService{noteRepo: noteRepo}
}

type CreateNoteInput struct {
	PaperID     uuid.UUID  `json:"paper_id"`
	UserID      uuid.UUID  `json:"user_id"`
	HighlightID *uuid.UUID `json:"highlight_id,omitempty"`
	Title       string     `json:"title"`
	Content     string     `json:"content"`
}

func (s *NoteService) Create(ctx context.Context, input CreateNoteInput) (*domain.Note, error) {
	note := &domain.Note{
		ID:          uuid.New(),
		PaperID:     input.PaperID,
		UserID:      input.UserID,
		HighlightID: input.HighlightID,
		Title:       strings.TrimSpace(input.Title),
		Content:     input.Content,
	}

	if err := s.noteRepo.Create(ctx, note); err != nil {
		return nil, err
	}
	return note, nil
}

func (s *NoteService) ListByPaper(ctx context.Context, paperID, userID uuid.UUID) ([]*domain.Note, error) {
	return s.noteRepo.ListByPaper(ctx, paperID, userID)
}

func (s *NoteService) ListByPaperPublic(ctx context.Context, paperID uuid.UUID) ([]*domain.Note, error) {
	return s.noteRepo.ListByPaperPublic(ctx, paperID)
}

func (s *NoteService) GetByID(ctx context.Context, id, userID uuid.UUID) (*domain.Note, error) {
	return s.noteRepo.GetByID(ctx, id, userID)
}

func (s *NoteService) Update(ctx context.Context, id, userID uuid.UUID, title, content string, highlightID *uuid.UUID) (*domain.Note, error) {
	note, err := s.noteRepo.GetByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if note == nil {
		return nil, errors.New("note not found")
	}

	note.Title = strings.TrimSpace(title)
	note.Content = content
	note.HighlightID = highlightID

	if err := s.noteRepo.Update(ctx, note); err != nil {
		return nil, err
	}
	return note, nil
}

func (s *NoteService) Delete(ctx context.Context, id, userID uuid.UUID) error {
	return s.noteRepo.Delete(ctx, id, userID)
}
