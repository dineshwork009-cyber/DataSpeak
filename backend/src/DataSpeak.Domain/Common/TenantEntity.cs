namespace DataSpeak.Domain.Common;

/// <summary>
/// Base class for all tenant-scoped entities.
/// Every query against tenant entities MUST filter by TenantId.
/// </summary>
public abstract class TenantEntity : BaseEntity
{
    public Guid TenantId { get; set; }
}
