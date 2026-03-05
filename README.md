# DataSpeak — Project Documentation

> **Natural language to SQL** — Ask questions in plain English, get answers from your databases.
> .NET 8 Clean Architecture · Angular 21 · PostgreSQL · Redis · Ollama AI

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Technology Stack](#technology-stack)
5. [Key Design Patterns](#key-design-patterns)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Frontend Routes](#frontend-routes)
9. [Security Model](#security-model)
10. [AI Integration](#ai-integration)
11. [Caching Strategy](#caching-strategy)
12. [Development Setup](#development-setup)
13. [Environment Variables](#environment-variables)
14. [Running the App](#running-the-app)
15. [Deployment](#deployment)
16. [Common Bugs & Fixes](#common-bugs--fixes)
17. [Default Credentials](#default-credentials)

---

## Overview

DataSpeak lets users connect their databases (PostgreSQL, MySQL, SQL Server) and query them using plain English. The AI model translates natural language into safe, read-only SQL, executes it, and returns formatted results.

**Core value:** Non-technical users can query databases without writing SQL.

**Current AI backend:** Ollama local (model: `llama3.2:1b`) — registered as `IClaudeService` via `OllamaService`.
**Planned:** Swap to Claude API (Anthropic) by replacing `OllamaService` with `ClaudeService` in DI.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Angular 21 Frontend                    │
│         Standalone Components · Signals · Guards          │
└───────────────────────────┬──────────────────────────────┘
                            │ HTTPS / JWT
┌───────────────────────────▼──────────────────────────────┐
│                   ASP.NET Core 8 API                      │
│   TenantMiddleware → Rate Limiting → Auth → Controllers   │
│                                                           │
│   ┌──────────────────────────────────────────────────┐   │
│   │         Application Layer (MediatR CQRS)          │   │
│   │   Commands/Queries → Behaviors → Handlers         │   │
│   │   Validation → Logging → Performance Pipeline     │   │
│   └──────────────────────────────────────────────────┘   │
│                                                           │
│   ┌──────────────────────────────────────────────────┐   │
│   │              Infrastructure Layer                 │   │
│   │   Dapper (PostgreSQL) · Redis Cache · Ollama AI  │   │
│   │   JWT · BCrypt · AES-256 Encryption · Audit      │   │
│   └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
        │                │                  │
   PostgreSQL         Redis 7           Ollama AI
   (app data)      (triple cache)    (llama3.2:1b)
        │
   User's DBs
   (PostgreSQL / MySQL / SQL Server — via encrypted conn strings)
```

### Layer Responsibilities

| Layer | Project | Responsibility |
|-------|---------|----------------|
| API | `DataSpeak.API` | HTTP controllers, middleware, DI composition root |
| Application | `DataSpeak.Application` | CQRS handlers, validation, business rules |
| Domain | `DataSpeak.Domain` | Entities, enums, domain contracts |
| Infrastructure | `DataSpeak.Infrastructure` | Database, cache, AI, encryption, JWT |

---

## Project Structure

```
dataspeak/
├── PROJECT.md                         ← You are here
├── docker-compose.yml                 ← Local dev orchestration
├── .env.example                       ← Environment template (copy to .env)
├── DEPLOYMENT.md                      ← Azure AKS deployment guide
│
├── backend/
│   ├── DataSpeak.sln
│   ├── Dockerfile                     ← Multi-stage API build
│   └── src/
│       ├── DataSpeak.API/             ← ASP.NET Core entry point
│       │   ├── Program.cs             ← DI & middleware pipeline
│       │   ├── Controllers/
│       │   │   ├── AdminController.cs
│       │   │   ├── AuthController.cs
│       │   │   ├── ConnectionsController.cs
│       │   │   ├── QueriesController.cs
│       │   │   └── TenantsController.cs
│       │   └── Middleware/
│       │       ├── ExceptionHandlingMiddleware.cs
│       │       └── TenantMiddleware.cs
│       │
│       ├── DataSpeak.Application/     ← CQRS / business logic
│       │   ├── Common/
│       │   │   ├── Behaviors/         ← MediatR pipeline
│       │   │   │   ├── ValidationBehavior.cs
│       │   │   │   ├── LoggingBehavior.cs
│       │   │   │   └── PerformanceBehavior.cs
│       │   │   ├── Exceptions/        ← Domain exceptions
│       │   │   ├── Interfaces/        ← Service contracts (ports)
│       │   │   └── Models/            ← Shared DTOs
│       │   └── Features/
│       │       ├── Auth/Commands/     ← Login, Register, RefreshToken
│       │       ├── Connections/       ← CRUD + test connection
│       │       └── Queries/           ← ExecuteQuery, QueryHistory
│       │
│       ├── DataSpeak.Domain/          ← Entities & enums
│       │   ├── Common/
│       │   │   ├── BaseEntity.cs      ← Soft-delete base
│       │   │   └── TenantEntity.cs    ← Tenant-scoped base
│       │   ├── Entities/              ← Tenant, User, DatabaseConnection, etc.
│       │   └── Enums/                 ← DatabaseProvider, TenantRole, etc.
│       │
│       └── DataSpeak.Infrastructure/  ← Data access & external services
│           ├── Persistence/
│           │   └── ApplicationDbContext.cs  ← Dapper wrapper
│           └── Services/
│               ├── OllamaService.cs         ← AI (active)
│               ├── ClaudeService.cs         ← AI (alternative, swap in DI)
│               ├── QueryExecutionService.cs ← SQL safety + execution
│               ├── RedisCacheService.cs     ← Triple-layer cache
│               ├── EncryptionService.cs     ← AES-256
│               ├── JwtTokenService.cs
│               ├── BcryptPasswordHasher.cs
│               ├── AuditService.cs
│               └── CurrentUserService.cs
│
├── frontend/
│   ├── Dockerfile                     ← Nginx production build
│   ├── proxy.conf.json               ← Dev API proxy
│   └── src/app/
│       ├── app.component.ts           ← Root: just <router-outlet>
│       ├── app.config.ts              ← provideRouter, provideHttpClient, etc.
│       ├── app.routes.ts              ← Route definitions
│       ├── shell/
│       │   └── shell.component.ts     ← Sidebar layout for auth'd routes
│       ├── core/
│       │   ├── services/              ← auth, connection, query, notification
│       │   ├── guards/                ← auth.guard, role.guard
│       │   ├── interceptors/          ← auth.interceptor (JWT attach)
│       │   └── models/                ← TypeScript interfaces
│       └── features/                  ← Lazy-loaded routes
│           ├── auth/                  ← login, register
│           ├── connections/           ← list, form
│           ├── query/                 ← chat UI, history
│           ├── admin/                 ← admin dashboard
│           └── dashboard/             ← main dashboard
│
├── database/
│   └── schema.sql                     ← Full PostgreSQL schema
│
└── k8s/                               ← Kubernetes manifests (Azure AKS)
    ├── namespace.yaml
    ├── configmap.yaml
    ├── secrets-example.yaml
    ├── api-deployment.yaml
    ├── frontend-deployment.yaml
    ├── services.yaml
    ├── hpa.yaml
    └── ingress.yaml
```

---

## Technology Stack

### Backend

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | ASP.NET Core | 8.0 |
| Language | C# | 12 |
| ORM | Dapper (raw SQL) | 2.1.28 |
| DB Driver | Npgsql | 8.0.1 |
| DB Driver | MySqlConnector | 2.3.5 |
| DB Driver | Microsoft.Data.SqlClient | 5.2.1 |
| CQRS | MediatR | 12.2.0 |
| Validation | FluentValidation | 11.9.0 |
| Cache | StackExchange.Redis | 2.7.10 |
| Auth | JWT Bearer (HMAC-SHA256) | — |
| Password | BCrypt.Net-Next | 4.0.3 |
| Rate Limiting | AspNetCoreRateLimit | 5.0.0 |
| Logging | Serilog | — |
| AI (active) | Ollama HTTP API | llama3.2:1b |
| AI (alt) | Anthropic Claude HTTP | claude-3-5-sonnet |

### Frontend

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Angular | 21 |
| Language | TypeScript | — |
| State | Angular Signals | — |
| HTTP | Angular HttpClient | — |
| Styling | Angular Material / CSS | — |

### Infrastructure

| Component | Technology |
|-----------|-----------|
| App Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Containers | Docker / Docker Compose |
| Orchestration | Kubernetes (Azure AKS) |
| Container Registry | Azure Container Registry |

---

## Key Design Patterns

### 1. CQRS with MediatR

All business logic is dispatched through MediatR. No controller directly touches a repository.

```
Controller → IMediator.Send(command/query) → Handler → Repository/Service
```

**MediatR Pipeline (order of execution):**
1. `ValidationBehavior` — FluentValidation (throws `ValidationException` on failure)
2. `LoggingBehavior` — Structured logs for every request
3. `PerformanceBehavior` — Warns if handler takes > 500ms

### 2. Multi-Tenancy

Every authenticated request carries a `tenantId` JWT claim. `TenantMiddleware` reads it and stores it in `ICurrentUserService`. Every repository filters all queries by `TenantId`. No cross-tenant data leakage is possible.

```
JWT → TenantMiddleware → ICurrentUserService.TenantId → All Dapper queries WHERE tenant_id = @TenantId
```

### 3. Dual-Layer SQL Safety

The AI may only generate SELECT statements. Enforced at two independent layers:

- **Layer 1 (AI prompt):** System prompt instructs the model to output only SELECT statements. If it detects a write intent, it outputs a sentinel string (e.g., `WRITE_INTENT_DETECTED`).
- **Layer 2 (code):** `QueryExecutionService` tokenizes every SQL string before execution. If it finds INSERT/UPDATE/DELETE/DROP/CREATE/TRUNCATE/ALTER/EXEC/GRANT/REVOKE tokens, execution is blocked and `QuerySafetyException` is thrown.

### 4. Triple-Layer Redis Cache

```
L1: Schema cache      → TTL 1 hour   (DB schema context for AI prompt)
L2: SQL cache         → TTL 5 min    (cached SQL for identical NL queries)
L3: Query results     → TTL 1 min    (cached result sets)
```

Cache keys include `tenantId` + `connectionId` to prevent cross-tenant cache hits.

### 5. Soft Delete

All entities extend `BaseEntity` which has `IsDeleted` and `DeletedAt` fields. Nothing is ever hard-deleted. All queries filter `WHERE is_deleted = false`.

### 6. AES-256 Encryption

User database connection strings are encrypted with AES-256 before being stored in PostgreSQL. The `ENCRYPTION_MASTER_KEY` in `.env` is the root key and must never be committed to git.

### 7. JWT with Refresh Tokens

- Access tokens: 15-minute expiry, HMAC-SHA256
- Refresh tokens: stored hashed in DB, rotated on each use
- `RefreshTokenCommand` validates, rotates, and returns a new pair

### 8. Angular Standalone Components

No NgModules. All components use `standalone: true`. Lazy loading is done via `loadComponent` in route definitions. Guards and interceptors are functional (not class-based).

**Routing structure:**
```
/ → redirect to /app/dashboard (if authenticated) or /auth/login
/auth/login       → LoginComponent (no shell)
/auth/register    → RegisterComponent (no shell)
/app              → ShellComponent (sidebar layout, auth guard)
  /app/dashboard  → DashboardComponent
  /app/query      → QueryChatComponent (main feature)
  /app/history    → QueryHistoryComponent
  /app/connections → ConnectionListComponent
  /app/admin      → AdminDashboardComponent (role guard: Owner/Admin)
```

---

## Database Schema

All tables live in the `endeavour_test_area` schema on PostgreSQL.

### Tables

#### `tenants`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | VARCHAR | |
| slug | VARCHAR UNIQUE | URL-safe identifier |
| plan | VARCHAR | free / pro / enterprise |
| max_users | INT | |
| max_connections | INT | |
| monthly_query_limit | INT | |
| is_deleted | BOOL | soft delete |
| created_at / updated_at | TIMESTAMP | |

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | UUID FK → tenants | |
| email | VARCHAR | UNIQUE per tenant |
| password_hash | VARCHAR | BCrypt |
| refresh_token | VARCHAR | hashed |
| refresh_token_expires_at | TIMESTAMP | |
| last_login_at | TIMESTAMP | |
| is_deleted | BOOL | soft delete |

#### `user_tenant_roles`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| tenant_id | UUID FK → tenants | |
| role | INT | 0=Owner, 1=Admin, 2=Analyst |

#### `database_connections`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| name | VARCHAR | display name |
| provider | INT | 0=PostgreSQL, 1=MySQL, 2=SqlServer |
| encrypted_connection_string | TEXT | AES-256 |
| status | INT | 0=Unknown, 1=Active, 2=Failed |
| last_tested_at | TIMESTAMP | |

#### `query_history`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | UUID FK | |
| user_id | UUID FK | |
| connection_id | UUID FK | |
| natural_language_query | TEXT | original user input |
| generated_sql | TEXT | AI-generated SQL |
| status | INT | 0=Pending, 1=Success, 2=Failed, 3=Blocked |
| row_count | INT | |
| execution_time_ms | INT | |
| error_message | TEXT | |

#### `query_usage`
Monthly usage tracking per tenant.

#### `audit_logs`
Security audit trail — all state-changing operations.

---

## API Endpoints

Base URL: `http://localhost:5000/api`
Swagger: `http://localhost:5000/swagger`

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register new tenant + owner user |
| POST | `/auth/login` | No | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | No | Refresh access token |

### Connections (`/api/connections`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/connections` | Yes | List tenant's DB connections |
| POST | `/connections` | Yes | Create new connection (encrypts conn string) |
| POST | `/connections/{id}/test` | Yes | Test connection liveness |

### Queries (`/api/queries`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/queries/execute` | Yes | Execute NL query → SQL → results |
| GET | `/queries/history` | Yes | Paginated query history |

### Admin (`/api/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/tenants` | Owner | List all tenants |
| GET | `/admin/audit-logs` | Owner/Admin | Audit log |

### Tenants (`/api/tenants`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/tenants/me` | Yes | Current tenant info |
| PUT | `/tenants/me` | Owner | Update tenant settings |

---

## Frontend Routes

| Route | Component | Guard | Description |
|-------|-----------|-------|-------------|
| `/auth/login` | LoginComponent | None | Login page |
| `/auth/register` | RegisterComponent | None | Registration |
| `/app/dashboard` | DashboardComponent | AuthGuard | Overview |
| `/app/query` | QueryChatComponent | AuthGuard | **Main feature — chat UI** |
| `/app/history` | QueryHistoryComponent | AuthGuard | Past queries |
| `/app/connections` | ConnectionListComponent | AuthGuard | Manage DB connections |
| `/app/admin` | AdminDashboardComponent | RoleGuard (Owner/Admin) | Admin panel |

---

## Security Model

| Concern | Solution |
|---------|---------|
| Authentication | JWT Bearer (HS256), 15-min access tokens |
| Refresh | Hashed refresh tokens, rotated on use |
| Multi-tenancy isolation | TenantMiddleware + every query filtered by tenant_id |
| SQL injection prevention | Dapper parameterized queries always |
| Write query prevention | Dual-layer: AI prompt sentinel + code tokenizer |
| Connection string storage | AES-256 encrypted at rest |
| Password storage | BCrypt with work factor 12 |
| Rate limiting | IP-based via AspNetCoreRateLimit |
| Secrets | Never committed — `.env` in `.gitignore`, Kubernetes Secrets in prod |
| Audit | Every state change logged to audit_logs table |

---

## AI Integration

### Current: Ollama (local)

**Service:** `OllamaService.cs` registered as `IClaudeService`
**Model:** `llama3.2:1b`
**Endpoint:** `http://localhost:11434/api/generate`

The prompt includes:
1. System prompt: "You are a SQL expert. Generate only SELECT statements."
2. Available tables list (from schema cache)
3. The user's natural language question
4. Write-intent pre-check instruction
5. Sentinel outputs: `WRITE_INTENT_DETECTED`, `NO_RELEVANT_TABLE`

### Switching to Claude API

To switch from Ollama to Claude API:
1. In `backend/src/DataSpeak.Infrastructure/DependencyInjection.cs`, change:
   ```csharp
   // FROM:
   services.AddScoped<IClaudeService, OllamaService>();
   // TO:
   services.AddScoped<IClaudeService, ClaudeService>();
   ```
2. Set `CLAUDE_API_KEY` in `.env`
3. `ClaudeService.cs` is already implemented and ready

### AI Query Flow

```
User NL query
     ↓
Check SQL cache (Redis L2) — if hit, skip AI
     ↓
Build schema context (Redis L1 cache)
     ↓
AI generates SQL
     ↓
Write-intent check (sentinel detection)
     ↓
Code-level SQL tokenizer validation
     ↓
Execute SELECT via Dapper against user's database
     ↓
Cache results (Redis L3)
     ↓
Return results + generated SQL to user
```

---

## Caching Strategy

| Cache Layer | Key Pattern | TTL | Content |
|-------------|-------------|-----|---------|
| L1 Schema | `schema:{tenantId}:{connectionId}` | 1 hour | DB schema for AI context |
| L2 SQL | `sql:{tenantId}:{connectionId}:{hash(nlQuery)}` | 5 min | Generated SQL for NL query |
| L3 Results | `results:{tenantId}:{connectionId}:{hash(sql)}` | 1 min | Query result set |

Redis config: `connectTimeout=300, syncTimeout=300, connectRetry=0` (fail-fast, no hang).

---

## Development Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) (for running backend locally without Docker)
- [Node.js 20+](https://nodejs.org/) (for running frontend locally without Docker)
- [Ollama](https://ollama.ai/) with `llama3.2:1b` pulled (for AI features)

### Quick Start (Docker)

```bash
# 1. Clone repo
git clone https://github.com/dineshwork009-cyber/DataSpeak.git
cd DataSpeak

# 2. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET_KEY and ENCRYPTION_MASTER_KEY at minimum

# 3. Start all services
docker compose up --build

# 4. Access
# Frontend:   http://localhost:4200
# API Swagger: http://localhost:5000/swagger
# Default login: admin@dataspeak.io / Admin1234
```

### Running Backend Locally (no Docker)

```bash
# Requires PostgreSQL and Redis running separately
cd backend/src/DataSpeak.API
ASPNETCORE_ENVIRONMENT=Development dotnet run
# API runs on http://localhost:5000
```

### Running Frontend Locally (no Docker)

```bash
cd frontend
npm install
ng serve
# Proxies /api to http://localhost:5000 via proxy.conf.json
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_PASSWORD` | Yes | PostgreSQL password for dataspeak_user |
| `JWT_SECRET_KEY` | Yes | Min 32 chars, HS256 signing key |
| `ENCRYPTION_MASTER_KEY` | Yes | Exactly 32 chars, AES-256 key for connection strings |
| `CLAUDE_API_KEY` | No | Only needed if switching to Claude API |

**Never commit `.env` to git.** It is in `.gitignore`.

---

## Deployment

See **`DEPLOYMENT.md`** for full Azure AKS deployment instructions including:
- ACR image build and push
- AKS cluster setup
- Kubernetes secret management
- PostgreSQL Flexible Server + Azure Cache for Redis
- Ingress with TLS
- GitHub Actions CI/CD pipeline skeleton

---

## Common Bugs & Fixes

### Dapper: Positional Record Mapping Fails

**Problem:** `record Foo(string Bar, int Baz)` — Dapper can't map positional records.
**Fix:** Use private class with `{ get; init; }` properties and SQL column aliases:

```csharp
// WRONG
private record Result(string Name, int Count);

// CORRECT
private class Result
{
    public string Name { get; init; } = default!;
    public int Count { get; init; }
}
```

### Redis: Connection Hangs on Failure

**Problem:** StackExchange.Redis default retry/timeout causes 30s+ hangs when Redis is unavailable.
**Fix:** Use fail-fast connection string:

```
redis:6379,connectTimeout=300,syncTimeout=300,connectRetry=0
```

### llama3.2:1b: Ignores Instructions

**Problem:** Small model often ignores "SELECT only" instructions and generates write queries.
**Fix:** The prompt MUST include:
1. `AVAILABLE TABLES:` section listing all table names
2. Pre-check write-intent instruction before generating SQL
3. Sentinel outputs (`WRITE_INTENT_DETECTED`) that code checks for
4. The code-level tokenizer in `QueryExecutionService` as the hard safety net

### PostgreSQL: Case-Sensitive Identifiers

**Problem:** PostgreSQL lowercases unquoted identifiers; queries fail if schema uses mixed case.
**Fix:** All identifiers in `BuildSchemaContext` and generated SQL are double-quoted.

### Angular Routing: Components Appear Twice

**Problem:** Sidebar/shell rendered inside another shell because `AppComponent` had the layout.
**Fix:**
- `AppComponent` = only `<router-outlet>` (bare)
- `ShellComponent` at `src/app/shell/shell.component.ts` = sidebar layout
- `app.routes.ts` uses `ShellComponent` as the parent for all protected routes

---

## Default Credentials

| Item | Value |
|------|-------|
| Login email | `admin@dataspeak.io` |
| Login password | `Admin1234` |
| Database host | `endeavourtech.ddns.net:50271` |
| Database name | `CrudDB` |
| Schema | `endeavour_test_area` |

> **Note:** Change default credentials before any production deployment.

---

## Contributing / Next Steps

When picking up this project:

1. Read this document fully
2. Check `MEMORY.md` in `.claude/` for session-specific notes
3. Run `docker compose up` to get the full stack running
4. Visit `http://localhost:5000/swagger` to explore the API interactively
5. The main feature being built is `QueryChatComponent` — chat-style NL query interface

**Potential improvements:**
- [ ] Add `schema_version` tracking so schema cache invalidates on DB changes
- [ ] Streaming AI responses via SSE (Server-Sent Events)
- [ ] Export query results as CSV/Excel
- [ ] Scheduled/saved queries
- [ ] Switch to Claude API for better accuracy (just change one DI registration)
- [ ] Add unit tests for `QueryExecutionService` safety checks
- [ ] Add integration tests for Auth flow
