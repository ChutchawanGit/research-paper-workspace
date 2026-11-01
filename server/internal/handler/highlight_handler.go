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

type HighlightHandler struct {
	hlService    *service.HighlightService
	paperService *service.PaperService
}

func NewHighlightHandler(hlService *service.HighlightService, paperService *service.PaperService) *HighlightHandler {
	return &HighlightHandler{hlService: hlService, paperService: paperService}
}

type createHighlightReq struct {
	PageIndex    int                    `json:"page_index"`
	Rects        []domain.HighlightRect `json:"rects"`
	SelectedText string                 `json:"selected_text"`
	Color        string                 `json:"color"`
}

func (h *HighlightHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserIDFromContext(r.Context())

	paperIDStr := chi.URLParam(r, "id")
	paperID, err := uuid.Parse(paperIDStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid paper id")
		return
	}

	if userID == uuid.Nil {
		paper, err := h.paperService.GetByIDPublic(r.Context(), paperID)
		if err == nil && paper != nil {
			userID = paper.UserID
		}
	}

	var req createHighlightReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	input := service.CreateHighlightInput{
		PaperID:      paperID,
		UserID:       userID,
		PageIndex:    req.PageIndex,
		Rects:        req.Rects,
		SelectedText: req.SelectedText,
		Color:        req.Color,
	}

	hl, err := h.hlService.Create(r.Context(), input)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error())
		return
	}

	JSON(w, http.StatusCreated, hl)
}

func (h *HighlightHandler) ListByPaper(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserIDFromContext(r.Context())

	paperIDStr := chi.URLParam(r, "id")
	paperID, err := uuid.Parse(paperIDStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid paper id")
		return
	}

	list, err := h.hlService.ListByPaper(r.Context(), paperID, userID)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if list == nil {
		list = []*domain.Highlight{}
	}

	JSON(w, http.StatusOK, list)
}

type updateColorReq struct {
	Color string `json:"color"`
}

func (h *HighlightHandler) UpdateColor(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserIDFromContext(r.Context())

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid highlight id")
		return
	}

	var req updateColorReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.hlService.UpdateColor(r.Context(), id, userID, req.Color); err != nil {
		Error(w, http.StatusBadRequest, err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]string{"message": "color updated"})
}

func (h *HighlightHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserIDFromContext(r.Context())

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid highlight id")
		return
	}

	if err := h.hlService.Delete(r.Context(), id, userID); err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]string{"message": "highlight deleted"})
}
