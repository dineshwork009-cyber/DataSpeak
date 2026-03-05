using DataSpeak.Application.Common.Exceptions;
using DataSpeak.Application.Common.Interfaces;
using DataSpeak.Domain.Enums;
using FluentValidation;
using MediatR;

namespace DataSpeak.Application.Features.Auth.Commands;

// ──────────────────────────────────────────────────────────────
// Command
// ──────────────────────────────────────────────────────────────
public record LoginCommand(string Email, string Password) : IRequest<AuthResponse>;

// ──────────────────────────────────────────────────────────────
// Validator
// ──────────────────────────────────────────────────────────────
public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

// ──────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────
public class LoginCommandHandler : IRequestHandler<LoginCommand, AuthResponse>
{
    private readonly IApplicationDbContext _db;
    private readonly IJwtTokenService _jwt;
    private readonly IPasswordHasher _hasher;
    private readonly IAuditService _audit;

    public LoginCommandHandler(
        IApplicationDbContext db,
        IJwtTokenService jwt,
        IPasswordHasher hasher,
        IAuditService audit)
    {
        _db     = db;
        _jwt    = jwt;
        _hasher = hasher;
        _audit  = audit;
    }

    public async Task<AuthResponse> Handle(LoginCommand cmd, CancellationToken ct)
    {
        var user = await _db.QueryFirstOrDefaultAsync<UserRecord>(
            @"SELECT u.id,
                     u.tenant_id        AS TenantId,
                     u.email,
                     u.password_hash    AS PasswordHash,
                     u.first_name       AS FirstName,
                     u.last_name        AS LastName,
                     u.is_active        AS IsActive,
                     u.refresh_token    AS RefreshToken,
                     u.refresh_token_expiry AS RefreshTokenExpiry,
                     r.role
              FROM users u
              INNER JOIN user_tenant_roles r ON r.user_id = u.id AND r.tenant_id = u.tenant_id
              WHERE u.email = @Email AND u.is_deleted = FALSE
              LIMIT 1",
            new { Email = cmd.Email.ToLowerInvariant() }, ct);

        if (user is null || !_hasher.Verify(cmd.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid email or password.");

        if (!user.IsActive)
            throw new ForbiddenException("Your account has been deactivated.");

        var tenant = await _db.QuerySingleAsync<TenantRecord>(
            "SELECT id, name FROM tenants WHERE id = @TenantId AND is_deleted = FALSE",
            new { TenantId = user.TenantId }, ct);

        var refreshToken = _jwt.GenerateRefreshToken();
        var refreshExpiry = DateTime.UtcNow.AddDays(7);

        await _db.ExecuteAsync(
            @"UPDATE users SET refresh_token = @Token, refresh_token_expiry = @Expiry,
              last_login_at = NOW(), updated_at = NOW()
              WHERE id = @Id",
            new { Token = refreshToken, Expiry = refreshExpiry, Id = user.Id }, ct);

        await _audit.LogAsync(user.TenantId, user.Id, "LOGIN", "User", user.Id.ToString(), ct: ct);

        var role = (TenantRole)user.Role;
        var accessToken = _jwt.GenerateAccessToken(
            user.Id, user.TenantId, user.Email,
            user.FirstName, user.LastName,
            role, tenant.Name);

        return new AuthResponse(
            accessToken,
            refreshToken,
            DateTime.UtcNow.AddMinutes(15),
            new UserDto(
                user.Id, user.Email, user.FirstName, user.LastName,
                $"{user.FirstName} {user.LastName}",
                user.TenantId, tenant.Name, role.ToString()));
    }

    // ── Dapper projection types ─────────────────────────────────
    private class UserRecord
    {
        public Guid Id { get; init; }
        public Guid TenantId { get; init; }
        public string Email { get; init; } = "";
        public string PasswordHash { get; init; } = "";
        public string FirstName { get; init; } = "";
        public string LastName { get; init; } = "";
        public bool IsActive { get; init; }
        public string? RefreshToken { get; init; }
        public DateTime? RefreshTokenExpiry { get; init; }
        public int Role { get; init; }
    }

    private class TenantRecord
    {
        public Guid Id { get; init; }
        public string Name { get; init; } = "";
    }
}
