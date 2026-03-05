using DataSpeak.Application.Common.Exceptions;
using DataSpeak.Application.Common.Interfaces;
using DataSpeak.Domain.Enums;
using MediatR;

namespace DataSpeak.Application.Features.Connections.Commands;

public record TestConnectionCommand(Guid ConnectionId) : IRequest<TestConnectionResult>;
public record TestConnectionResult(bool Success, string Message);

public class TestConnectionCommandHandler : IRequestHandler<TestConnectionCommand, TestConnectionResult>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IQueryExecutionService _queryExecution;

    public TestConnectionCommandHandler(
        IApplicationDbContext db,
        ICurrentUserService currentUser,
        IQueryExecutionService queryExecution)
    {
        _db             = db;
        _currentUser    = currentUser;
        _queryExecution = queryExecution;
    }

    public async Task<TestConnectionResult> Handle(TestConnectionCommand cmd, CancellationToken ct)
    {
        var conn = await _db.QueryFirstOrDefaultAsync<ConnectionRecord>(
            @"SELECT id,
                     tenant_id                   AS TenantId,
                     provider,
                     encrypted_connection_string AS EncryptedConnectionString
              FROM database_connections
              WHERE id = @Id AND tenant_id = @TenantId AND is_deleted = FALSE",
            new { Id = cmd.ConnectionId, TenantId = _currentUser.TenantId }, ct)
            ?? throw new NotFoundException("DatabaseConnection", cmd.ConnectionId);

        var ok = await _queryExecution.TestConnectionAsync(
            conn.EncryptedConnectionString, (DatabaseProvider)conn.Provider, ct);

        var newStatus = ok ? (int)ConnectionStatus.Active : (int)ConnectionStatus.Error;
        await _db.ExecuteAsync(
            "UPDATE database_connections SET status = @Status, last_tested_at = NOW(), updated_at = NOW() WHERE id = @Id",
            new { Status = newStatus, Id = cmd.ConnectionId }, ct);

        return new TestConnectionResult(
            ok,
            ok ? "Connection successful." : "Could not connect. Please verify your connection string.");
    }

    private class ConnectionRecord
    {
        public Guid Id { get; init; }
        public Guid TenantId { get; init; }
        public int Provider { get; init; }
        public string EncryptedConnectionString { get; init; } = "";
    }
}
