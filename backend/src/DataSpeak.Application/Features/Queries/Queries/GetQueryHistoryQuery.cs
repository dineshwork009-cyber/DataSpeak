using DataSpeak.Application.Common.Interfaces;
using DataSpeak.Application.Common.Models;
using MediatR;

namespace DataSpeak.Application.Features.Queries.Queries;

public record GetQueryHistoryQuery(Guid? ConnectionId = null, int PageNumber = 1, int PageSize = 20)
    : IRequest<PaginatedList<QueryHistoryDto>>;

public record QueryHistoryDto(
    Guid Id,
    string NaturalLanguageQuery,
    string GeneratedSql,
    string Status,
    string? ErrorMessage,
    int RowCount,
    long ExecutionTimeMs,
    int TokensUsed,
    DateTime ExecutedAt,
    string ConnectionName);

public class GetQueryHistoryQueryHandler
    : IRequestHandler<GetQueryHistoryQuery, PaginatedList<QueryHistoryDto>>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public GetQueryHistoryQueryHandler(IApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db          = db;
        _currentUser = currentUser;
    }

    public async Task<PaginatedList<QueryHistoryDto>> Handle(
        GetQueryHistoryQuery q, CancellationToken ct)
    {
        var tenantId  = _currentUser.TenantId;
        var connFilter = q.ConnectionId.HasValue
            ? "AND qh.connection_id = @ConnId"
            : string.Empty;

        var countSql = $@"
            SELECT COUNT(*) FROM query_history qh
            WHERE qh.tenant_id = @TenantId AND qh.is_deleted = FALSE {connFilter}";

        var dataSql = $@"
            SELECT qh.id,
                   qh.natural_language_query AS NaturalLanguageQuery,
                   qh.generated_sql          AS GeneratedSql,
                   qh.status,
                   qh.error_message          AS ErrorMessage,
                   qh.row_count              AS RowCount,
                   qh.execution_time_ms      AS ExecutionTimeMs,
                   qh.tokens_used            AS TokensUsed,
                   qh.executed_at            AS ExecutedAt,
                   dc.name                   AS ConnectionName
            FROM query_history qh
            INNER JOIN database_connections dc ON dc.id = qh.connection_id
            WHERE qh.tenant_id = @TenantId AND qh.is_deleted = FALSE {connFilter}
            ORDER BY qh.executed_at DESC
            LIMIT @Take OFFSET @Skip";

        var param = new
        {
            TenantId = tenantId,
            ConnId   = q.ConnectionId,
            Take     = q.PageSize,
            Skip     = (q.PageNumber - 1) * q.PageSize
        };

        var total = await _db.ExecuteScalarAsync<int>(countSql, param, ct);
        var rows  = await _db.QueryAsync<QueryHistoryProjection>(dataSql, param, ct);

        var items = rows.Select(r => new QueryHistoryDto(
            r.Id, r.NaturalLanguageQuery, r.GeneratedSql,
            ((DataSpeak.Domain.Enums.QueryStatus)r.Status).ToString(),
            r.ErrorMessage, r.RowCount, r.ExecutionTimeMs,
            r.TokensUsed, r.ExecutedAt, r.ConnectionName)).ToList();

        return new PaginatedList<QueryHistoryDto>(items, total, q.PageNumber, q.PageSize);
    }

    private class QueryHistoryProjection
    {
        public Guid Id { get; init; }
        public string NaturalLanguageQuery { get; init; } = "";
        public string GeneratedSql { get; init; } = "";
        public int Status { get; init; }
        public string? ErrorMessage { get; init; }
        public int RowCount { get; init; }
        public long ExecutionTimeMs { get; init; }
        public int TokensUsed { get; init; }
        public DateTime ExecutedAt { get; init; }
        public string ConnectionName { get; init; } = "";
    }
}
