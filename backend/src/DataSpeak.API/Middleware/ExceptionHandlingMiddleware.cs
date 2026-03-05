using System.Net;
using System.Text.Json;
using DataSpeak.Application.Common.Exceptions;

namespace DataSpeak.API.Middleware;

/// <summary>
/// Global exception handler: maps domain/application exceptions to RFC-7807 problem details.
/// Ensures stack traces never leak to clients in production.
/// </summary>
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IWebHostEnvironment _env;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IWebHostEnvironment env)
    {
        _next   = next;
        _logger = logger;
        _env    = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        var (statusCode, title, errors) = ex switch
        {
            ValidationException ve =>
                (HttpStatusCode.UnprocessableEntity, "Validation failed", ve.Errors),

            NotFoundException =>
                (HttpStatusCode.NotFound, ex.Message, (IDictionary<string, string[]>?)null),

            ForbiddenException =>
                (HttpStatusCode.Forbidden, ex.Message, null),

            UnauthorizedAccessException =>
                (HttpStatusCode.Unauthorized, ex.Message, null),

            QuerySafetyException =>
                (HttpStatusCode.BadRequest, ex.Message, null),

            InvalidOperationException =>
                (HttpStatusCode.BadRequest, ex.Message, null),

            _ => (HttpStatusCode.InternalServerError, "An unexpected error occurred.", null)
        };

        if (statusCode == HttpStatusCode.InternalServerError)
            _logger.LogError(ex, "Unhandled exception on {Method} {Path}",
                context.Request.Method, context.Request.Path);
        else
            _logger.LogWarning(ex, "{ExType}: {Message}", ex.GetType().Name, ex.Message);

        context.Response.ContentType = "application/problem+json";
        context.Response.StatusCode  = (int)statusCode;

        var problem = new
        {
            type    = $"https://httpstatuses.com/{(int)statusCode}",
            title,
            status  = (int)statusCode,
            errors,
            detail  = _env.IsDevelopment() ? ex.ToString() : null,
            traceId = context.TraceIdentifier
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(problem, new JsonSerializerOptions
        {
            PropertyNamingPolicy        = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition      = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        }));
    }
}
