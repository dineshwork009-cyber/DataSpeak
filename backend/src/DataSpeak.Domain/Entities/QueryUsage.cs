using DataSpeak.Domain.Common;

namespace DataSpeak.Domain.Entities;

public class QueryUsage : TenantEntity
{
    public Guid UserId { get; set; }
    public int Month { get; set; }
    public int Year { get; set; }
    public int TotalQueries { get; set; }
    public int TotalTokensUsed { get; set; }
    public int SuccessfulQueries { get; set; }
    public int FailedQueries { get; set; }
}
