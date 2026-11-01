# 0003. PostgreSQL 16 for Vector/JSONB Storage and Full-Text Search

We evaluated MariaDB versus PostgreSQL for the research paper platform. Although MariaDB is available, we selected PostgreSQL 16 (running via OrbStack / Docker) for its native `JSONB` capabilities, built-in Full-Text Search (`tsvector`/`tsquery` for indexing paper text and notes), and mature driver ecosystem in Golang (`pgx`).
