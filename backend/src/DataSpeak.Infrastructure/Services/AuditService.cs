using System.Text.Json;
using DataSpeak.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace DataSpeak.Infrastructure.Services;

public class AuditService : IAuditService
{
    private readonly IApplicationDbContext _db;
    private readonly ILogger<AuditService> _logger;

    public AuditService(IApplicationDbContext db, ILogger<AuditService> logger)
    {
        _db     = db;
        _logger = logger;
    }

    public async Task LogAsync(
        Guid tenantId,
        Guid? userId,
        string action,
        string entityType,
        string? entityId      = null,
        object? oldValues     = null,
        object? newValues     = null,
        CancellationToken ct  = default)
    {
        try
        {
            await _db.ExecuteAsync(
                @"INSERT INTO audit_logs
                    (id, tenant_id, user_id, action, entity_type, entity_id,
                     old_values, new_values, timestamp, created_at, updated_at)
                  VALUES
                    (gen_random_uuid(), @TenantId, @UserId, @Action, @EntityType, @EntityId,
                     @OldValues::jsonb, @NewValues::jsonb, NOW(), NOW(), NOW())",
                new
                {
                    TenantId   = tenantId,
                    UserId     = userId,
                    Action     = action,
                    EntityType = entityType,
                    EntityId   = entityId,
                    OldValues  = oldValues is null ? null : JsonSerializer.Serialize(oldValues),
                    NewValues  = newValues is null ? null : JsonSerializer.Serialize(newValues)
                }, ct);
        }
        catch (Exception ex)
        {
            // Never let audit failures break the main flow
            _logger.LogError(ex, "Audit log failed. Action={Action} EntityType={EntityType}", action, entityType);
        }
    }
}
