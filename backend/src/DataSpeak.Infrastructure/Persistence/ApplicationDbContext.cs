using Dapper;
using DataSpeak.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace DataSpeak.Infrastructure.Persistence;

/// <summary>
/// Dapper-based database context for the application (PostgreSQL).
/// Uses Npgsql; opens a fresh connection per call for simplicity at this scale.
/// For high-throughput scenarios, consider a connection pool wrapper.
/// </summary>
public class ApplicationDbContext : IApplicationDbContext
{
    private readonly string _connectionString;

    static ApplicationDbContext()
    {
        // Map snake_case columns (tenant_id) → PascalCase properties (TenantId) globally
        DefaultTypeMap.MatchNamesWithUnderscores = true;
    }

    public ApplicationDbContext(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection is required.");
    }

    private NpgsqlConnection CreateConnection() => new(_connectionString);

    public async Task<IEnumerable<T>> QueryAsync<T>(
        string sql, object? param = null, CancellationToken ct = default)
    {
        await using var conn = CreateConnection();
        return await conn.QueryAsync<T>(new CommandDefinition(sql, param, cancellationToken: ct));
    }

    public async Task<T?> QueryFirstOrDefaultAsync<T>(
        string sql, object? param = null, CancellationToken ct = default)
    {
        await using var conn = CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<T>(
            new CommandDefinition(sql, param, cancellationToken: ct));
    }

    public async Task<T> QuerySingleAsync<T>(
        string sql, object? param = null, CancellationToken ct = default)
    {
        await using var conn = CreateConnection();
        return await conn.QuerySingleAsync<T>(
            new CommandDefinition(sql, param, cancellationToken: ct));
    }

    public async Task<int> ExecuteAsync(
        string sql, object? param = null, CancellationToken ct = default)
    {
        await using var conn = CreateConnection();
        return await conn.ExecuteAsync(
            new CommandDefinition(sql, param, cancellationToken: ct));
    }

    public async Task<T> ExecuteScalarAsync<T>(
        string sql, object? param = null, CancellationToken ct = default)
    {
        await using var conn = CreateConnection();
        return (await conn.ExecuteScalarAsync<T>(
            new CommandDefinition(sql, param, cancellationToken: ct)))!;
    }
}
