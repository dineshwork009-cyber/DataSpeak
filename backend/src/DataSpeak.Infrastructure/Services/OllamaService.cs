using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using DataSpeak.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DataSpeak.Infrastructure.Services;

/// <summary>
/// Integrates with a local Ollama instance to generate SQL from natural language.
/// Drop-in replacement for ClaudeService — implements the same IClaudeService interface.
/// </summary>
public class OllamaService : IClaudeService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<OllamaService> _logger;
    private readonly string _model;

    // Pre-check: catch obvious write/admin intent BEFORE calling the model
    private static readonly string[] WriteIntentKeywords =
    [
        "insert ", "add new ", "create new ", "add a ", "create a ",
        "update ", "edit ", "modify ", "change ", "alter ",
        "delete ", "remove ", "drop ", "truncate ",
        "grant ", "revoke "
    ];

    private static readonly string[] ForbiddenKeywords =
    [
        "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE",
        "EXEC", "EXECUTE", "GRANT", "REVOKE", "MERGE", "CALL",
        "PROCEDURE", "FUNCTION", "TRIGGER", "DECLARE", "BACKUP",
        "RESTORE", "BULK", "KILL", "SHUTDOWN"
    ];

    public OllamaService(HttpClient httpClient, IConfiguration config, ILogger<OllamaService> logger)
    {
        _httpClient = httpClient;
        _logger     = logger;
        _model      = config["Ollama:Model"] ?? "llama3.2:1b";

        var baseUrl = config["Ollama:BaseUrl"] ?? "http://localhost:11434";
        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.Timeout     = TimeSpan.FromSeconds(300);
    }

    public async Task<ClaudeQueryResult> GenerateSqlAsync(
        string naturalLanguageQuery,
        string schemaContext,
        CancellationToken ct = default)
    {
        // ── Pre-check: write/admin intent ──────────────────────────────
        var lower = naturalLanguageQuery.ToLowerInvariant();
        foreach (var kw in WriteIntentKeywords)
        {
            if (lower.Contains(kw))
                return new ClaudeQueryResult(string.Empty, 0, 0, false,
                    "DataSpeak is read-only. It can only SELECT and display data — " +
                    "it cannot add, edit, delete, or modify records.");
        }

        // ── Build prompt ───────────────────────────────────────────────
        const int maxSchemaChars = 5000;
        var schema = schemaContext.Length > maxSchemaChars
            ? schemaContext[..maxSchemaChars] + "\n... (schema truncated)"
            : schemaContext;

        // Extract table names as plain unquoted references for the list
        var tableList = ExtractTableNames(schema);

        var prompt = new StringBuilder();

        // Instruction block
        prompt.AppendLine("You are a PostgreSQL expert. Write a SQL SELECT query.");
        prompt.AppendLine("Output ONLY the SQL. No explanation. No markdown. No backticks. No semicolons.");
        prompt.AppendLine("The SQL must start with the word SELECT.");
        prompt.AppendLine("Always wrap table and column names in double-quotes exactly as shown below.");
        prompt.AppendLine("Always end with LIMIT 100.");
        prompt.AppendLine();

        // Table list (plain names so the model doesn't get confused by nested quotes)
        if (tableList.Count > 0)
        {
            prompt.AppendLine("Available tables:");
            foreach (var t in tableList)
                prompt.AppendLine($"  - {t}");
            prompt.AppendLine();
        }

        // Concrete few-shot example using the first real table name
        if (tableList.Count > 0)
        {
            var exampleTable = tableList[0]; // e.g. "endeavour_test_area"."EPM_Employees"
            prompt.AppendLine("Example:");
            prompt.AppendLine("Question: show all records");
            prompt.AppendLine($"SQL: SELECT * FROM {exampleTable} LIMIT 100");
            prompt.AppendLine();
        }

        // Full schema
        prompt.AppendLine("Schema:");
        prompt.AppendLine(schema);
        prompt.AppendLine();

        // The actual question
        prompt.AppendLine($"Question: {naturalLanguageQuery.Trim()}");
        prompt.AppendLine("SQL:");

        var requestBody = new
        {
            model  = _model,
            prompt = prompt.ToString(),
            stream = false,
            options = new { temperature = 0.0, num_predict = 300, top_p = 0.9, repeat_penalty = 1.1 }
        };

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.PostAsJsonAsync("/api/generate", requestBody, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ollama request failed");
            return new ClaudeQueryResult(string.Empty, 0, 0, false,
                "AI service unavailable. Is Ollama running? Run: ollama serve");
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("Ollama error {Status}: {Body}", response.StatusCode, body);
            return new ClaudeQueryResult(string.Empty, 0, 0, false, "AI service returned an error.");
        }

        var result = await response.Content.ReadFromJsonAsync<OllamaResponse>(
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct);

        if (result is null || string.IsNullOrWhiteSpace(result.Response))
            return new ClaudeQueryResult(string.Empty, 0, 0, false, "Empty response from AI service.");

        var raw = result.Response.Trim();
        _logger.LogDebug("Ollama raw output ({Len} chars): [{Raw}]", raw.Length, raw[..Math.Min(raw.Length, 400)]);

        // ── Handle sentinel responses ──────────────────────────────────
        if (raw.Contains("READONLY_ERROR", StringComparison.OrdinalIgnoreCase) ||
            raw.Contains("cannot modify", StringComparison.OrdinalIgnoreCase) ||
            raw.Contains("read-only", StringComparison.OrdinalIgnoreCase))
            return new ClaudeQueryResult(string.Empty, 0, 0, false,
                "DataSpeak is read-only. It can only SELECT and display data.");

        if (raw.StartsWith("ERROR:", StringComparison.OrdinalIgnoreCase))
            return new ClaudeQueryResult(raw, 0, 0, false, raw);

        var sql = CleanSql(raw);

        if (string.IsNullOrWhiteSpace(sql))
            return new ClaudeQueryResult(string.Empty, 0, 0, false,
                "AI returned an empty query. Please rephrase your question.");

        _logger.LogInformation("Ollama SQL (model={Model}): [{Sql}]", _model, sql[..Math.Min(sql.Length, 300)]);

        var validationError = ValidateSqlOutput(sql);
        if (validationError is not null)
        {
            _logger.LogWarning("SQL blocked — Reason: {Reason} — SQL: [{Sql}]", validationError, sql);
            return new ClaudeQueryResult(sql, 0, 0, false, validationError);
        }

        var inputTokens  = result.PromptEvalCount > 0 ? result.PromptEvalCount : prompt.Length / 4;
        var outputTokens = result.EvalCount        > 0 ? result.EvalCount       : sql.Length   / 4;

        return new ClaudeQueryResult(sql, inputTokens, outputTokens, true);
    }

    // ── Extract table names (plain unquoted for the list, quoted for the example) ──
    private static List<string> ExtractTableNames(string schema)
    {
        var tables = new List<string>();
        foreach (var line in schema.Split('\n'))
        {
            var trimmed = line.Trim();
            if (trimmed.StartsWith("Table:", StringComparison.OrdinalIgnoreCase))
            {
                var name = trimmed["Table:".Length..].Trim();
                if (!string.IsNullOrEmpty(name))
                    tables.Add(name); // keeps double-quoted form e.g. "schema"."Table"
            }
        }
        return tables;
    }

    // ── Clean and normalise model output ─────────────────────────────
    private static string CleanSql(string raw)
    {
        // 1. Strip markdown fences
        if (raw.StartsWith("```sql", StringComparison.OrdinalIgnoreCase))
            raw = raw["```sql".Length..].TrimStart();
        else if (raw.StartsWith("```"))
            raw = raw[3..].TrimStart();

        if (raw.EndsWith("```"))
            raw = raw[..^3].TrimEnd();

        // 2. Fix the most common small-model mistake:
        //    "SELECT * FROM schema"."Table"  →  SELECT * FROM "schema"."Table"
        //    The model wraps SELECT ... schema inside quotes together.
        //
        //    Pattern: starts with " and contains SELECT inside first quoted segment
        if (raw.StartsWith("\"") && raw.ToUpperInvariant().TrimStart('"').StartsWith("SELECT"))
        {
            // e.g.  "SELECT * FROM endeavour_test_area"."EPM_Employees" LIMIT 100
            // Fix:   SELECT * FROM "endeavour_test_area"."EPM_Employees" LIMIT 100
            var selectFix = Regex.Match(raw,
                @"""SELECT\s+(.+?)""\.""([^""]+)""(.*)",
                RegexOptions.IgnoreCase | RegexOptions.Singleline);

            if (selectFix.Success)
            {
                // Group1 = body after SELECT (e.g. "* FROM schema")
                // Group2 = table name
                // Group3 = rest (LIMIT etc.)
                var body  = selectFix.Groups[1].Value.Trim(); // * FROM endeavour_test_area
                var table = selectFix.Groups[2].Value.Trim(); // EPM_Employees
                var rest  = selectFix.Groups[3].Value.Trim(); // LIMIT 100 or empty

                // body ends with the schema name — extract it
                var fromMatch = Regex.Match(body,
                    @"^(.*\s+FROM\s+)(\S+)$",
                    RegexOptions.IgnoreCase | RegexOptions.Singleline);

                if (fromMatch.Success)
                {
                    var selectPart = fromMatch.Groups[1].Value; // SELECT * FROM
                    var schema     = fromMatch.Groups[2].Value; // endeavour_test_area
                    raw = $"SELECT {selectPart.Replace("SELECT ", "", StringComparison.OrdinalIgnoreCase).Trim()} " +
                          $"\"{schema}\".\"{table}\"" +
                          (string.IsNullOrWhiteSpace(rest) ? " LIMIT 100" : " " + rest);
                }
                else
                {
                    // Simpler fallback: just remove the wrapping quotes from the first segment
                    raw = raw.TrimStart('"');
                    var endQuote = raw.IndexOf('"');
                    if (endQuote > 0)
                        raw = raw[..endQuote] + "." + raw[(endQuote + 2)..]; // remove "."
                }
            }
            else
            {
                // Just strip the leading quote and hope for the best
                raw = raw.TrimStart('"');
            }
        }

        // 3. Take only the first SQL statement (stop at blank lines or explanation text)
        var lines    = raw.Split('\n');
        var sqlLines = new List<string>();
        foreach (var line in lines)
        {
            if (sqlLines.Count > 0 && string.IsNullOrWhiteSpace(line))
                break;
            sqlLines.Add(line);
        }
        raw = string.Join('\n', sqlLines).Trim();

        // 4. Strip trailing semicolons
        raw = raw.TrimEnd().TrimEnd(';').TrimEnd();

        return raw.Trim();
    }

    // ── Output safety validation ──────────────────────────────────────
    private static string? ValidateSqlOutput(string sql)
    {
        if (string.IsNullOrWhiteSpace(sql))
            return "Empty SQL returned.";

        var upper = sql.ToUpperInvariant().TrimStart();

        if (!upper.StartsWith("SELECT") && !upper.StartsWith("WITH"))
            return "Only SELECT queries are permitted.";

        if (sql.Contains(';'))
            return "Semicolons are not permitted in generated SQL.";

        if (sql.Contains("--") || sql.Contains("/*"))
            return "SQL comments are not permitted.";

        // Token-based check — avoids false positives like CreatedAt containing CREATE
        var tokens = new HashSet<string>(
            Regex.Split(upper, @"[\s,;()\[\]""'.]+")
                 .Where(t => !string.IsNullOrWhiteSpace(t)),
            StringComparer.OrdinalIgnoreCase);

        foreach (var kw in ForbiddenKeywords)
            if (tokens.Contains(kw.Trim()))
                return $"Forbidden keyword detected: {kw}";

        return null;
    }

    // ── Ollama response shape ─────────────────────────────────────────
    private sealed class OllamaResponse
    {
        [JsonPropertyName("response")]
        public string Response { get; init; } = "";

        [JsonPropertyName("prompt_eval_count")]
        public int PromptEvalCount { get; init; }

        [JsonPropertyName("eval_count")]
        public int EvalCount { get; init; }
    }
}
