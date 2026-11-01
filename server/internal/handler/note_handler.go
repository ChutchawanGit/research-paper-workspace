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

type NoteHandler struct {
	noteService *service.NoteService
}

func NewNoteHandler(noteService *service.NoteService) *NoteHandler {
	return &NoteHandler{noteService: noteService}
}

type createNoteReq struct {
	HighlightID *uuid.UUID `json:"highlight_id"`
	Title       string     `json:"title"`
	Content     string     `json:"content"`
}

func (h *NoteHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	paperIDStr := chi.URLParam(r, "id")
	paperID, err := uuid.Parse(paperIDStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid paper id")
		return
	}

	var req createNoteReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	input := service.CreateNoteInput{
		PaperID:     paperID,
		UserID:      userID,
		HighlightID: req.HighlightID,
		Title:       req.Title,
		Content:     req.Content,
	}

	note, err := h.noteService.Create(r.Context(), input)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error())
		return
	}

	JSON(w, http.StatusCreated, note)
}

func (h *NoteHandler) ListByPaper(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserIDFromContext(r.Context())

	paperIDStr := chi.URLParam(r, "id")
	paperID, err := uuid.Parse(paperIDStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid paper id")
		return
	}

	notes, err := h.noteService.ListByPaper(r.Context(), paperID, userID)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if notes == nil {
		notes = []*domain.Note{}
	}

	JSON(w, http.StatusOK, notes)
}

func (h *NoteHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid note id")
		return
	}

	var req createNoteReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	note, err := h.noteService.Update(r.Context(), id, userID, req.Title, req.Content, req.HighlightID)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error())
		return
	}

	JSON(w, http.StatusOK, note)
}

func (h *NoteHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid note id")
		return
	}

	if err := h.noteService.Delete(r.Context(), id, userID); err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]string{"message": "note deleted"})
}
