using DataSpeak.Application.Common.Interfaces;
using DataSpeak.Domain.Entities;
using DataSpeak.Domain.Enums;
using FluentValidation;
using MediatR;

namespace DataSpeak.Application.Features.Auth.Commands;

// ──────────────────────────────────────────────────────────────
// Command + Response
// ──────────────────────────────────────────────────────────────
public record RegisterCommand(
    string TenantName,
    string Email,
    string Password,
    string FirstName,
    string LastName) : IRequest<AuthResponse>;

public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    UserDto User);

public record UserDto(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string FullName,
    Guid TenantId,
    string TenantName,
    string Role);

// ──────────────────────────────────────────────────────────────
// Validator
// ──────────────────────────────────────────────────────────────
public class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.TenantName)
            .NotEmpty().WithMessage("Organisation name is required.")
            .MaximumLength(100);

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress().WithMessage("A valid email address is required.")
            .MaximumLength(256);

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.")
            .MaximumLength(100)
            .Matches(@"[A-Z]").WithMessage("Password must contain at least one uppercase letter.")
            .Matches(@"[0-9]").WithMessage("Password must contain at least one digit.");

        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(50);
    }
}

// ──────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────
public class RegisterCommandHandler : IRequestHandler<RegisterCommand, AuthResponse>
{
    private readonly IApplicationDbContext _db;
    private readonly IJwtTokenService _jwt;
    private readonly IPasswordHasher _hasher;
    private readonly IAuditService _audit;

    public RegisterCommandHandler(
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

    public async Task<AuthResponse> Handle(RegisterCommand cmd, CancellationToken ct)
    {
        // 1. Check email uniqueness across the whole platform
        var exists = await _db.QueryFirstOrDefaultAsync<int>(
            "SELECT 1 FROM users WHERE email = @Email AND is_deleted = FALSE LIMIT 1",
            new { cmd.Email }, ct);

        if (exists != 0)
            throw new InvalidOperationException("Email is already registered.");

        // 2. Create tenant
        var tenant = new Tenant
        {
            Name = cmd.TenantName.Trim(),
            Slug = GenerateSlug(cmd.TenantName)
        };

        await _db.ExecuteAsync(
            @"INSERT INTO tenants (id, name, slug, is_active, plan,
                                   max_users, max_connections, monthly_query_limit,
                                   created_at, updated_at)
              VALUES (@Id, @Name, @Slug, @IsActive, @Plan,
                      @MaxUsers, @MaxConnections, @MonthlyQueryLimit,
                      @CreatedAt, @UpdatedAt)",
            new
            {
                tenant.Id, tenant.Name, tenant.Slug, tenant.IsActive, tenant.Plan,
                tenant.MaxUsers, tenant.MaxConnections, tenant.MonthlyQueryLimit,
                tenant.CreatedAt, tenant.UpdatedAt
            }, ct);

        // 3. Create user
        var user = new User
        {
            TenantId      = tenant.Id,
            Email         = cmd.Email.ToLowerInvariant().Trim(),
            PasswordHash  = _hasher.Hash(cmd.Password),
            FirstName     = cmd.FirstName.Trim(),
            LastName      = cmd.LastName.Trim(),
            IsEmailVerified = false,
            IsActive      = true
        };

        user.RefreshToken        = _jwt.GenerateRefreshToken();
        user.RefreshTokenExpiry  = DateTime.UtcNow.AddDays(7);

        await _db.ExecuteAsync(
            @"INSERT INTO users (id, tenant_id, email, password_hash,
                                 first_name, last_name, is_email_verified,
                                 refresh_token, refresh_token_expiry,
                                 is_active, created_at, updated_at)
              VALUES (@Id, @TenantId, @Email, @PasswordHash,
                      @FirstName, @LastName, @IsEmailVerified,
                      @RefreshToken, @RefreshTokenExpiry,
                      @IsActive, @CreatedAt, @UpdatedAt)",
            new
            {
                user.Id, user.TenantId, user.Email, user.PasswordHash,
                user.FirstName, user.LastName, user.IsEmailVerified,
                user.RefreshToken, user.RefreshTokenExpiry,
                user.IsActive, user.CreatedAt, user.UpdatedAt
            }, ct);

        // 4. Assign Owner role
        await _db.ExecuteAsync(
            @"INSERT INTO user_tenant_roles (id, user_id, tenant_id, role,
                                             is_active, created_at, updated_at)
              VALUES (@Id, @UserId, @TenantId, @Role,
                      @IsActive, @CreatedAt, @UpdatedAt)",
            new
            {
                Id        = Guid.NewGuid(),
                UserId    = user.Id,
                TenantId  = tenant.Id,
                Role      = (int)TenantRole.Owner,
                IsActive  = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }, ct);

        await _audit.LogAsync(tenant.Id, user.Id, "REGISTER", "User", user.Id.ToString(), ct: ct);

        // 5. Issue tokens
        var accessToken = _jwt.GenerateAccessToken(
            user.Id, tenant.Id, user.Email,
            user.FirstName, user.LastName,
            TenantRole.Owner, tenant.Name);

        return new AuthResponse(
            accessToken,
            user.RefreshToken,
            DateTime.UtcNow.AddMinutes(15),
            new UserDto(
                user.Id, user.Email, user.FirstName, user.LastName, user.FullName,
                tenant.Id, tenant.Name, TenantRole.Owner.ToString()));
    }

    private static string GenerateSlug(string name)
    {
        var slug = name.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("'", "")
            .Replace("\"", "");
        return $"{slug}-{Guid.NewGuid().ToString()[..6]}";
    }
}
