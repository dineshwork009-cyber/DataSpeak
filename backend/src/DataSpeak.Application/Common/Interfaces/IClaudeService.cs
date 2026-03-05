namespace DataSpeak.Application.Common.Interfaces;

public interface IClaudeService
{
    Task<ClaudeQueryResult> GenerateSqlAsync(
        string naturalLanguageQuery,
        string schemaContext,
        CancellationToken ct = default);
}

public record ClaudeQueryResult(
    string Sql,
    int InputTokens,
    int OutputTokens,
    bool IsValid,
    string? ErrorMessage = null)
{
    public int TotalTokens => InputTokens + OutputTokens;
}
