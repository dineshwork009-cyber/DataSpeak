using DataSpeak.Domain.Enums;

namespace DataSpeak.Application.Common.Interfaces;

public interface IQueryExecutionService
{
    /// <summary>Executes a validated SELECT query against an external database.</summary>
    Task<QueryExecutionResult> ExecuteQueryAsync(
        string sql,
        string encryptedConnectionString,
        DatabaseProvider provider,
        CancellationToken ct = default);

    /// <summary>Extracts schema context (tables + columns) for Claude prompt injection.</summary>
    Task<string> GetSchemaContextAsync(
        string encryptedConnectionString,
        DatabaseProvider provider,
        CancellationToken ct = default);

    /// <summary>Verifies a connection string is reachable.</summary>
    Task<bool> TestConnectionAsync(
        string encryptedConnectionString,
        DatabaseProvider provider,
        CancellationToken ct = default);
}

public record QueryExecutionResult(
    bool Success,
    IEnumerable<Dictionary<string, object?>> Rows,
    IEnumerable<string> Columns,
    int RowCount,
    long ExecutionTimeMs,
    string? ErrorMessage = null);
