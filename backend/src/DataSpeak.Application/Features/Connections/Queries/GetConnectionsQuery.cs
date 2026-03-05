using DataSpeak.Application.Common.Interfaces;
using DataSpeak.Application.Features.Connections.Commands;
using MediatR;

namespace DataSpeak.Application.Features.Connections.Queries;

public record GetConnectionsQuery : IRequest<IEnumerable<ConnectionDto>>;

public class GetConnectionsQueryHandler : IRequestHandler<GetConnectionsQuery, IEnumerable<ConnectionDto>>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public GetConnectionsQueryHandler(IApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db          = db;
        _currentUser = currentUser;
    }

    public async Task<IEnumerable<ConnectionDto>> Handle(GetConnectionsQuery _, CancellationToken ct)
    {
        var rows = await _db.QueryAsync<ConnectionProjection>(
            @"SELECT id,
                     tenant_id      AS TenantId,
                     name, description, provider, status,
                     last_tested_at AS LastTestedAt,
                     created_at     AS CreatedAt
              FROM database_connections
              WHERE tenant_id = @TenantId
                AND is_deleted = FALSE
              ORDER BY created_at DESC",
            new { TenantId = _currentUser.TenantId }, ct);

        return rows.Select(r => new ConnectionDto(
            r.Id, r.TenantId, r.Name, r.Description,
            ((DataSpeak.Domain.Enums.DatabaseProvider)r.Provider).ToString(),
            ((DataSpeak.Domain.Enums.ConnectionStatus)r.Status).ToString(),
            r.LastTestedAt, r.CreatedAt));
    }

    private class ConnectionProjection
    {
        public Guid Id { get; init; }
        public Guid TenantId { get; init; }
        public string Name { get; init; } = "";
        public string Description { get; init; } = "";
        public int Provider { get; init; }
        public int Status { get; init; }
        public DateTime? LastTestedAt { get; init; }
        public DateTime CreatedAt { get; init; }
    }
}
