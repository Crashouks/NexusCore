using Dapper;

namespace NexusCore.Api.Services;

public class NotificationService(DbService db)
{
    public async Task EnsureSchemaAsync()
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        await conn.ExecuteAsync(@"
            CREATE TABLE IF NOT EXISTS notifications (
              notification_id INT PRIMARY KEY AUTO_INCREMENT,
              user_id INT NOT NULL,
              type VARCHAR(32) NOT NULL,
              message VARCHAR(255) NOT NULL,
              link VARCHAR(255) NULL,
              is_read BOOLEAN NOT NULL DEFAULT FALSE,
              created_at DATETIME NOT NULL DEFAULT NOW(),
              ref_user_id INT NULL,
              ref_game_id INT NULL,
              FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
              INDEX idx_notifications_user (user_id, is_read, created_at)
            )");
    }

    public async Task CreateAsync(int userId, string type, string message, string? link = null,
        int? refUserId = null, int? refGameId = null)
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        await conn.ExecuteAsync(@"
            INSERT INTO notifications (user_id, type, message, link, ref_user_id, ref_game_id)
            VALUES (@uid, @type, @msg, @link, @refUser, @refGame)",
            new { uid = userId, type, msg = message, link, refUser = refUserId, refGame = refGameId });
    }

    public async Task CreateAsync(System.Data.IDbConnection conn, System.Data.IDbTransaction? tx,
        int userId, string type, string message, string? link = null,
        int? refUserId = null, int? refGameId = null)
    {
        await conn.ExecuteAsync(@"
            INSERT INTO notifications (user_id, type, message, link, ref_user_id, ref_game_id)
            VALUES (@uid, @type, @msg, @link, @refUser, @refGame)",
            new { uid = userId, type, msg = message, link, refUser = refUserId, refGame = refGameId }, tx);
    }
}
