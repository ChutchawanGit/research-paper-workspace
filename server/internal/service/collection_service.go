package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"paper-platform/internal/domain"
)

type CollectionService struct {
	repo domain.CollectionRepository
}

func NewCollectionService(repo domain.CollectionRepository) *CollectionService {
	return &CollectionService{repo: repo}
}

func (s *CollectionService) Create(ctx context.Context, userID uuid.UUID, name, description, color string) (*domain.Collection, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("collection name is required")
	}
	if color == "" {
		color = "#3B82F6"
	}

	col := &domain.Collection{
		ID:          uuid.New(),
		UserID:      userID,
		Name:        name,
		Description: description,
		Color:       color,
	}

	if err := s.repo.Create(ctx, col); err != nil {
		return nil, err
	}
	return col, nil
}

func (s *CollectionService) ListByUser(ctx context.Context, userID uuid.UUID) ([]*domain.Collection, error) {
	return s.repo.ListByUser(ctx, userID)
}

func (s *CollectionService) GetByID(ctx context.Context, id, userID uuid.UUID) (*domain.Collection, error) {
	return s.repo.GetByID(ctx, id, userID)
}

func (s *CollectionService) Update(ctx context.Context, id, userID uuid.UUID, name, description, color string) (*domain.Collection, error) {
	col, err := s.repo.GetByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if col == nil {
		return nil, errors.New("collection not found")
	}

	if name != "" {
		col.Name = strings.TrimSpace(name)
	}
	col.Description = description
	if color != "" {
		col.Color = color
	}

	if err := s.repo.Update(ctx, col); err != nil {
		return nil, err
	}
	return col, nil
}

func (s *CollectionService) Delete(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.Delete(ctx, id, userID)
}
