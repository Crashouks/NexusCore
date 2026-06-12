using Microsoft.AspNetCore.Mvc;

namespace NexusCore.Api.Helpers;

public static class ApiResults
{
    public static IActionResult Error(int status, string message, string code) =>
        new ObjectResult(new { error = message, code }) { StatusCode = status };
}
