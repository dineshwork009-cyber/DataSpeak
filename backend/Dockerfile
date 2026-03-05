# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore (cached layer if csproj files unchanged)
COPY ["src/DataSpeak.API/DataSpeak.API.csproj",           "src/DataSpeak.API/"]
COPY ["src/DataSpeak.Application/DataSpeak.Application.csproj", "src/DataSpeak.Application/"]
COPY ["src/DataSpeak.Infrastructure/DataSpeak.Infrastructure.csproj", "src/DataSpeak.Infrastructure/"]
COPY ["src/DataSpeak.Domain/DataSpeak.Domain.csproj",     "src/DataSpeak.Domain/"]

RUN dotnet restore "src/DataSpeak.API/DataSpeak.API.csproj"

# Build
COPY . .
RUN dotnet build "src/DataSpeak.API/DataSpeak.API.csproj" -c Release -o /app/build

# Publish
RUN dotnet publish "src/DataSpeak.API/DataSpeak.API.csproj" \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Security: run as non-root
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Create logs directory
RUN mkdir -p /app/logs

COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080

EXPOSE 8080

ENTRYPOINT ["dotnet", "DataSpeak.API.dll"]
