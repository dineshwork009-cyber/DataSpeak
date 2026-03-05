using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DataSpeak.Application.Common.Interfaces;
using DataSpeak.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace DataSpeak.Infrastructure.Services;

public class JwtTokenService : IJwtTokenService
{
    private readonly string _secretKey;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly int _accessTokenExpiryMinutes;

    public JwtTokenService(IConfiguration config)
    {
        _secretKey              = config["Jwt:SecretKey"]  ?? throw new InvalidOperationException("Jwt:SecretKey required.");
        _issuer                 = config["Jwt:Issuer"]     ?? "dataspeak";
        _audience               = config["Jwt:Audience"]   ?? "dataspeak-users";
        _accessTokenExpiryMinutes = int.TryParse(config["Jwt:AccessTokenExpiryMinutes"], out var m) ? m : 15;
    }

    public string GenerateAccessToken(
        Guid userId, Guid tenantId, string email,
        string firstName, string lastName,
        TenantRole role, string tenantName)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,   userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new Claim("tenantId",    tenantId.ToString()),
            new Claim("tenantName",  tenantName),
            new Claim("firstName",   firstName),
            new Claim("lastName",    lastName),
            new Claim(ClaimTypes.Role, role.ToString()),
        };

        var key         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry      = DateTime.UtcNow.AddMinutes(_accessTokenExpiryMinutes);

        var token = new JwtSecurityToken(
            issuer:             _issuer,
            audience:           _audience,
            claims:             claims,
            notBefore:          DateTime.UtcNow,
            expires:            expiry,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomBytes = new byte[64];
        RandomNumberGenerator.Fill(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }

    public Guid? GetUserIdFromExpiredToken(string token)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key          = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));

        try
        {
            var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey        = key,
                ValidateIssuer          = true,
                ValidIssuer             = _issuer,
                ValidateAudience        = true,
                ValidAudience           = _audience,
                ValidateLifetime        = false  // Allow expired tokens for refresh
            }, out _);

            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            return Guid.TryParse(sub, out var id) ? id : null;
        }
        catch
        {
            return null;
        }
    }
}
