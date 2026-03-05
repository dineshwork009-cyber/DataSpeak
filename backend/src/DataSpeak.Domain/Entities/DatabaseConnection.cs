using DataSpeak.Domain.Common;
using DataSpeak.Domain.Enums;

namespace DataSpeak.Domain.Entities;

public class DatabaseConnection : TenantEntity
{
    public Guid CreatedByUserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DatabaseProvider Provider { get; set; }
    public string EncryptedConnectionString { get; set; } = string.Empty;
    public ConnectionStatus Status { get; set; } = ConnectionStatus.Active;
    public DateTime? LastTestedAt { get; set; }
    public bool IsActive { get; set; } = true;
}
