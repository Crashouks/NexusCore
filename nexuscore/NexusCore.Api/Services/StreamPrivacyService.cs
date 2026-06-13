using System.Collections.Concurrent;
using Dapper;
using NexusCore.Api.Helpers;

namespace NexusCore.Api.Services;

public class StreamPrivacyService(DbService db)
{
    private readonly ConcurrentDictionary<int, bool> _cache = new();

    public async Task<bool> GetAllowSpectatorsAsync(int sessionId)
    {
        if (_cache.TryGetValue(sessionId, out var cached))
            return cached;

        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT allow_spectators FROM cloud_sessions WHERE session_id=@id AND status='active'",
            new { id = sessionId });
        if (row == null)
        {
            _cache[sessionId] = false;
            return false;
        }

        var allow = DbValue.IsTrue(row.allow_spectators);
        _cache[sessionId] = allow;
        return allow;
    }

    public void SetCached(int sessionId, bool allow) => _cache[sessionId] = allow;

    public void Invalidate(int sessionId) => _cache.TryRemove(sessionId, out _);
}
