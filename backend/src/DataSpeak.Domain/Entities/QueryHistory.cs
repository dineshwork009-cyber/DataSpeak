using DataSpeak.Domain.Common;
using DataSpeak.Domain.Enums;

namespace DataSpeak.Domain.Entities;

public class QueryHistory : TenantEntity
{
    public Guid UserId { get; set; }
    public Guid ConnectionId { get; set; }
    public string NaturalLanguageQuery { get; set; } = string.Empty;
    public string GeneratedSql { get; set; } = string.Empty;
    public QueryStatus Status { get; set; }
    public string? ErrorMessage { get; set; }
    public int RowCount { get; set; }
    public long ExecutionTimeMs { get; set; }
    public int TokensUsed { get; set; }
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;
}
