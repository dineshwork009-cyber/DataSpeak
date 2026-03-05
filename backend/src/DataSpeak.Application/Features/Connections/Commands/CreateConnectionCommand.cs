using DataSpeak.Application.Common.Interfaces;
using DataSpeak.Domain.Enums;
using FluentValidation;
using MediatR;

namespace DataSpeak.Application.Features.Connections.Commands;

// ──────────────────────────────────────────────────────────────
// Command
// ──────────────────────────────────────────────────────────────
public record CreateConnectionCommand(
    string Name,
    string Description,
    DatabaseProvider Provider,
    string ConnectionString) : IRequest<ConnectionDto>;

public record ConnectionDto(
    Guid Id,
    Guid TenantId,
    string Name,
    string Description,
    string Provider,
    string Status,
    DateTime? LastTestedAt,
    DateTime CreatedAt);

// ──────────────────────────────────────────────────────────────
// Validator
// ──────────────────────────────────────────────────────────────
public class CreateConnectionCommandValidator : AbstractValidator<CreateConnectionCommand>
{
    public CreateConnectionCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
        RuleFor(x => x.Provider).IsInEnum();
        RuleFor(x => x.ConnectionString).NotEmpty().MaximumLength(2000);
    }
}

// ──────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────
public class CreateConnectionCommandHandler : IRequestHandler<CreateConnectionCommand, ConnectionDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IEncryptionService _encryption;
    private readonly IQueryExecutionService _queryExecution;
    private readonly ICacheService _cache;
    private readonly IAuditService _audit;

    public CreateConnectionCommandHandler(
        IApplicationDbContext db,
        ICurrentUserService currentUser,
        IEncryptionService encryption,
        IQueryExecutionService queryExecution,
        ICacheService cache,
        IAuditService audit)
    {
        _db             = db;
        _currentUser    = currentUser;
        _encryption     = encryption;
        _queryExecution = queryExecution;
        _cache          = cache;
        _audit          = audit;
    }

    public async Task<ConnectionDto> Handle(CreateConnectionCommand cmd, CancellationToken ct)
    {
        var tenantId = _currentUser.TenantId;

        // Verify tenant connection limit
        var count = await _db.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM database_connections WHERE tenant_id = @TenantId AND is_deleted = FALSE",
            new { TenantId = tenantId }, ct);

        var tenant = await _db.QuerySingleAsync<TenantLimitRecord>(
            "SELECT max_connections AS MaxConnections FROM tenants WHERE id = @Id",
            new { Id = tenantId }, ct);

        if (count >= tenant.MaxConnections)
            throw new InvalidOperationException(
                $"Connection limit of {tenant.MaxConnections} reached for your plan.");

        // Encrypt the connection string before storage — never store or log plain text
        var encrypted = _encryption.Encrypt(cmd.ConnectionString);

        var id        = Guid.NewGuid();
        var now       = DateTime.UtcNow;
        var statusVal = (int)ConnectionStatus.Active;

        await _db.ExecuteAsync(
            @"INSERT INTO database_connections
                (id, tenant_id, created_by_user_id, name, description, provider,
                 encrypted_connection_string, status, is_active, created_at, updated_at)
              VALUES
                (@Id, @TenantId, @UserId, @Name, @Description, @Provider,
                 @Encrypted, @Status, TRUE, @CreatedAt, @UpdatedAt)",
            new
            {
                Id          = id,
                TenantId    = tenantId,
                UserId      = _currentUser.UserId,
                cmd.Name,
                Description = cmd.Description ?? string.Empty,
                Provider    = (int)cmd.Provider,
                Encrypted   = encrypted,
                Status      = statusVal,
                CreatedAt   = now,
                UpdatedAt   = now
            }, ct);

        // Invalidate schema cache for tenant
        await _cache.RemoveByPatternAsync($"schema:{tenantId}:*", ct);

        await _audit.LogAsync(tenantId, _currentUser.UserId,
            "CONNECTION_CREATED", "DatabaseConnection", id.ToString(), ct: ct);

        return new ConnectionDto(
            id, tenantId, cmd.Name, cmd.Description ?? string.Empty,
            cmd.Provider.ToString(), ConnectionStatus.Active.ToString(),
            null, now);
    }

    private class TenantLimitRecord
    {
        public int MaxConnections { get; init; }
    }
}
