using DataSpeak.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DataSpeak.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class TenantsController : ControllerBase
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public TenantsController(IApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db          = db;
        _currentUser = currentUser;
    }

    /// <summary>Get the current tenant's details.</summary>
    [HttpGet("current")]
    public async Task<IActionResult> GetCurrent(CancellationToken ct)
    {
        var tenant = await _db.QueryFirstOrDefaultAsync<object>(
            @"SELECT id, name, slug, logo_url, is_active, plan,
                     max_users, max_connections, monthly_query_limit, created_at
              FROM tenants
              WHERE id = @TenantId AND is_deleted = FALSE",
            new { TenantId = _currentUser.TenantId }, ct);

        return tenant is null ? NotFound() : Ok(tenant);
    }

    /// <summary>Get all users in the current tenant.</summary>
    [HttpGet("current/users")]
    [Authorize(Roles = "Owner,Admin")]
    public async Task<IActionResult> GetUsers(CancellationToken ct)
    {
        var users = await _db.QueryAsync<object>(
            @"SELECT u.id, u.email, u.first_name, u.last_name, u.is_active,
                     u.last_login_at, u.created_at, r.role
              FROM users u
              INNER JOIN user_tenant_roles r ON r.user_id = u.id AND r.tenant_id = u.tenant_id
              WHERE u.tenant_id = @TenantId AND u.is_deleted = FALSE
              ORDER BY u.created_at",
            new { TenantId = _currentUser.TenantId }, ct);

        return Ok(users);
    }

    /// <summary>Update a tenant user's role.</summary>
    [HttpPut("current/users/{userId:guid}/role")]
    [Authorize(Roles = "Owner,Admin")]
    public async Task<IActionResult> UpdateUserRole(
        Guid userId,
        [FromBody] UpdateRoleRequest request,
        CancellationToken ct)
    {
        await _db.ExecuteAsync(
            @"UPDATE user_tenant_roles SET role = @Role, updated_at = NOW()
              WHERE user_id = @UserId AND tenant_id = @TenantId",
            new { Role = request.Role, UserId = userId, TenantId = _currentUser.TenantId }, ct);

        return NoContent();
    }

    /// <summary>Deactivate a user within the tenant.</summary>
    [HttpDelete("current/users/{userId:guid}")]
    [Authorize(Roles = "Owner,Admin")]
    public async Task<IActionResult> RemoveUser(Guid userId, CancellationToken ct)
    {
        await _db.ExecuteAsync(
            "UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = @UserId AND tenant_id = @TenantId",
            new { UserId = userId, TenantId = _currentUser.TenantId }, ct);

        return NoContent();
    }

    /// <summary>Monthly usage summary for the current tenant.</summary>
    [HttpGet("current/usage")]
    public async Task<IActionResult> GetUsage(
        [FromQuery] int? month,
        [FromQuery] int? year,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var usage = await _db.QueryAsync<object>(
            @"SELECT qu.*, u.email, u.first_name, u.last_name
              FROM query_usage qu
              INNER JOIN users u ON u.id = qu.user_id
              WHERE qu.tenant_id = @TenantId
                AND qu.month = @Month AND qu.year = @Year
              ORDER BY qu.total_queries DESC",
            new
            {
                TenantId = _currentUser.TenantId,
                Month    = month ?? now.Month,
                Year     = year  ?? now.Year
            }, ct);

        return Ok(usage);
    }
}

public record UpdateRoleRequest(int Role);
