using System.Security.Claims;

namespace NexusCore.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal user) =>
        int.Parse(user.FindFirstValue("userId") ?? "0");

    public static string GetRole(this ClaimsPrincipal user) =>
        user.FindFirstValue("role")
        ?? user.FindFirstValue(ClaimTypes.Role)
        ?? "user";

    public static bool IsAdmin(this ClaimsPrincipal user) =>
        user.IsInRole("admin") || user.GetRole() == "admin";
}
