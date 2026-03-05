using DataSpeak.Application.Features.Queries.Commands;
using DataSpeak.Application.Features.Queries.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DataSpeak.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class QueriesController : ControllerBase
{
    private readonly IMediator _mediator;
    public QueriesController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Execute a natural language query against a connected database.
    /// Flow: NL → Claude (SQL generation) → SQL validator → Dapper (execution) → result.
    /// </summary>
    [HttpPost("execute")]
    [Authorize(Roles = "Owner,Admin,Analyst")]
    [ProducesResponseType(typeof(QueryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Execute(
        [FromBody] ExecuteQueryCommand command,
        CancellationToken ct)
    {
        var result = await _mediator.Send(command, ct);
        return Ok(result);
    }

    /// <summary>Paginated query history for the current tenant.</summary>
    [HttpGet("history")]
    [ProducesResponseType(typeof(DataSpeak.Application.Common.Models.PaginatedList<QueryHistoryDto>),
        StatusCodes.Status200OK)]
    public async Task<IActionResult> History(
        [FromQuery] Guid? connectionId,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize   = 20,
        CancellationToken ct       = default)
    {
        var result = await _mediator.Send(
            new GetQueryHistoryQuery(connectionId, pageNumber, pageSize), ct);
        return Ok(result);
    }
}
