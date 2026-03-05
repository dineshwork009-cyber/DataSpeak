using DataSpeak.Domain.Common;

namespace DataSpeak.Domain.Entities;

public class Tenant : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public string Plan { get; set; } = "starter";
    public int MaxUsers { get; set; } = 5;
    public int MaxConnections { get; set; } = 3;
    public int MonthlyQueryLimit { get; set; } = 1000;
}
