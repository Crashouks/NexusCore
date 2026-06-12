using Dapper;

namespace NexusCore.Api.Services;

public class ForumService(DbService db)
{
    public async Task EnsureForumSchemaAsync()
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        await conn.ExecuteAsync(@"
            CREATE TABLE IF NOT EXISTS forum_topics (
              topic_id INT PRIMARY KEY AUTO_INCREMENT,
              title VARCHAR(200) NOT NULL,
              created_by INT NOT NULL,
              created_at DATETIME NOT NULL DEFAULT NOW(),
              FOREIGN KEY (created_by) REFERENCES users(user_id)
            )");
        await conn.ExecuteAsync(@"
            CREATE TABLE IF NOT EXISTS forum_posts (
              post_id INT PRIMARY KEY AUTO_INCREMENT,
              topic_id INT NOT NULL,
              user_id INT NOT NULL,
              content TEXT NOT NULL,
              created_at DATETIME NOT NULL DEFAULT NOW(),
              FOREIGN KEY (topic_id) REFERENCES forum_topics(topic_id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(user_id),
              INDEX idx_forum_posts_topic (topic_id)
            )");
    }
}
