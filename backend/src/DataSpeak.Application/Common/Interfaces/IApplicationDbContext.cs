namespace DataSpeak.Application.Common.Interfaces;

/// <summary>
/// Abstraction over Dapper-based PostgreSQL access for the app database.
/// Infrastructure implements this; Application depends only on this contract.
/// </summary>
public interface IApplicationDbContext
{
    Task<IEnumerable<T>> QueryAsync<T>(
        string sql,
        object? param = null,
        CancellationToken ct = default);

    Task<T?> QueryFirstOrDefaultAsync<T>(
        string sql,
        object? param = null,
        CancellationToken ct = default);

    Task<T> QuerySingleAsync<T>(
        string sql,
        object? param = null,
        CancellationToken ct = default);

    Task<int> ExecuteAsync(
        string sql,
        object? param = null,
        CancellationToken ct = default);

    Task<T> ExecuteScalarAsync<T>(
        string sql,
        object? param = null,
        CancellationToken ct = default);
}
