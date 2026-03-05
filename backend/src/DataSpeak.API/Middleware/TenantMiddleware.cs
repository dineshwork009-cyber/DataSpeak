using System.Security.Claims;

namespace DataSpeak.API.Middleware;

/// <summary>
/// Validates that the JWT tenantId claim resolves to an active tenant.
/// Sets a per-request "TenantId" item on HttpContext for downstream use.
/// Anonymous routes are skipped automatically.
/// </summary>
public class TenantMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<TenantMiddleware> _logger;

    public TenantMiddleware(RequestDelegate next, ILogger<TenantMiddleware> logger)
    {
        _next   = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var tenantIdClaim = context.User.FindFirst("tenantId")?.Value;

            if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
            {
                _logger.LogWarning("Authenticated request is missing a valid tenantId claim.");
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync("Invalid tenant context.");
                return;
            }

            context.Items["TenantId"] = tenantId;
        }

        await _next(context);
    }
}
