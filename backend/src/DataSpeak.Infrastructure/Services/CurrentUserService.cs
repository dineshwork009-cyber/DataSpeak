using System.Security.Claims;
using DataSpeak.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace DataSpeak.Infrastructure.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
        => _httpContextAccessor = httpContextAccessor;

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public Guid UserId
        => Guid.TryParse(User?.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User?.FindFirstValue("sub"), out var id)
            ? id
            : Guid.Empty;

    public Guid TenantId
        => Guid.TryParse(User?.FindFirstValue("tenantId"), out var id)
            ? id
            : Guid.Empty;

    public string Email
        => User?.FindFirstValue(ClaimTypes.Email)
           ?? User?.FindFirstValue("email")
           ?? string.Empty;

    public string Role
        => User?.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

    public bool IsAuthenticated
        => User?.Identity?.IsAuthenticated ?? false;

    public string? IpAddress
        => _httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString();

    public string? UserAgent
        => _httpContextAccessor.HttpContext?.Request.Headers.UserAgent.ToString();
}
