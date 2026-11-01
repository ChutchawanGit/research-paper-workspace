# Research Paper Reading & Annotation Platform (Paper Platform)

> A modern, multi-user SaaS web platform for collecting, categorizing, reading, and annotating research PDF papers, built as a flagship developer portfolio product for general users (students, researchers, and technical readers).

---

## 🏛 Architecture & Engineering Highlights

This project demonstrates production-grade full-stack systems engineering:

- **Backend (Golang)**: Clean Architecture (`cmd/api`, `domain`, `service`, `repository`, `handler`), Chi router, zero-trust middleware, SHA-256 PDF content-addressed storage deduplication, and streaming binary transport.
- **Frontend (React 18 + TypeScript + Vite)**: Single Page Application with Tailwind CSS, interactive PDF viewer via **Mozilla `pdfjs-dist`**, Rich Markdown Note Editor powered by **`TipTap` (ProseMirror)** with bidirectional sync between highlights and notes.
- **Database (PostgreSQL 16)**: Managed with OrbStack / Docker Compose, native `JSONB` for storing normalized bounding box coordinates (`0.0 - 1.0` percentage rects), and Full-Text Search indexing.
- **Security & Sharing (ADR 0002)**: Strict `user_id` multi-tenant data isolation with HttpOnly JWT cookies. Support for unlisted cryptographically secure **Share Links** allowing external visitors to view specific papers and read-only notes without logging in.

---

## 📂 Repository Structure

```
.
├── docker-compose.yml       # PostgreSQL 16 container definition
├── Makefile                 # One-command developer workflows
├── GLOSSARY.md              # Domain terminology & ubiquitous language
├── docs/
│   └── adr/                 # Architecture Decision Records (ADR 0001 - 0003)
│       ├── 0001-golang-backend-architecture.md
│       ├── 0002-secure-by-default-unlisted-share-links.md
│       └── 0003-postgresql-database-selection.md
├── server/                  # Golang Clean Architecture API
│   ├── cmd/api/main.go      # Server entrypoint (Port 8088)
│   ├── internal/
│   │   ├── domain/          # Entities & Repository Interfaces
│   │   ├── repository/      # PostgreSQL pgx implementations
│   │   ├── service/         # Business logic, Auth, Storage, Share Links
│   │   ├── handler/         # HTTP REST Controllers
│   │   └── middleware/      # JWT HttpOnly Cookie & Ownership verification
│   ├── pkg/
│   │   ├── storage/         # Storage abstraction (Local volume / S3-ready)
│   │   └── pdf/             # PDF page estimation & title cleaner
│   └── migrations/          # SQL migrations
└── client/                  # React + TypeScript + Vite + Tailwind SPA
    ├── src/
    │   ├── components/
    │   │   ├── reader/      # DualPaneReader & TipTap Markdown Editor
    │   │   ├── Dashboard.tsx
    │   │   ├── Navbar.tsx
    │   │   ├── Sidebar.tsx
    │   │   ├── PaperCard.tsx
    │   │   ├── UploadModal.tsx
    │   │   └── ShareModal.tsx
    │   ├── context/         # AuthContext
    │   ├── pages/           # PublicShareView
    │   └── api.ts           # Axios client with credentials
    └── package.json
```

---

## 🚀 Quickstart Guide

### 1. Start Database (PostgreSQL 16)
Ensure OrbStack (or Docker Desktop) is active:
```bash
make db-up
```

### 2. Start Golang API Backend
```bash
make server
```
*API runs on `http://localhost:8088`.*

### 3. Start Frontend Client
In a new terminal:
```bash
make client
```
*Frontend runs on `http://localhost:5173`.*

---

## 🧪 Verified Features & Workflows

1. **User Authentication**: Sign up with Name, Email, Password (hashed with bcrypt, JWT stored in HttpOnly cookie).
2. **Document Management**: Drag-and-drop research PDF files, auto-extract page count, deduplicate with SHA-256 hash.
3. **Multi-dimensional Taxonomy**: Organize by Collections (color-coded) and Tags, and track Reading Status (`To Read`, `Reading`, `Completed`).
4. **Dual-Pane In-Browser Reader**: Left pane renders PDF canvas; mouse selection triggers interactive text highlighting with normalized percentage coordinates (0.0 – 1.0).
5. **Bidirectional Note Synthesis**: Right pane provides TipTap Markdown editor with quote anchoring and one-click jump from note to PDF text.
6. **Public Sharing Link**: Generate unlisted read-only links to showcase papers on your developer portfolio without requiring visitors to create an account.
