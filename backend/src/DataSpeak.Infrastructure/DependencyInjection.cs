using DataSpeak.Application.Common.Interfaces;
using DataSpeak.Infrastructure.Persistence;
using DataSpeak.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using StackExchange.Redis;

namespace DataSpeak.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration config)
    {
        // ── Database ────────────────────────────────────────────────────
        services.AddScoped<IApplicationDbContext, ApplicationDbContext>();

        // ── Redis ───────────────────────────────────────────────────────
        var redisConnectionString = config.GetConnectionString("Redis")
            ?? throw new InvalidOperationException("Redis connection string is required.");

        services.AddSingleton<IConnectionMultiplexer>(
            ConnectionMultiplexer.Connect(redisConnectionString));
        services.AddScoped<ICacheService, RedisCacheService>();

        // ── Auth / Security ─────────────────────────────────────────────
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
        services.AddScoped<IEncryptionService, EncryptionService>();

        // ── HTTP Context ────────────────────────────────────────────────
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        // ── AI / Query ──────────────────────────────────────────────────
        services.AddHttpClient<IClaudeService, OllamaService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(300);
        });
        services.AddScoped<IQueryExecutionService, QueryExecutionService>();

        // ── Audit ───────────────────────────────────────────────────────
        services.AddScoped<IAuditService, AuditService>();

        // ── Serilog (file + console) ────────────────────────────────────
        Log.Logger = new LoggerConfiguration()
            .ReadFrom.Configuration(config)
            .Enrich.FromLogContext()
            .Enrich.WithEnvironmentName()
            .Enrich.WithThreadId()
            .WriteTo.Console(outputTemplate:
                "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext} {Message:lj}{NewLine}{Exception}")
            .WriteTo.File(
                "logs/dataspeak-.log",
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 30)
            .CreateLogger();

        return services;
    }
}
