using DataSpeak.Domain.Enums;

namespace DataSpeak.Application.Common.Interfaces;

public interface IJwtTokenService
{
    string GenerateAccessToken(
        Guid userId, Guid tenantId, string email,
        string firstName, string lastName,
        TenantRole role, string tenantName);
    string GenerateRefreshToken();
    Guid? GetUserIdFromExpiredToken(string token);
}
