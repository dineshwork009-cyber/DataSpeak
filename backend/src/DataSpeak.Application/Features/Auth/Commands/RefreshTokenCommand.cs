using DataSpeak.Application.Common.Interfaces;
using DataSpeak.Domain.Enums;
using FluentValidation;
using MediatR;

namespace DataSpeak.Application.Features.Auth.Commands;

public record RefreshTokenCommand(string AccessToken, string RefreshToken) : IRequest<AuthResponse>;

public class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    public RefreshTokenCommandValidator()
    {
        RuleFor(x => x.AccessToken).NotEmpty();
        RuleFor(x => x.RefreshToken).NotEmpty();
    }
}

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, AuthResponse>
{
    private readonly IApplicationDbContext _db;
    private readonly IJwtTokenService _jwt;

    public RefreshTokenCommandHandler(IApplicationDbContext db, IJwtTokenService jwt)
    {
        _db  = db;
        _jwt = jwt;
    }

    public async Task<AuthResponse> Handle(RefreshTokenCommand cmd, CancellationToken ct)
    {
        var userId = _jwt.GetUserIdFromExpiredToken(cmd.AccessToken)
            ?? throw new UnauthorizedAccessException("Invalid access token.");

        var user = await _db.QueryFirstOrDefaultAsync<UserProjection>(
            @"SELECT u.id,
                     u.tenant_id            AS TenantId,
                     u.email,
                     u.first_name           AS FirstName,
                     u.last_name            AS LastName,
                     u.refresh_token        AS RefreshToken,
                     u.refresh_token_expiry AS RefreshTokenExpiry,
                     u.is_active            AS IsActive,
                     r.role,
                     t.name                 AS TenantName
              FROM users u
              INNER JOIN user_tenant_roles r ON r.user_id = u.id AND r.tenant_id = u.tenant_id
              INNER JOIN tenants t ON t.id = u.tenant_id
              WHERE u.id = @UserId AND u.is_deleted = FALSE",
            new { UserId = userId }, ct)
            ?? throw new UnauthorizedAccessException("User not found.");

        if (user.RefreshToken != cmd.RefreshToken || user.RefreshTokenExpiry < DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token is invalid or expired.");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("Account is deactivated.");

        var newRefreshToken = _jwt.GenerateRefreshToken();
        await _db.ExecuteAsync(
            "UPDATE users SET refresh_token = @Token, refresh_token_expiry = @Expiry, updated_at = NOW() WHERE id = @Id",
            new { Token = newRefreshToken, Expiry = DateTime.UtcNow.AddDays(7), Id = user.Id }, ct);

        var role        = (TenantRole)user.Role;
        var accessToken = _jwt.GenerateAccessToken(
            user.Id, user.TenantId, user.Email,
            user.FirstName, user.LastName,
            role, user.TenantName);

        return new AuthResponse(
            accessToken, newRefreshToken, DateTime.UtcNow.AddMinutes(15),
            new UserDto(
                user.Id, user.Email, user.FirstName, user.LastName,
                $"{user.FirstName} {user.LastName}",
                user.TenantId, user.TenantName, role.ToString()));
    }

    private class UserProjection
    {
        public Guid Id { get; init; }
        public Guid TenantId { get; init; }
        public string Email { get; init; } = "";
        public string FirstName { get; init; } = "";
        public string LastName { get; init; } = "";
        public string? RefreshToken { get; init; }
        public DateTime? RefreshTokenExpiry { get; init; }
        public bool IsActive { get; init; }
        public int Role { get; init; }
        public string TenantName { get; init; } = "";
    }
}
