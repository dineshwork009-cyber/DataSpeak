namespace DataSpeak.Application.Common.Interfaces;

public interface IAuditService
{
    Task LogAsync(
        Guid tenantId,
        Guid? userId,
        string action,
        string entityType,
        string? entityId = null,
        object? oldValues = null,
        object? newValues = null,
        CancellationToken ct = default);
}
