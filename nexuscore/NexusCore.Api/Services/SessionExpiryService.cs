using Dapper;
using MySqlConnector;

namespace NexusCore.Api.Services;

public class SessionExpiryService(DbService db)
{
    public async Task PromoteQueueAsync(MySqlConnection? conn = null, MySqlTransaction? tx = null)
    {
        var ownConn = conn == null;
        conn ??= db.CreateConnection();
        if (ownConn) await conn.OpenAsync();
        await conn.ExecuteAsync(
            @"UPDATE cloud_queue SET status='ready', notified_at=NOW(),
              expires_at=DATE_ADD(NOW(), INTERVAL 5 MINUTE)
              WHERE status='waiting' ORDER BY joined_at ASC LIMIT 1", transaction: tx);
        if (ownConn) await conn.DisposeAsync();
    }

    public async Task ExpireReadySlotsAsync()
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var expired = (await conn.QueryAsync<dynamic>(
            "SELECT queue_id FROM cloud_queue WHERE status='ready' AND expires_at < NOW()")).ToList();
        foreach (var row in expired)
        {
            await conn.ExecuteAsync("UPDATE cloud_queue SET status='expired' WHERE queue_id=@id",
                new { id = (int)row.queue_id });
            await PromoteQueueAsync(conn);
        }
    }
}
