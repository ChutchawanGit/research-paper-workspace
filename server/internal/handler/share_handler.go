package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"paper-platform/internal/middleware"
	"paper-platform/internal/service"
)

type ShareHandler struct {
	shareService *service.ShareService
	paperService *service.PaperService
}

func NewShareHandler(shareService *service.ShareService, paperService *service.PaperService) *ShareHandler {
	return &ShareHandler{
		shareService: shareService,
		paperService: paperService,
	}
}

type createShareReq struct {
	IncludeNotes  bool `json:"include_notes"`
	ExpiresInDays int  `json:"expires_in_days"`
}

func (h *ShareHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req createShareReq
	// Default include notes to true
	req.IncludeNotes = true
	_ = json.NewDecoder(r.Body).Decode(&req)

	sl, err := h.shareService.CreateShareLink(r.Context(), paperID, userID, req.IncludeNotes, req.ExpiresInDays)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error())
		return
	}

	JSON(w, http.StatusCreated, sl)
}

func (h *ShareHandler) GetByPaper(w http.ResponseWriter, r *http.Request) {
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

	sl, err := h.shareService.GetByPaperID(r.Context(), paperID, userID)
	if err != nil || sl == nil {
		JSON(w, http.StatusOK, nil)
		return
	}

	JSON(w, http.StatusOK, sl)
}

func (h *ShareHandler) Revoke(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid share link id")
		return
	}

	if err := h.shareService.Revoke(r.Context(), id, userID); err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]string{"message": "share link revoked"})
}

// Public endpoints (No authentication required)

func (h *ShareHandler) GetPublic(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" {
		Error(w, http.StatusBadRequest, "missing token")
		return
	}

	data, err := h.shareService.GetPublicSharedPaper(r.Context(), token)
	if err != nil {
		Error(w, http.StatusNotFound, err.Error())
		return
	}

	JSON(w, http.StatusOK, data)
}

func (h *ShareHandler) StreamPublicPDF(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" {
		Error(w, http.StatusBadRequest, "missing token")
		return
	}

	data, err := h.shareService.GetPublicSharedPaper(r.Context(), token)
	if err != nil || data == nil {
		Error(w, http.StatusNotFound, "shared paper not found or link expired")
		return
	}

	stream, err := h.paperService.GetPDFStream(r.Context(), data.Paper.FilePath)
	if err != nil {
		Error(w, http.StatusInternalServerError, "failed to read file stream")
		return
	}
	defer stream.Close()

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "inline; filename=\""+data.Paper.Title+".pdf\"")
	w.Header().Set("Accept-Ranges", "bytes")
	_, _ = io.Copy(w, stream)
}
