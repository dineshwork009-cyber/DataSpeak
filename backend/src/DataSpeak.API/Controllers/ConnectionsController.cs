using DataSpeak.Application.Features.Connections.Commands;
using DataSpeak.Application.Features.Connections.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DataSpeak.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class ConnectionsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ConnectionsController(IMediator mediator) => _mediator = mediator;

    /// <summary>List all database connections for the current tenant.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<ConnectionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await _mediator.Send(new GetConnectionsQuery(), ct);
        return Ok(result);
    }

    /// <summary>Create a new database connection (connection string is encrypted at rest).</summary>
    [HttpPost]
    [Authorize(Roles = "Owner,Admin")]
    [ProducesResponseType(typeof(ConnectionDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Create(
        [FromBody] CreateConnectionCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return CreatedAtAction(nameof(GetAll), new { id = result.Id }, result);
    }

    /// <summary>Delete a connection (soft delete).</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Owner,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var db = HttpContext.RequestServices
            .GetRequiredService<DataSpeak.Application.Common.Interfaces.IApplicationDbContext>();
        var currentUser = HttpContext.RequestServices
            .GetRequiredService<DataSpeak.Application.Common.Interfaces.ICurrentUserService>();

        await db.ExecuteAsync(
            @"UPDATE database_connections
              SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
              WHERE id = @Id AND tenant_id = @TenantId",
            new { Id = id, TenantId = currentUser.TenantId }, ct);

        return NoContent();
    }

    /// <summary>Test a connection to verify reachability.</summary>
    [HttpPost("{id:guid}/test")]
    [ProducesResponseType(typeof(TestConnectionResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> Test(Guid id, CancellationToken ct)
    {
        var result = await _mediator.Send(new TestConnectionCommand(id), ct);
        return Ok(result);
    }
}
