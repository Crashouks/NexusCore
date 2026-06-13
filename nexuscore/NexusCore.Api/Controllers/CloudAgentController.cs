using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusCore.Api.Helpers;
using NexusCore.Api.Services;

namespace NexusCore.Api.Controllers;

[ApiController]
[Route("api/cloud/agent")]
[AllowAnonymous]
public class CloudAgentController(CloudServerService cloudServers) : ControllerBase
{
    [HttpPost("heartbeat")]
    public async Task<IActionResult> Heartbeat([FromBody] AgentAuthRequest body)
    {
        if (body.ServerId <= 0) return ApiResults.Error(400, "server_id is required", "VALIDATION_ERROR");
        var ok = await cloudServers.HeartbeatAsync(body.ServerId, body.Password);
        if (!ok) return ApiResults.Error(401, "Invalid server id or password", "UNAUTHORIZED");
        return Ok(new { message = "Heartbeat received", online = true });
    }

    [HttpPost("jobs/poll")]
    public async Task<IActionResult> PollJobs([FromBody] AgentAuthRequest body)
    {
        if (body.ServerId <= 0) return ApiResults.Error(400, "server_id is required", "VALIDATION_ERROR");
        if (!await cloudServers.VerifyAccessAsync(body.ServerId, body.Password))
            return ApiResults.Error(401, "Invalid server id or password", "UNAUTHORIZED");

        var jobs = await cloudServers.PollJobsAsync(body.ServerId, body.Password);
        return Ok(new { jobs });
    }

    [HttpPost("jobs/{id:int}/status")]
    public async Task<IActionResult> UpdateJobStatus(int id, [FromBody] AgentJobStatusRequest body)
    {
        if (body.ServerId <= 0) return ApiResults.Error(400, "server_id is required", "VALIDATION_ERROR");
        var (ok, error) = await cloudServers.UpdateJobAsync(
            id, body.ServerId, body.Password, body.Status ?? "", body.Error);
        if (!ok && error == "Invalid server credentials")
            return ApiResults.Error(401, error, "UNAUTHORIZED");
        if (!ok) return ApiResults.Error(404, error ?? "Update failed", "NOT_FOUND");
        return Ok(new { message = "Job updated" });
    }

    public record AgentAuthRequest(int ServerId, string? Password);
    public record AgentJobStatusRequest(int ServerId, string? Password, string? Status, string? Error);
}
