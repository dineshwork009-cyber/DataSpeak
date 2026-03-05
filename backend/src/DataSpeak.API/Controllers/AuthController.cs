using DataSpeak.Application.Features.Auth.Commands;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DataSpeak.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;

    public AuthController(IMediator mediator) => _mediator = mediator;

    /// <summary>Register a new organisation and owner account.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Register(
        [FromBody] RegisterCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return CreatedAtAction(nameof(Me), result);
    }

    /// <summary>Authenticate and receive JWT tokens.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(
        [FromBody] LoginCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }

    /// <summary>Rotate access and refresh tokens.</summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(
        [FromBody] RefreshTokenCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }

    /// <summary>Return the current authenticated user's profile.</summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public IActionResult Me()
    {
        var claims = User.Claims.ToDictionary(c => c.Type, c => c.Value);
        return Ok(new
        {
            id         = claims.GetValueOrDefault("sub"),
            email      = claims.GetValueOrDefault("email"),
            firstName  = claims.GetValueOrDefault("firstName"),
            lastName   = claims.GetValueOrDefault("lastName"),
            tenantId   = claims.GetValueOrDefault("tenantId"),
            tenantName = claims.GetValueOrDefault("tenantName"),
            role       = claims.GetValueOrDefault("http://schemas.microsoft.com/ws/2008/06/identity/claims/role")
                         ?? claims.GetValueOrDefault("role")
        });
    }

    /// <summary>Invalidate refresh token (server-side logout).</summary>
    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var userId = User.FindFirst("sub")?.Value;
        if (!string.IsNullOrEmpty(userId))
        {
            // Nullify refresh token to prevent reuse
            var db = HttpContext.RequestServices
                .GetRequiredService<DataSpeak.Application.Common.Interfaces.IApplicationDbContext>();
            await db.ExecuteAsync(
                "UPDATE users SET refresh_token = NULL, refresh_token_expiry = NULL, updated_at = NOW() WHERE id = @Id",
                new { Id = Guid.Parse(userId) }, ct);
        }
        return NoContent();
    }
}
