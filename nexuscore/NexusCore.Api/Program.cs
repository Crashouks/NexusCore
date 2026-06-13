using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using NexusCore.Api.Hubs;
using NexusCore.Api.Services;

var builder = WebApplication.CreateBuilder(args);

LoadParentEnvFile(builder.Environment.ContentRootPath);

builder.Services.AddSingleton<DbService>();
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddSingleton<SessionExpiryService>();
builder.Services.AddSingleton<CloudServerService>();
builder.Services.AddSingleton<ChatService>();
builder.Services.AddSingleton<ForumService>();
builder.Services.AddSingleton<NotificationService>();
builder.Services.AddSingleton<MigrationService>();
builder.Services.AddSingleton<MediaFileService>();

var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? builder.Configuration["JWT_SECRET"]
    ?? "nexuscore_jwt_secret_key_2025_min32chars";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Keep JWT claim names as-is (userId, role) — default inbound mapping breaks role checks.
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            RoleClaimType = "role",
            NameClaimType = "username"
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    context.Token = accessToken;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddSignalR().AddJsonProtocol(o =>
{
    o.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
});
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        o.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.SnakeCaseLower;
    });

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.SetIsOriginAllowed(_ => true)
     .AllowAnyHeader()
     .AllowAnyMethod()
     .AllowCredentials()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "NexusCore API",
        Version = "v1",
        Description = "NexusCore game store, cloud queue & real-time chat API"
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: Bearer {token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
});

var app = builder.Build();

try
{
    await app.Services.GetRequiredService<MigrationService>().RunAsync();
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Migration failed: {ex.Message}");
    Console.Error.WriteLine("Check MySQL is running and .env credentials are correct.");
    return;
}

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "NexusCore API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    RequestPath = "/uploads",
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath)
});

app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");
app.MapHub<CloudStreamHub>("/hubs/cloud-stream");

var port = Environment.GetEnvironmentVariable("PORT")
    ?? builder.Configuration["Port"]
    ?? "5000";
app.Urls.Add($"http://localhost:{port}");

Console.WriteLine($"NexusCore API running on http://localhost:{port}");
Console.WriteLine($"Swagger UI: http://localhost:{port}/swagger");
Console.WriteLine($"Chat Hub: ws://localhost:{port}/hubs/chat");
Console.WriteLine($"Cloud Stream Hub: ws://localhost:{port}/hubs/cloud-stream");

app.Run();

static void LoadParentEnvFile(string contentRoot)
{
    var envPath = Path.GetFullPath(Path.Combine(contentRoot, "..", ".env"));
    if (!File.Exists(envPath)) return;
    foreach (var line in File.ReadAllLines(envPath))
    {
        var trimmed = line.Trim();
        if (trimmed.Length == 0 || trimmed.StartsWith('#')) continue;
        var idx = trimmed.IndexOf('=');
        if (idx <= 0) continue;
        var key = trimmed[..idx].Trim();
        var value = trimmed[(idx + 1)..].Trim();
        Environment.SetEnvironmentVariable(key, value);
    }
}
