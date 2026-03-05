using DataSpeak.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DataSpeak.API.Controllers;

/// <summary>
/// Super-admin endpoints. Restricted to users with the Owner role on the platform tenant.
/// In a real deployment, scope this with a separate "SuperAdmin" claim or API key.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Owner")]
[Produces("application/json")]
public class AdminController : ControllerBase
{
    private readonly IApplicationDbContext _db;

    public AdminController(IApplicationDbContext db) => _db = db;

    /// <summary>List all tenants with aggregate stats.</summary>
    [HttpGet("tenants")]
    public async Task<IActionResult> GetTenants(CancellationToken ct)
    {
        var rows = await _db.QueryAsync<object>(
            @"SELECT t.id, t.name, t.slug, t.is_active, t.plan,
                     (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.is_deleted = FALSE) AS user_count,
                     (SELECT COUNT(*) FROM database_connections dc WHERE dc.tenant_id = t.id AND dc.is_deleted = FALSE) AS connection_count,
                     t.created_at
              FROM tenants t
              WHERE t.is_deleted = FALSE
              ORDER BY t.created_at DESC",
            ct: ct);

        return Ok(rows);
    }

    /// <summary>Toggle a tenant's active status.</summary>
    [HttpPut("tenants/{tenantId:guid}/status")]
    public async Task<IActionResult> ToggleTenantStatus(Guid tenantId, [FromBody] ToggleStatusRequest req, CancellationToken ct)
    {
        await _db.ExecuteAsync(
            "UPDATE tenants SET is_active = @IsActive, updated_at = NOW() WHERE id = @Id",
            new { IsActive = req.IsActive, Id = tenantId }, ct);

        return NoContent();
    }

    /// <summary>Platform-wide usage statistics.</summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken ct)
    {
        var stats = await _db.QueryFirstOrDefaultAsync<object>(
            @"SELECT
                (SELECT COUNT(*) FROM tenants WHERE is_deleted = FALSE) AS total_tenants,
                (SELECT COUNT(*) FROM users   WHERE is_deleted = FALSE) AS total_users,
                (SELECT COUNT(*) FROM query_history WHERE is_deleted = FALSE) AS total_queries,
                (SELECT COALESCE(SUM(tokens_used),0) FROM query_history WHERE is_deleted = FALSE) AS total_tokens",
            ct: ct);

        return Ok(stats);
    }
}

public record ToggleStatusRequest(bool IsActive);
