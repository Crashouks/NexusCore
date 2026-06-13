namespace NexusCore.Api.Helpers;

public static class AuthCookie
{
    public const string Name = "nc_auth";

    public static void Set(HttpResponse response, HttpRequest request, string jwt, TimeSpan maxAge)
    {
        response.Cookies.Append(Name, jwt, CookieOptions(request, maxAge));
    }

    public static void Clear(HttpResponse response, HttpRequest request)
    {
        response.Cookies.Delete(Name, CookieOptions(request, null));
    }

    private static CookieOptions CookieOptions(HttpRequest request, TimeSpan? maxAge)
    {
        var options = new CookieOptions
        {
            HttpOnly = true,
            Secure = UseSecureCookies(request),
            SameSite = SameSiteMode.Lax,
            Path = "/",
        };
        if (maxAge.HasValue)
            options.MaxAge = maxAge.Value;
        return options;
    }

    private static bool UseSecureCookies(HttpRequest request)
    {
        if (request.IsHttps) return true;
        if (string.Equals(Environment.GetEnvironmentVariable("HTTPS_MODE"), "1", StringComparison.OrdinalIgnoreCase))
            return true;
        var publicWeb = Environment.GetEnvironmentVariable("PUBLIC_WEB_URL");
        return publicWeb?.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ?? false;
    }
}
