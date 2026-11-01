package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"paper-platform/internal/domain"
	"paper-platform/internal/middleware"
	"paper-platform/internal/service"
)

type CollectionHandler struct {
	colService *service.CollectionService
}

func NewCollectionHandler(colService *service.CollectionService) *CollectionHandler {
	return &CollectionHandler{colService: colService}
}

type createCollectionReq struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

func (h *CollectionHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req createCollectionReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	col, err := h.colService.Create(r.Context(), userID, req.Name, req.Description, req.Color)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error())
		return
	}

	JSON(w, http.StatusCreated, col)
}

func (h *CollectionHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	cols, err := h.colService.ListByUser(r.Context(), userID)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if cols == nil {
		cols = []*domain.Collection{}
	}
	JSON(w, http.StatusOK, cols)
}

func (h *CollectionHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid collection id")
		return
	}

	col, err := h.colService.GetByID(r.Context(), id, userID)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if col == nil {
		Error(w, http.StatusNotFound, "collection not found")
		return
	}

	JSON(w, http.StatusOK, col)
}

func (h *CollectionHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid collection id")
		return
	}

	var req createCollectionReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	col, err := h.colService.Update(r.Context(), id, userID, req.Name, req.Description, req.Color)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error())
		return
	}

	JSON(w, http.StatusOK, col)
}

func (h *CollectionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid collection id")
		return
	}

	if err := h.colService.Delete(r.Context(), id, userID); err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]string{"message": "collection deleted"})
}
