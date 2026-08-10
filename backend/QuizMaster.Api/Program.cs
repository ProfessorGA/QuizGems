using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QuizMaster.Api.Hubs;
using QuizMaster.Api.Services;
using QuizMaster.Core.Entities;
using QuizMaster.Infrastructure.Data;
using QuizMaster.Infrastructure.Repositories;

var builder = WebApplication.CreateBuilder(args);

// Support containerized PORT environment variable (Render)
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// 1. Database Configuration (Flexible: PostgreSQL on Render / SQLite for zero-config local dev)
var dbProvider = Environment.GetEnvironmentVariable("DATABASE_PROVIDER") ?? builder.Configuration["DatabaseProvider"];
var connectionString = Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING")
    ?? builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Data Source=quizmaster.db";

var isSqlite = string.Equals(dbProvider, "Sqlite", StringComparison.OrdinalIgnoreCase) ||
               connectionString.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase) ||
               connectionString.EndsWith(".db", StringComparison.OrdinalIgnoreCase);

if (!isSqlite)
{
    connectionString = ParsePostgresConnectionString(connectionString);
}

builder.Services.AddDbContext<QuizDbContext>(options =>
{
    if (isSqlite)
    {
        options.UseSqlite(connectionString, sqliteOptions =>
        {
            sqliteOptions.MigrationsAssembly("QuizMaster.Infrastructure");
        });
    }
    else
    {
        options.UseNpgsql(connectionString, npgsqlOptions =>
        {
            npgsqlOptions.MigrationsAssembly("QuizMaster.Infrastructure");
            npgsqlOptions.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
        });
    }
});

// 2. Repositories & Services
builder.Services.AddScoped<IQuizRepository, QuizRepository>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IQuizScoringService, QuizScoringService>();
builder.Services.AddSingleton<IQuizSessionManager, QuizSessionManager>();

// 3. SignalR
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.KeepAliveInterval = TimeSpan.FromSeconds(10);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
});

// 4. JWT Authentication
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "QuizMasterSuperSecretKeyForPhysicalRoomLiveQuizCompetitions2026";
var key = Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };

    // Support SignalR authentication via query string
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/quiz"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// 5. CORS
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? new[]
{
    "http://localhost:4200",
    "http://localhost:3000"
};

var extraOriginsEnv = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS");
var originList = allowedOrigins.ToList();
if (!string.IsNullOrEmpty(extraOriginsEnv))
{
    originList.AddRange(extraOriginsEnv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            // Allow localhost, vercel deployments, and configured origins
            if (origin.StartsWith("http://localhost:") || 
                origin.EndsWith(".vercel.app") || 
                originList.Contains(origin))
            {
                return true;
            }
            return false;
        })
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();
    });
});

// 6. Controllers & JSON Formatting
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// 7. Auto Database Initialization & Admin Seeding
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = services.GetRequiredService<QuizDbContext>();
        db.Database.EnsureCreated();

        // Seed default admin if not exists
        if (!db.AdminUsers.Any())
        {
            var defaultUsername = builder.Configuration["Admin:DefaultUsername"] ?? "admin";
            var defaultPassword = builder.Configuration["Admin:DefaultPassword"] ?? "Admin@Quiz2026";
            var passwordHash = BCrypt.Net.BCrypt.HashPassword(defaultPassword);

            db.AdminUsers.Add(new AdminUser
            {
                Username = defaultUsername,
                PasswordHash = passwordHash,
                Role = "Admin",
                CreatedAt = DateTime.UtcNow
            });
            db.SaveChanges();
            logger.LogInformation("Default Admin user created successfully: {Username}", defaultUsername);
        }
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Could not initialize database on startup (PostgreSQL server may be offline during initial build): {Message}", ex.Message);
    }
}

app.UseCors("CorsPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<QuizHub>("/hubs/quiz");
app.MapGet("/", () => Results.Ok(new { message = "Quiz Master Real-Time Physical Quiz Platform API is running.", version = "1.0.0", health = "/health" }));

app.Run();

static string ParsePostgresConnectionString(string raw)
{
    if (string.IsNullOrWhiteSpace(raw)) return raw;

    if (raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
        raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        try
        {
            var standardUriString = raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
                ? "postgres://" + raw[13..]
                : raw;

            var uri = new Uri(standardUriString);
            var userInfo = uri.UserInfo.Split(':');
            var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
            var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
            var host = uri.Host;
            var port = uri.Port > 0 ? uri.Port : 5432;
            var database = uri.AbsolutePath.TrimStart('/');

            return $"Host={host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Prefer;Trust Server Certificate=true;";
        }
        catch
        {
            var match = System.Text.RegularExpressions.Regex.Match(raw, @"^postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)$");
            if (match.Success)
            {
                var user = Uri.UnescapeDataString(match.Groups[1].Value);
                var pass = Uri.UnescapeDataString(match.Groups[2].Value);
                var host = match.Groups[3].Value;
                var port = match.Groups[4].Success ? match.Groups[4].Value : "5432";
                var db = match.Groups[5].Value;
                return $"Host={host};Port={port};Database={db};Username={user};Password={pass};SSL Mode=Prefer;Trust Server Certificate=true;";
            }
        }
    }

    return raw;
}

