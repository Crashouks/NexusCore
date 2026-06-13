using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using NexusCore.Api.Extensions;
using NexusCore.Api.Services;

namespace NexusCore.Api.Hubs;

public class CloudStreamHub(CloudServerService cloudServers, DbService db) : Hub
{
    private static string PlayerGroup(int sessionId) => $"stream-p-{sessionId}";
    private static string AgentGroup(int sessionId) => $"stream-a-{sessionId}";

    [Authorize]
    public async Task PlayerJoin(int sessionId)
    {
        var userId = Context.User!.GetUserId();
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var ok = await conn.ExecuteScalarAsync<int?>(
            "SELECT 1 FROM cloud_sessions WHERE session_id=@sid AND user_id=@uid AND status='active'",
            new { sid = sessionId, uid = userId });
        if (ok == null) throw new HubException("No active session");

        await Groups.AddToGroupAsync(Context.ConnectionId, PlayerGroup(sessionId));
        await Clients.Caller.SendAsync("JoinedStream", sessionId);
    }

    [Authorize]
    public async Task SendInput(int sessionId, StreamInput input)
    {
        var userId = Context.User!.GetUserId();
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var ok = await conn.ExecuteScalarAsync<int?>(
            "SELECT 1 FROM cloud_sessions WHERE session_id=@sid AND user_id=@uid AND status='active' AND is_real_stream=TRUE",
            new { sid = sessionId, uid = userId });
        if (ok == null) return;

        await Clients.Group(AgentGroup(sessionId)).SendAsync("ReceiveInput", input);
    }

    public async Task AgentJoin(int sessionId, int serverId, string? password)
    {
        if (!await cloudServers.VerifyAccessAsync(serverId, password))
            throw new HubException("Invalid agent credentials");

        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var match = await conn.ExecuteScalarAsync<int?>(
            "SELECT 1 FROM cloud_sessions WHERE session_id=@sid AND server_id=@srv AND status='active' AND is_real_stream=TRUE",
            new { sid = sessionId, srv = serverId });
        if (match == null) throw new HubException("Session not found");

        await Groups.AddToGroupAsync(Context.ConnectionId, AgentGroup(sessionId));
        await Clients.Group(PlayerGroup(sessionId)).SendAsync("StreamReady");
        await Clients.Caller.SendAsync("AgentJoined", sessionId);
    }

    public async Task SendFrame(int sessionId, int serverId, string? password, string frameBase64)
    {
        if (!await cloudServers.VerifyAccessAsync(serverId, password)) return;
        if (string.IsNullOrEmpty(frameBase64)) return;
        await Clients.Group(PlayerGroup(sessionId)).SendAsync("ReceiveFrame", frameBase64);
    }

    public record StreamInput(string Type, int? X, int? Y, string? Button, string? Key, bool? Down);
}
