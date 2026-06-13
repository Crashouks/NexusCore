using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace NexusCore.Api.Services;

public class JwtTokenService(IConfiguration config)
{
    public string CreateToken(dynamic user)
    {
        var secret = Environment.GetEnvironmentVariable("JWT_SECRET") ?? config["JWT_SECRET"] ?? "change_me";
        var expiresIn = Environment.GetEnvironmentVariable("JWT_EXPIRES_IN") ?? config["JWT_EXPIRES_IN"] ?? "1d";
        var expiry = ParseExpiry(expiresIn);

        var claims = new List<Claim>
        {
            new("userId", user.user_id.ToString()),
            new("username", (string)user.username),
            new("role", (string)user.role),
            new("cloudPlan", (string)(user.cloud_plan ?? "free")),
        };
        if (user.cloud_plan_expires != null)
            claims.Add(new Claim("cloudPlanExpires", user.cloud_plan_expires.ToString()!));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(claims: claims, expires: DateTime.UtcNow.Add(expiry), signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static TimeSpan ParseExpiry(string expiresIn)
    {
        if (string.IsNullOrWhiteSpace(expiresIn)) return TimeSpan.FromDays(1);
        var s = expiresIn.Trim().ToLowerInvariant();
        if (s.EndsWith('d') && int.TryParse(s[..^1], out var d) && d > 0)
            return TimeSpan.FromDays(d);
        if (s.EndsWith('h') && int.TryParse(s[..^1], out var h) && h > 0)
            return TimeSpan.FromHours(h);
        return TimeSpan.FromDays(1);
    }

    public TimeSpan GetTokenLifetime()
    {
        var expiresIn = Environment.GetEnvironmentVariable("JWT_EXPIRES_IN") ?? config["JWT_EXPIRES_IN"] ?? "1d";
        return ParseExpiry(expiresIn);
    }
}
