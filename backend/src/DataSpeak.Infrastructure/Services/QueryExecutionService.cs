using System.Data;
using System.Data.Common;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using Dapper;
using DataSpeak.Application.Common.Exceptions;
using DataSpeak.Application.Common.Interfaces;
using DataSpeak.Domain.Enums;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using MySqlConnector;
using Npgsql;

namespace DataSpeak.Infrastructure.Services;

/// <summary>
/// Executes SELECT queries against external user databases.
/// Safety checks run BEFORE any query reaches the database.
/// Connection strings are decrypted here and never leave this class.
/// </summary>
public class QueryExecutionService : IQueryExecutionService
{
    private readonly IEncryptionService _encryption;
    private readonly ILogger<QueryExecutionService> _logger;

    private static readonly HashSet<string> ForbiddenTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        "INSERT","UPDATE","DELETE","DROP","CREATE","ALTER","TRUNCATE",
        "EXEC","EXECUTE","GRANT","REVOKE","MERGE","CALL",
        "PROCEDURE","FUNCTION","TRIGGER","DECLARE",
        "BACKUP","RESTORE","BULK","KILL","SHUTDOWN","DBCC",
        "OPENROWSET","OPENQUERY","XPCMDSHELL","SP_EXECUTESQL"
    };

    public QueryExecutionService(IEncryptionService encryption, ILogger<QueryExecutionService> logger)
    {
        _encryption = encryption;
        _logger     = logger;
    }

    // ── Execute a validated SELECT query ───────────────────────────────
    public async Task<QueryExecutionResult> ExecuteQueryAsync(
        string sql,
        string encryptedConnectionString,
        DatabaseProvider provider,
        CancellationToken ct = default)
    {
        ValidateSql(sql);

        var connStr = _encryption.Decrypt(encryptedConnectionString);
        await using var connection = CreateConnection(connStr, provider);

        var sw = Stopwatch.StartNew();
        try
        {
            var rows = (await connection.QueryAsync(
                new CommandDefinition(sql, commandTimeout: 30, cancellationToken: ct)))
                .ToList();

            sw.Stop();

            var dictRows = rows
                .Select(row => ((IDictionary<string, object>)row)
                    .ToDictionary(k => k.Key, v => (object?)v.Value))
                .ToList();

            var columns = dictRows.FirstOrDefault()?.Keys
                          ?? Enumerable.Empty<string>();

            _logger.LogInformation(
                "Query executed. Provider={Provider} Rows={Count} Ms={Ms}",
                provider, dictRows.Count, sw.ElapsedMilliseconds);

            return new QueryExecutionResult(true, dictRows, columns, dictRows.Count, sw.ElapsedMilliseconds);
        }
        catch (Exception ex) when (ex is not QuerySafetyException)
        {
            sw.Stop();
            _logger.LogWarning(ex, "Query execution failed. Provider={Provider}", provider);
            return new QueryExecutionResult(false, [], [], 0, sw.ElapsedMilliseconds, ex.Message);
        }
    }

    // ── Extract schema context for Claude prompt ────────────────────────
    public async Task<string> GetSchemaContextAsync(
        string encryptedConnectionString,
        DatabaseProvider provider,
        CancellationToken ct = default)
    {
        var connStr = _encryption.Decrypt(encryptedConnectionString);
        await using var connection = CreateConnection(connStr, provider);

        try
        {
            await connection.OpenAsync(ct);
            var tables = await GetTablesAsync(connection, provider, ct);
            return BuildSchemaContext(tables);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not extract schema. Provider={Provider}", provider);
            return "Schema unavailable.";
        }
    }

    // ── Test connection reachability ────────────────────────────────────
    public async Task<bool> TestConnectionAsync(
        string encryptedConnectionString,
        DatabaseProvider provider,
        CancellationToken ct = default)
    {
        var connStr = _encryption.Decrypt(encryptedConnectionString);
        try
        {
            await using var connection = CreateConnection(connStr, provider);
            await connection.OpenAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Connection test failed. Provider={Provider}", provider);
            return false;
        }
    }

    // ── SQL safety validation ──────────────────────────────────────────
    private static void ValidateSql(string sql)
    {
        if (string.IsNullOrWhiteSpace(sql))
            throw new QuerySafetyException("SQL query is empty.");

        var trimmed = sql.TrimStart();
        if (!trimmed.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase) &&
            !trimmed.StartsWith("WITH", StringComparison.OrdinalIgnoreCase))
            throw new QuerySafetyException("Only SELECT queries are permitted.");

        if (sql.Contains(';'))
            throw new QuerySafetyException("Semicolons are not allowed.");

        if (Regex.IsMatch(sql, @"--.*$", RegexOptions.Multiline))
            throw new QuerySafetyException("SQL line comments are not allowed.");

        if (sql.Contains("/*") || sql.Contains("*/"))
            throw new QuerySafetyException("SQL block comments are not allowed.");

        // Tokenise and scan for forbidden keywords
        var tokens = Regex.Split(sql, @"[\s,;()\[\]""']+")
            .Where(t => !string.IsNullOrWhiteSpace(t));

        foreach (var token in tokens)
            if (ForbiddenTokens.Contains(token))
                throw new QuerySafetyException($"Forbidden keyword: {token}");
    }

    // ── Provider factory ────────────────────────────────────────────────
    private static DbConnection CreateConnection(string connStr, DatabaseProvider provider)
        => provider switch
        {
            DatabaseProvider.PostgreSQL => new NpgsqlConnection(connStr),
            DatabaseProvider.SqlServer  => new SqlConnection(connStr),
            DatabaseProvider.MySQL      => new MySqlConnection(connStr),
            _                           => throw new NotSupportedException($"Provider {provider} is not supported.")
        };

    // ── Schema introspection ────────────────────────────────────────────
    private static async Task<IEnumerable<TableSchema>> GetTablesAsync(
        IDbConnection connection, DatabaseProvider provider, CancellationToken ct)
    {
        var sql = provider switch
        {
            DatabaseProvider.PostgreSQL => @"
                SELECT c.table_schema || '.' || c.table_name AS table_name,
                       c.column_name, c.data_type, c.is_nullable
                FROM information_schema.columns c
                INNER JOIN information_schema.tables t
                  ON t.table_name = c.table_name AND t.table_schema = c.table_schema
                WHERE t.table_type = 'BASE TABLE'
                  AND c.table_schema NOT IN ('pg_catalog','information_schema')
                ORDER BY CASE WHEN c.table_schema = 'public' THEN 0 ELSE 1 END,
                         c.table_schema, c.table_name, c.ordinal_position
                LIMIT 500",

            DatabaseProvider.SqlServer => @"
                SELECT c.TABLE_NAME as table_name, c.COLUMN_NAME as column_name,
                       c.DATA_TYPE as data_type, c.IS_NULLABLE as is_nullable
                FROM INFORMATION_SCHEMA.COLUMNS c
                INNER JOIN INFORMATION_SCHEMA.TABLES t
                  ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
                WHERE t.TABLE_TYPE = 'BASE TABLE'
                ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION",

            DatabaseProvider.MySQL => @"
                SELECT c.TABLE_NAME as table_name, c.COLUMN_NAME as column_name,
                       c.DATA_TYPE as data_type, c.IS_NULLABLE as is_nullable
                FROM information_schema.COLUMNS c
                INNER JOIN information_schema.TABLES t
                  ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
                WHERE t.TABLE_TYPE = 'BASE TABLE'
                  AND c.TABLE_SCHEMA = DATABASE()
                ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION",

            _ => throw new NotSupportedException()
        };

        return await connection.QueryAsync<TableSchema>(
            new CommandDefinition(sql, commandTimeout: 15, cancellationToken: ct));
    }

    private static string BuildSchemaContext(IEnumerable<TableSchema> rows)
    {
        var sb      = new StringBuilder();
        // Split schema.table and quote each part for case-sensitive PostgreSQL identifiers
        var grouped = rows.GroupBy(r => r.TableName);

        foreach (var table in grouped)
        {
            // Format as "schema"."table" with double quotes so the model quotes them too
            var parts     = table.Key.Split('.', 2);
            var quotedRef = parts.Length == 2
                ? $"\"{parts[0]}\".\"{parts[1]}\""
                : $"\"{table.Key}\"";

            sb.AppendLine($"Table: {quotedRef}");
            sb.AppendLine("Columns:");
            foreach (var col in table)
                sb.AppendLine($"  - \"{col.ColumnName}\" ({col.DataType}) {(col.IsNullable == "YES" ? "NULL" : "NOT NULL")}");
            sb.AppendLine();
        }

        return sb.ToString();
    }

    private record TableSchema(string TableName, string ColumnName, string DataType, string IsNullable);
}
