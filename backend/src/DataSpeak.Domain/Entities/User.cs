using DataSpeak.Domain.Common;

namespace DataSpeak.Domain.Entities;

public class User : TenantEntity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public bool IsEmailVerified { get; set; } = false;
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public bool IsActive { get; set; } = true;
    public string? AvatarUrl { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();

    public bool IsRefreshTokenValid(string token)
        => RefreshToken == token
        && RefreshTokenExpiry.HasValue
        && RefreshTokenExpiry.Value > DateTime.UtcNow;
}
