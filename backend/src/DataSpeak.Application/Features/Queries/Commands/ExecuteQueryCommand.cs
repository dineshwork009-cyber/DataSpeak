using DataSpeak.Application.Common.Exceptions;
using DataSpeak.Application.Common.Interfaces;
using DataSpeak.Domain.Enums;
using FluentValidation;
using MediatR;

namespace DataSpeak.Application.Features.Queries.Commands;

// ──────────────────────────────────────────────────────────────
// Command + Response
// ──────────────────────────────────────────────────────────────
public record ExecuteQueryCommand(
    Guid ConnectionId,
    string NaturalLanguageQuery) : IRequest<QueryResponse>;

public record QueryResponse(
    Guid QueryId,
    string GeneratedSql,
    IEnumerable<string> Columns,
    IEnumerable<Dictionary<string, object?>> Rows,
    int RowCount,
    long ExecutionTimeMs,
    int TokensUsed,
    bool Success,
    string? ErrorMessage = null);

// ──────────────────────────────────────────────────────────────
// Validator
// ──────────────────────────────────────────────────────────────
public class ExecuteQueryCommandValidator : AbstractValidator<ExecuteQueryCommand>
{
    public ExecuteQueryCommandValidator()
    {
        RuleFor(x => x.ConnectionId).NotEmpty();
        RuleFor(x => x.NaturalLanguageQuery)
            .NotEmpty()
            .MaximumLength(2000)
            .WithMessage("Query must be between 1 and 2000 characters.");
    }
}

// ──────────────────────────────────────────────────────────────
// Handler  — the core AI query pipeline
// ──────────────────────────────────────────────────────────────
public class ExecuteQueryCommandHandler : IRequestHandler<ExecuteQueryCommand, QueryResponse>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IClaudeService _claude;
    private readonly IQueryExecutionService _queryExecution;
    private readonly ICacheService _cache;
    private readonly IAuditService _audit;

    // Cache TTL constants
    private static readonly TimeSpan SchemaCacheTtl     = TimeSpan.FromHours(1);
    private static readonly TimeSpan SqlCacheTtl        = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan ResultCacheTtl     = TimeSpan.FromMinutes(1);

    public ExecuteQueryCommandHandler(
        IApplicationDbContext db,
        ICurrentUserService currentUser,
        IClaudeService claude,
        IQueryExecutionService queryExecution,
        ICacheService cache,
        IAuditService audit)
    {
        _db             = db;
        _currentUser    = currentUser;
        _claude         = claude;
        _queryExecution = queryExecution;
        _cache          = cache;
        _audit          = audit;
    }

    public async Task<QueryResponse> Handle(ExecuteQueryCommand cmd, CancellationToken ct)
    {
        var tenantId = _currentUser.TenantId;
        var userId   = _currentUser.UserId;
        var queryId  = Guid.NewGuid();

        // 1. Load connection (tenant-scoped)
        var conn = await _db.QueryFirstOrDefaultAsync<ConnectionRecord>(
            @"SELECT id,
                     tenant_id                   AS TenantId,
                     provider,
                     encrypted_connection_string AS EncryptedConnectionString,
                     name
              FROM database_connections
              WHERE id = @ConnId AND tenant_id = @TenantId
                AND is_deleted = FALSE AND is_active = TRUE",
            new { ConnId = cmd.ConnectionId, TenantId = tenantId }, ct)
            ?? throw new NotFoundException("DatabaseConnection", cmd.ConnectionId);

        // 2. Check monthly usage limit
        var now    = DateTime.UtcNow;
        var usage  = await _db.QueryFirstOrDefaultAsync<UsageRecord>(
            @"SELECT total_queries AS TotalQueries FROM query_usage
              WHERE tenant_id = @TenantId AND month = @Month AND year = @Year
              LIMIT 1",
            new { TenantId = tenantId, Month = now.Month, Year = now.Year }, ct);

        var limit = await _db.ExecuteScalarAsync<int>(
            "SELECT monthly_query_limit FROM tenants WHERE id = @Id",
            new { Id = tenantId }, ct);

        if (usage is not null && usage.TotalQueries >= limit)
            throw new InvalidOperationException("Monthly query limit reached.");

        // 3. Get schema (Redis L1 cache)
        var schemaKey = $"schema:{tenantId}:{cmd.ConnectionId}";
        var schema    = await _cache.GetAsync<string>(schemaKey, ct);
        if (string.IsNullOrEmpty(schema))
        {
            schema = await _queryExecution.GetSchemaContextAsync(
                conn.EncryptedConnectionString, (DatabaseProvider)conn.Provider, ct);
            await _cache.SetAsync(schemaKey, schema, SchemaCacheTtl, ct);
        }

        // 4. Generate SQL via Claude (Redis L2 cache keyed on query hash)
        var sqlCacheKey = $"sql:{tenantId}:{cmd.ConnectionId}:{ComputeHash(cmd.NaturalLanguageQuery)}";
        var generatedSql = await _cache.GetAsync<string>(sqlCacheKey, ct);
        int inputTokens  = 0, outputTokens = 0;

        if (string.IsNullOrEmpty(generatedSql))
        {
            var claudeResult = await _claude.GenerateSqlAsync(cmd.NaturalLanguageQuery, schema, ct);
            if (!claudeResult.IsValid)
            {
                await PersistQueryHistoryAsync(
                    queryId, tenantId, userId, cmd.ConnectionId,
                    cmd.NaturalLanguageQuery, claudeResult.Sql ?? string.Empty,
                    QueryStatus.Blocked, claudeResult.ErrorMessage,
                    0, 0, claudeResult.TotalTokens, ct);

                await UpdateUsageAsync(tenantId, userId, claudeResult.TotalTokens, false, ct);

                return new QueryResponse(
                    queryId, claudeResult.Sql ?? string.Empty,
                    [], [], 0, 0, claudeResult.TotalTokens,
                    false, claudeResult.ErrorMessage);
            }

            generatedSql  = claudeResult.Sql;
            inputTokens   = claudeResult.InputTokens;
            outputTokens  = claudeResult.OutputTokens;
            await _cache.SetAsync(sqlCacheKey, generatedSql, SqlCacheTtl, ct);
        }

        // 5. Execute query (Redis L3 cache keyed on SQL hash)
        var resultCacheKey = $"result:{tenantId}:{cmd.ConnectionId}:{ComputeHash(generatedSql)}";
        var cachedResult   = await _cache.GetAsync<CachedQueryResult>(resultCacheKey, ct);

        QueryExecutionResult execResult;
        if (cachedResult is not null)
        {
            execResult = new QueryExecutionResult(
                true, cachedResult.Rows, cachedResult.Columns,
                cachedResult.RowCount, cachedResult.ExecutionTimeMs);
        }
        else
        {
            execResult = await _queryExecution.ExecuteQueryAsync(
                generatedSql, conn.EncryptedConnectionString, (DatabaseProvider)conn.Provider, ct);

            if (execResult.Success)
                await _cache.SetAsync(resultCacheKey,
                    new CachedQueryResult(execResult.Rows, execResult.Columns,
                        execResult.RowCount, execResult.ExecutionTimeMs),
                    ResultCacheTtl, ct);
        }

        // 6. Persist history and update usage
        var status = execResult.Success ? QueryStatus.Success : QueryStatus.Failed;
        await PersistQueryHistoryAsync(
            queryId, tenantId, userId, cmd.ConnectionId,
            cmd.NaturalLanguageQuery, generatedSql, status,
            execResult.ErrorMessage, execResult.RowCount,
            execResult.ExecutionTimeMs, inputTokens + outputTokens, ct);

        await UpdateUsageAsync(tenantId, userId, inputTokens + outputTokens, execResult.Success, ct);

        await _audit.LogAsync(tenantId, userId,
            "QUERY_EXECUTED", "QueryHistory", queryId.ToString(), ct: ct);

        return new QueryResponse(
            queryId, generatedSql,
            execResult.Columns, execResult.Rows,
            execResult.RowCount, execResult.ExecutionTimeMs,
            inputTokens + outputTokens,
            execResult.Success, execResult.ErrorMessage);
    }

    // ── Helpers ─────────────────────────────────────────────────

    private async Task PersistQueryHistoryAsync(
        Guid id, Guid tenantId, Guid userId, Guid connId,
        string nlQuery, string sql, QueryStatus status,
        string? error, int rowCount, long execMs, int tokens, CancellationToken ct)
    {
        await _db.ExecuteAsync(
            @"INSERT INTO query_history
                (id, tenant_id, user_id, connection_id,
                 natural_language_query, generated_sql, status,
                 error_message, row_count, execution_time_ms,
                 tokens_used, executed_at, created_at, updated_at)
              VALUES
                (@Id, @TenantId, @UserId, @ConnId,
                 @NlQuery, @Sql, @Status,
                 @Error, @RowCount, @ExecMs,
                 @Tokens, NOW(), NOW(), NOW())",
            new
            {
                Id = id, TenantId = tenantId, UserId = userId, ConnId = connId,
                NlQuery = nlQuery, Sql = sql, Status = (int)status,
                Error = error, RowCount = rowCount, ExecMs = execMs, Tokens = tokens
            }, ct);
    }

    private async Task UpdateUsageAsync(
        Guid tenantId, Guid userId, int tokens, bool success, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        await _db.ExecuteAsync(
            @"INSERT INTO query_usage
                (id, tenant_id, user_id, month, year,
                 total_queries, total_tokens_used,
                 successful_queries, failed_queries,
                 created_at, updated_at)
              VALUES
                (gen_random_uuid(), @TenantId, @UserId, @Month, @Year,
                 1, @Tokens,
                 @Success::int, @Failed::int,
                 NOW(), NOW())
              ON CONFLICT (tenant_id, user_id, month, year)
              DO UPDATE SET
                total_queries      = query_usage.total_queries + 1,
                total_tokens_used  = query_usage.total_tokens_used + @Tokens,
                successful_queries = query_usage.successful_queries + @Success::int,
                failed_queries     = query_usage.failed_queries + @Failed::int,
                updated_at         = NOW()",
            new
            {
                TenantId = tenantId, UserId = userId,
                Month = now.Month, Year = now.Year,
                Tokens = tokens, Success = success ? 1 : 0, Failed = success ? 0 : 1
            }, ct);
    }

    private static string ComputeHash(string input)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes)[..16];
    }

    // ── Projection records ───────────────────────────────────────
    private class ConnectionRecord
    {
        public Guid Id { get; init; }
        public Guid TenantId { get; init; }
        public int Provider { get; init; }
        public string EncryptedConnectionString { get; init; } = "";
        public string Name { get; init; } = "";
    }

    private class UsageRecord
    {
        public int TotalQueries { get; init; }
    }

    private record CachedQueryResult(
        IEnumerable<Dictionary<string, object?>> Rows,
        IEnumerable<string> Columns,
        int RowCount,
        long ExecutionTimeMs);
}
