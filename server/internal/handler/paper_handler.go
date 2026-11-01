package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"paper-platform/internal/domain"
	"paper-platform/internal/middleware"
	"paper-platform/internal/service"
)

type PaperHandler struct {
	paperService *service.PaperService
}

func NewPaperHandler(paperService *service.PaperService) *PaperHandler {
	return &PaperHandler{paperService: paperService}
}

func (h *PaperHandler) Upload(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	// 50MB max upload size
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		Error(w, http.StatusBadRequest, "file size exceeds 50MB limit or invalid multipart form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		Error(w, http.StatusBadRequest, "file parameter is required")
		return
	}
	defer file.Close()

	title := r.FormValue("title")
	authors := r.FormValue("authors")
	abstract := r.FormValue("abstract")
	pubDate := r.FormValue("publication_date")
	doi := r.FormValue("doi")
	tagsRaw := r.FormValue("tags")

	var colID *uuid.UUID
	colIDStr := r.FormValue("collection_id")
	if colIDStr != "" {
		if parsed, err := uuid.Parse(colIDStr); err == nil {
			colID = &parsed
		}
	}

	var tags []string
	if tagsRaw != "" {
		for _, t := range strings.Split(tagsRaw, ",") {
			trimmed := strings.TrimSpace(t)
			if trimmed != "" {
				tags = append(tags, trimmed)
			}
		}
	}

	input := service.UploadPaperInput{
		UserID:          userID,
		CollectionID:    colID,
		Title:           title,
		Authors:         authors,
		Abstract:        abstract,
		PublicationDate: pubDate,
		DOI:             doi,
		Tags:            tags,
		FileName:        header.Filename,
		FileReader:      file,
	}

	paper, err := h.paperService.UploadPaper(r.Context(), input)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusCreated, paper)
}

func (h *PaperHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	q := r.URL.Query()
	filter := domain.PaperFilter{
		UserID:      userID,
		SearchQuery: q.Get("q"),
	}

	if cidStr := q.Get("collection_id"); cidStr != "" {
		if cid, err := uuid.Parse(cidStr); err == nil {
			filter.CollectionID = &cid
		}
	}

	if tidStr := q.Get("tag_id"); tidStr != "" {
		if tid, err := uuid.Parse(tidStr); err == nil {
			filter.TagID = &tid
		}
	}

	if statusStr := q.Get("status"); statusStr != "" {
		st := domain.ReadingStatus(statusStr)
		filter.ReadingStatus = &st
	}

	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	filter.Limit = limit
	filter.Offset = offset

	papers, total, err := h.paperService.List(r.Context(), filter)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]interface{}{
		"papers": papers,
		"total":  total,
	})
}

func (h *PaperHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid paper id")
		return
	}

	paper, err := h.paperService.GetByID(r.Context(), id, userID)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if paper == nil {
		Error(w, http.StatusNotFound, "paper not found")
		return
	}

	JSON(w, http.StatusOK, paper)
}

type updatePaperReq struct {
	CollectionID    *uuid.UUID           `json:"collection_id"`
	Title           string               `json:"title"`
	Authors         string               `json:"authors"`
	Abstract        string               `json:"abstract"`
	PublicationDate string               `json:"publication_date"`
	DOI             string               `json:"doi"`
	ReadingStatus   domain.ReadingStatus `json:"reading_status"`
	Tags            []string             `json:"tags"`
}

func (h *PaperHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid paper id")
		return
	}

	var req updatePaperReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	input := service.UpdatePaperInput{
		ID:              id,
		UserID:          userID,
		CollectionID:    req.CollectionID,
		Title:           req.Title,
		Authors:         req.Authors,
		Abstract:        req.Abstract,
		PublicationDate: req.PublicationDate,
		DOI:             req.DOI,
		ReadingStatus:   req.ReadingStatus,
		Tags:            req.Tags,
	}

	paper, err := h.paperService.Update(r.Context(), input)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error())
		return
	}

	JSON(w, http.StatusOK, paper)
}

func (h *PaperHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid paper id")
		return
	}

	if err := h.paperService.Delete(r.Context(), id, userID); err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]string{"message": "paper deleted successfully"})
}

func (h *PaperHandler) StreamPDF(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		Error(w, http.StatusBadRequest, "invalid paper id")
		return
	}

	paper, err := h.paperService.GetByID(r.Context(), id, userID)
	if err != nil || paper == nil {
		Error(w, http.StatusNotFound, "paper not found")
		return
	}

	stream, err := h.paperService.GetPDFStream(r.Context(), paper.FilePath)
	if err != nil {
		Error(w, http.StatusInternalServerError, "failed to read file stream")
		return
	}
	defer stream.Close()

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "inline; filename=\""+paper.Title+".pdf\"")
	w.Header().Set("Accept-Ranges", "bytes")
	_, _ = io.Copy(w, stream)
}
