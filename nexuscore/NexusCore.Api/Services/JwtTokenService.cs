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
        var expiresIn = Environment.GetEnvironmentVariable("JWT_EXPIRES_IN") ?? config["JWT_EXPIRES_IN"] ?? "7d";
        var days = expiresIn.EndsWith('d') && int.TryParse(expiresIn[..^1], out var d) ? d : 7;

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
        var token = new JwtSecurityToken(claims: claims, expires: DateTime.UtcNow.AddDays(days), signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
