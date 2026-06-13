namespace NexusCore.Api.Helpers;

public static class CorsOrigins
{
    public static string[] GetAllowedOrigins()
    {
        var origins = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        };

        var webPort = Environment.GetEnvironmentVariable("WEB_PORT") ?? "5173";
        if (webPort is not "5173" and not "5174")
        {
            origins.Add($"http://localhost:{webPort}");
            origins.Add($"http://127.0.0.1:{webPort}");
        }

        var publicWeb = Environment.GetEnvironmentVariable("PUBLIC_WEB_URL")?.Trim().TrimEnd('/');
        if (!string.IsNullOrEmpty(publicWeb))
            origins.Add(publicWeb);

        return origins.ToArray();
    }
}
