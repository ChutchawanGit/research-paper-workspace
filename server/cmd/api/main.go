package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"paper-platform/internal/handler"
	"paper-platform/internal/middleware"
	"paper-platform/internal/repository"
	"paper-platform/internal/service"
	"paper-platform/pkg/storage"
)

func main() {
	_ = godotenv.Load(".env", "server/.env")

	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "paper_platform")
	dbSSL := getEnv("DB_SSLMODE", "disable")

	jwtSecret := getEnv("JWT_SECRET", "super-secret-developer-portfolio-key-2026")
	uploadDir := getEnv("UPLOAD_DIR", "./uploads")
	serverPort := getEnv("PORT", "8088")
	// 1. Connect Database
	db, err := repository.NewPostgresDB(repository.Config{
		Host:     dbHost,
		Port:     dbPort,
		User:     dbUser,
		Password: dbPassword,
		DBName:   dbName,
		SSLMode:  dbSSL,
	})
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer db.Close()
	log.Println("Connected to PostgreSQL successfully")

	// 2. Storage
	store, err := storage.NewLocalStorage(uploadDir)
	if err != nil {
		log.Fatalf("Storage initialization failed: %v", err)
	}

	// 3. Repositories
	userRepo := repository.NewUserRepository(db)
	colRepo := repository.NewCollectionRepository(db)
	paperRepo := repository.NewPaperRepository(db)
	tagRepo := repository.NewTagRepository(db)
	hlRepo := repository.NewHighlightRepository(db)
	noteRepo := repository.NewNoteRepository(db)
	shareRepo := repository.NewShareLinkRepository(db)

	// 4. Services
	authService := service.NewAuthService(userRepo, jwtSecret, 7*24*time.Hour)
	colService := service.NewCollectionService(colRepo)
	paperService := service.NewPaperService(paperRepo, tagRepo, store)
	hlService := service.NewHighlightService(hlRepo, paperRepo)
	noteService := service.NewNoteService(noteRepo)
	shareService := service.NewShareService(shareRepo, paperRepo, hlRepo, noteRepo)

	// 5. Handlers
	authHandler := handler.NewAuthHandler(authService)
	colHandler := handler.NewCollectionHandler(colService)
	paperHandler := handler.NewPaperHandler(paperService)
	hlHandler := handler.NewHighlightHandler(hlService)
	noteHandler := handler.NewNoteHandler(noteService)
	shareHandler := handler.NewShareHandler(shareService, paperService)

	// 6. Router & Middleware
	r := chi.NewRouter()

	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(chimw.Timeout(60 * time.Second))

	r.Use(cors.Handler(cors.Options{
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			return true // Supports localhost, Tailscale IPs, and public ts.net domains
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		handler.JSON(w, http.StatusOK, map[string]string{
			"status": "healthy",
			"time":   time.Now().UTC().Format(time.RFC3339),
		})
	})

	// Public Auth Routes
	r.Post("/api/auth/register", authHandler.Register)
	r.Post("/api/auth/login", authHandler.Login)

	// Public Share Routes (No authentication required)
	r.Get("/api/public/share/{token}", shareHandler.GetPublic)
	r.Get("/api/public/share/{token}/pdf", shareHandler.StreamPublicPDF)

	// Public / Showcase Routes (Read-only, enhanced if authenticated)
	r.Group(func(public chi.Router) {
		public.Use(middleware.OptionalAuthMiddleware(authService))

		public.Get("/api/collections", colHandler.List)
		public.Get("/api/papers", paperHandler.List)
		public.Get("/api/papers/{id}", paperHandler.Get)
		public.Get("/api/papers/{id}/pdf", paperHandler.StreamPDF)
		public.Get("/api/papers/{id}/highlights", hlHandler.ListByPaper)
		public.Get("/api/papers/{id}/notes", noteHandler.ListByPaper)
	})

	// Protected Routes (Require authenticated session)
	r.Group(func(protected chi.Router) {
		protected.Use(middleware.AuthMiddleware(authService))

		// Auth
		protected.Get("/api/auth/me", authHandler.Me)
		protected.Post("/api/auth/logout", authHandler.Logout)

		// Collections Management
		protected.Post("/api/collections", colHandler.Create)
		protected.Get("/api/collections/{id}", colHandler.Get)
		protected.Put("/api/collections/{id}", colHandler.Update)
		protected.Delete("/api/collections/{id}", colHandler.Delete)

		// Papers Management
		protected.Post("/api/papers/upload", paperHandler.Upload)
		protected.Put("/api/papers/{id}", paperHandler.Update)
		protected.Delete("/api/papers/{id}", paperHandler.Delete)

		// Highlights Management
		protected.Post("/api/papers/{id}/highlights", hlHandler.Create)
		protected.Put("/api/highlights/{id}/color", hlHandler.UpdateColor)
		protected.Delete("/api/highlights/{id}", hlHandler.Delete)

		// Notes Management
		protected.Post("/api/papers/{id}/notes", noteHandler.Create)
		protected.Put("/api/notes/{id}", noteHandler.Update)
		protected.Delete("/api/notes/{id}", noteHandler.Delete)

		// Share Links
		protected.Get("/api/papers/{id}/share", shareHandler.GetByPaper)
		protected.Post("/api/papers/{id}/share", shareHandler.Create)
		protected.Delete("/api/share/{id}", shareHandler.Revoke)
	})

	addr := fmt.Sprintf(":%s", serverPort)
	log.Printf("Paper Platform API running on port %s", serverPort)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
