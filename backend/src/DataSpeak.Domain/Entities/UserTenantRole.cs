using DataSpeak.Domain.Common;
using DataSpeak.Domain.Enums;

namespace DataSpeak.Domain.Entities;

public class UserTenantRole : TenantEntity
{
    public Guid UserId { get; set; }
    public TenantRole Role { get; set; }
    public bool IsActive { get; set; } = true;
}
