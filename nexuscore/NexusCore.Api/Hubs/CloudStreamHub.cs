using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using NexusCore.Api.Extensions;
using NexusCore.Api.Services;

namespace NexusCore.Api.Hubs;

public class CloudStreamHub(CloudServerService cloudServers, DbService db, CloudDiagnosticsLog diag) : Hub
{
    private static string PlayerGroup(int sessionId) => $"stream-p-{sessionId}";
    private static string AgentGroup(int sessionId) => $"stream-a-{sessionId}";

    public override Task OnConnectedAsync()
    {
        diag.Info("stream-hub", "Client connected", Context.ConnectionId);
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception != null)
            diag.Warn("stream-hub", "Client disconnected with error", exception.Message);
        else
            diag.Debug("stream-hub", "Client disconnected", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    [Authorize]
    public async Task PlayerJoin(int sessionId)
    {
        var userId = Context.User!.GetUserId();
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var ok = await conn.ExecuteScalarAsync<int?>(
            "SELECT 1 FROM cloud_sessions WHERE session_id=@sid AND user_id=@uid AND status='active'",
            new { sid = sessionId, uid = userId });
        if (ok == null)
        {
            diag.Warn("stream-hub", "PlayerJoin rejected — no active session", $"session={sessionId} user={userId}");
            throw new HubException("No active session");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, PlayerGroup(sessionId));
        diag.Info("stream-hub", "Player joined stream", $"session={sessionId} user={userId}");
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
        {
            diag.Warn("stream-hub", "AgentJoin rejected — bad credentials", $"server={serverId} session={sessionId}");
            throw new HubException("Invalid agent credentials");
        }

        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var match = await conn.ExecuteScalarAsync<int?>(
            "SELECT 1 FROM cloud_sessions WHERE session_id=@sid AND server_id=@srv AND status='active' AND is_real_stream=TRUE",
            new { sid = sessionId, srv = serverId });
        if (match == null)
        {
            diag.Warn("stream-hub", "AgentJoin rejected — session mismatch",
                $"session={sessionId} server={serverId} (session not active on this server?)");
            throw new HubException("Session not found");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, AgentGroup(sessionId));
        diag.Info("stream-hub", "Agent joined stream", $"session={sessionId} server={serverId}");
        await Clients.Group(PlayerGroup(sessionId)).SendAsync("StreamReady");
        await Clients.Caller.SendAsync("AgentJoined", sessionId);
    }

    public async Task SendFrame(int sessionId, int serverId, string? password, string frameBase64)
    {
        if (!await cloudServers.VerifyAccessAsync(serverId, password))
        {
            diag.Warn("stream-hub", "SendFrame rejected — bad credentials", $"server={serverId}");
            return;
        }
        if (string.IsNullOrEmpty(frameBase64)) return;
        await Clients.Group(PlayerGroup(sessionId)).SendAsync("ReceiveFrame", frameBase64);
    }

    public record StreamInput(string Type, int? X, int? Y, string? Button, string? Key, bool? Down, int? Vk);
}
