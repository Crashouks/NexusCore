using BCrypt.Net;
using Dapper;
using MySqlConnector;
using NexusCore.Api.Helpers;

namespace NexusCore.Api.Services;

public class CloudServerService(DbService db, IConfiguration config)
{
    private const int HeartbeatTimeoutSeconds = 90;

    private int FallbackSlots => int.TryParse(
        Environment.GetEnvironmentVariable("FREE_CLOUD_SLOTS") ?? config["FREE_CLOUD_SLOTS"], out var n) ? n : 3;

    public async Task EnsureSchemaAsync(MySqlConnection conn)
    {
        await conn.ExecuteAsync(@"
            CREATE TABLE IF NOT EXISTS cloud_servers (
              server_id INT PRIMARY KEY AUTO_INCREMENT,
              name VARCHAR(100) NOT NULL,
              host VARCHAR(255) NOT NULL,
              region VARCHAR(50) NOT NULL DEFAULT 'eu-central',
              gpu_model VARCHAR(100) DEFAULT 'RTX 4080',
              max_slots INT NOT NULL DEFAULT 1,
              account_username VARCHAR(100) NOT NULL DEFAULT '',
              account_secret VARCHAR(255) NOT NULL DEFAULT '',
              access_password_hash VARCHAR(255) DEFAULT NULL,
              status ENUM('online','offline','maintenance') NOT NULL DEFAULT 'offline',
              notes TEXT,
              created_at DATETIME DEFAULT NOW(),
              last_heartbeat DATETIME DEFAULT NULL
            )");
        try { await conn.ExecuteAsync("ALTER TABLE cloud_sessions ADD COLUMN server_id INT DEFAULT NULL"); }
        catch (MySqlException ex) when (ex.Number == 1060) { }
        try { await conn.ExecuteAsync("ALTER TABLE cloud_servers ADD COLUMN access_password_hash VARCHAR(255) DEFAULT NULL"); }
        catch (MySqlException ex) when (ex.Number == 1060) { }
        try { await conn.ExecuteAsync("ALTER TABLE cloud_servers ADD COLUMN server_tier ENUM('free_fake','paid_fake','real') NOT NULL DEFAULT 'real'"); }
        catch (MySqlException ex) when (ex.Number == 1060) { }
        try { await conn.ExecuteAsync("ALTER TABLE cloud_servers ADD COLUMN player_password_hash VARCHAR(255) DEFAULT NULL"); }
        catch (MySqlException ex) when (ex.Number == 1060) { }
        try { await conn.ExecuteAsync("ALTER TABLE cloud_sessions ADD COLUMN is_real_stream BOOLEAN NOT NULL DEFAULT FALSE"); }
        catch (MySqlException ex) when (ex.Number == 1060) { }
        try { await conn.ExecuteAsync("ALTER TABLE cloud_servers MODIFY account_username VARCHAR(100) NOT NULL DEFAULT ''"); }
        catch (MySqlException) { }
        try { await conn.ExecuteAsync("ALTER TABLE cloud_servers MODIFY account_secret VARCHAR(255) NOT NULL DEFAULT ''"); }
        catch (MySqlException) { }

        await SeedFakeServersAsync(conn);

        await conn.ExecuteAsync(@"
            CREATE TABLE IF NOT EXISTS cloud_server_games (
              server_id INT NOT NULL,
              game_id INT NOT NULL,
              executable_path VARCHAR(512) NOT NULL,
              PRIMARY KEY (server_id, game_id),
              FOREIGN KEY (server_id) REFERENCES cloud_servers(server_id) ON DELETE CASCADE,
              FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
            )");

        await conn.ExecuteAsync(@"
            CREATE TABLE IF NOT EXISTS cloud_agent_jobs (
              job_id INT PRIMARY KEY AUTO_INCREMENT,
              session_id INT NOT NULL,
              server_id INT NOT NULL,
              game_id INT NOT NULL,
              job_type ENUM('launch','stop') NOT NULL,
              executable_path VARCHAR(512) DEFAULT NULL,
              status ENUM('pending','running','done','failed','cancelled') NOT NULL DEFAULT 'pending',
              error_message VARCHAR(500) DEFAULT NULL,
              created_at DATETIME DEFAULT NOW(),
              processed_at DATETIME DEFAULT NULL,
              FOREIGN KEY (session_id) REFERENCES cloud_sessions(session_id) ON DELETE CASCADE,
              FOREIGN KEY (server_id) REFERENCES cloud_servers(server_id) ON DELETE CASCADE,
              FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
            )");
    }

    private async Task SeedFakeServersAsync(MySqlConnection conn)
    {
        var count = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM cloud_servers WHERE server_tier IN ('free_fake','paid_fake')");
        if (count > 0) return;

        await conn.ExecuteAsync(@"
            INSERT INTO cloud_servers (name, host, region, gpu_model, max_slots, account_username, account_secret, server_tier, status, notes) VALUES
            ('NexusCore Free EU', 'free-eu.nexuscore.cloud', 'eu-west', 'Cloud GPU', 50, '', '', 'free_fake', 'online', 'Shared free tier — simulated stream'),
            ('NexusCore Free US', 'free-us.nexuscore.cloud', 'us-east', 'Cloud GPU', 50, '', '', 'free_fake', 'online', 'Shared free tier — simulated stream'),
            ('NexusCore RTX Pro', 'pro.nexuscore.cloud', 'eu-central', 'RTX 4080', 20, '', '', 'paid_fake', 'online', 'Premium datacenter — simulated stream, paid plan required')");
    }

    public async Task<IEnumerable<object>> ListPublicServersAsync(int? gameId, string cloudPlan)
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var rows = (await conn.QueryAsync<dynamic>(@"
            SELECT s.server_id, s.name, s.region, s.gpu_model, s.max_slots, s.server_tier, s.status, s.last_heartbeat,
                   (s.player_password_hash IS NOT NULL AND s.player_password_hash != '') AS requires_player_password,
                   (SELECT COUNT(*) FROM cloud_sessions cs WHERE cs.server_id=s.server_id AND cs.status='active') AS active_sessions,
                   CASE WHEN @gid IS NULL OR @gid = 0 THEN TRUE
                   WHEN s.server_tier = 'real' THEN
                     EXISTS(SELECT 1 FROM cloud_server_games sg WHERE sg.server_id=s.server_id AND sg.game_id=@gid)
                   WHEN (SELECT COUNT(*) FROM cloud_server_games sg0 WHERE sg0.server_id=s.server_id) = 0 THEN TRUE
                   ELSE
                     EXISTS(SELECT 1 FROM cloud_server_games sg WHERE sg.server_id=s.server_id AND sg.game_id=@gid)
                   END AS has_game
            FROM cloud_servers s
            ORDER BY FIELD(s.server_tier,'free_fake','paid_fake','real'), s.name",
            new { gid = gameId ?? 0 })).ToList();

        var paidPlans = new HashSet<string> { "starter", "pro", "ultimate" };
        var list = new List<object>();
        foreach (var s in rows)
        {
            var tier = (string)s.server_tier;
            var status = (string)s.status;
            var hasGame = DbValue.IsTrue(s.has_game);
            var requiresPaid = tier == "paid_fake";
            var hasPaidPlan = paidPlans.Contains(cloudPlan);
            var requiresPassword = DbValue.IsTrue(s.requires_player_password);
            var isReal = tier == "real";
            var agentLive = isReal && s.last_heartbeat != null &&
                Convert.ToDateTime(s.last_heartbeat) >= DateTime.UtcNow.AddSeconds(-HeartbeatTimeoutSeconds);

            string availability;
            if (!hasGame && gameId.HasValue) availability = "no_game";
            else if (tier == "paid_fake" && !hasPaidPlan) availability = "plan_required";
            else if (status == "maintenance") availability = requiresPassword ? "password_required" : "maintenance";
            else if (isReal && status != "online") availability = "offline";
            else if (isReal && !agentLive) availability = "offline";
            else if (isReal && (int)s.active_sessions >= (int)s.max_slots) availability = "full";
            else if (requiresPassword) availability = "password_required";
            else availability = "available";

            list.Add(new
            {
                server_id = (int)s.server_id,
                name = (string)s.name,
                region = (string)s.region,
                gpu_model = s.gpu_model as string,
                server_tier = tier,
                status,
                is_fake = tier is "free_fake" or "paid_fake",
                is_real = isReal,
                requires_paid_plan = requiresPaid,
                requires_player_password = requiresPassword,
                availability,
                active_sessions = (int)s.active_sessions,
                max_slots = (int)s.max_slots,
            });
        }
        return list;
    }

    public async Task<(dynamic? server, string? error)> ResolveServerForSessionAsync(
        MySqlConnection conn, int serverId, int gameId, string cloudPlan, string? playerPassword)
    {
        var rows = (await conn.QueryAsync<dynamic>(@"
            SELECT s.*,
              (SELECT COUNT(*) FROM cloud_sessions cs WHERE cs.server_id=s.server_id AND cs.status='active') AS active_count,
              (SELECT executable_path FROM cloud_server_games sg WHERE sg.server_id=s.server_id AND sg.game_id=@gid LIMIT 1) AS executable_path
            FROM cloud_servers s WHERE s.server_id=@id",
            new { id = serverId, gid = gameId })).ToList();
        if (rows.Count == 0) return (null, "Server not found");

        var s = rows[0];
        var tier = (string)s.server_tier;
        var paidPlans = new HashSet<string> { "starter", "pro", "ultimate" };

        if (tier == "paid_fake" && !paidPlans.Contains(cloudPlan))
            return (null, "Paid cloud plan required for this server");

        if (tier == "real")
        {
            if (s.executable_path == null || string.IsNullOrWhiteSpace((string)s.executable_path))
                return (null, "This game is not installed on the selected machine");
            if ((string)s.status == "offline")
                return (null, "Server is offline");
            if ((int)s.active_count >= (int)s.max_slots)
                return (null, "Server is at capacity");
            var agentLive = s.last_heartbeat != null &&
                Convert.ToDateTime(s.last_heartbeat) >= DateTime.UtcNow.AddSeconds(-HeartbeatTimeoutSeconds);
            if (!agentLive)
                return (null, "Machine agent is not connected — start the agent on the host PC");
        }

        var playerHash = s.player_password_hash as string;
        var needsPassword = !string.IsNullOrEmpty(playerHash) || (string)s.status == "maintenance";
        if (needsPassword)
        {
            if (string.IsNullOrEmpty(playerHash))
            {
                if ((string)s.status == "maintenance")
                    return (null, "Server is under maintenance");
            }
            else if (string.IsNullOrEmpty(playerPassword) || !BCrypt.Net.BCrypt.Verify(playerPassword, playerHash))
                return (null, "Incorrect server password");
        }
        else if ((string)s.status == "maintenance")
            return (null, "Server is under maintenance");

        return (s, null);
    }

    public async Task<bool> VerifyPlayerPasswordAsync(int serverId, string? password)
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var hash = await conn.ExecuteScalarAsync<string?>(
            "SELECT player_password_hash FROM cloud_servers WHERE server_id=@id", new { id = serverId });
        if (string.IsNullOrEmpty(hash)) return true;
        if (string.IsNullOrEmpty(password)) return false;
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }

    public async Task<bool> HasRegisteredServersAsync(MySqlConnection conn) =>
        await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM cloud_servers") > 0;

    public async Task<int> GetTotalCapacityAsync(MySqlConnection conn)
    {
        var onlineSlots = await conn.ExecuteScalarAsync<int?>(@"
            SELECT COALESCE(SUM(max_slots), 0) FROM cloud_servers
            WHERE status = 'online'
              AND last_heartbeat IS NOT NULL
              AND last_heartbeat >= DATE_SUB(NOW(), INTERVAL @sec SECOND)",
            new { sec = HeartbeatTimeoutSeconds });
        if (onlineSlots > 0) return onlineSlots.Value;

        if (await HasRegisteredServersAsync(conn)) return 0;
        return FallbackSlots;
    }

    public async Task<int> GetActiveSessionCountAsync(MySqlConnection conn) =>
        await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM cloud_sessions WHERE status = 'active'");

    public async Task<bool> HasAvailableSlotAsync(MySqlConnection conn)
    {
        var capacity = await GetTotalCapacityAsync(conn);
        if (capacity <= 0) return false;
        return await GetActiveSessionCountAsync(conn) < capacity;
    }

    public async Task<dynamic?> PickServerForSessionAsync(MySqlConnection conn, int gameId)
    {
        var servers = (await conn.QueryAsync<dynamic>(@"
            SELECT s.*, sg.executable_path,
              (SELECT COUNT(*) FROM cloud_sessions cs
               WHERE cs.server_id = s.server_id AND cs.status = 'active') AS active_count
            FROM cloud_servers s
            INNER JOIN cloud_server_games sg ON sg.server_id = s.server_id AND sg.game_id = @gid
            WHERE s.status = 'online'
              AND s.last_heartbeat IS NOT NULL
              AND s.last_heartbeat >= DATE_SUB(NOW(), INTERVAL @sec SECOND)
            HAVING active_count < s.max_slots
            ORDER BY active_count ASC, s.server_id ASC
            LIMIT 1", new { gid = gameId, sec = HeartbeatTimeoutSeconds })).ToList();

        return servers.Count > 0 ? servers[0] : null;
    }

    public async Task<bool> VerifyAccessAsync(int serverId, string? password)
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var hash = await conn.ExecuteScalarAsync<string?>(
            "SELECT access_password_hash FROM cloud_servers WHERE server_id = @id", new { id = serverId });
        if (string.IsNullOrEmpty(hash)) return false;
        if (string.IsNullOrEmpty(password)) return false;
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }

    public async Task<bool> HeartbeatAsync(int serverId, string? password)
    {
        if (!await VerifyAccessAsync(serverId, password)) return false;
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        await conn.ExecuteAsync(@"
            UPDATE cloud_servers SET last_heartbeat = NOW(), status = 'online'
            WHERE server_id = @id AND status != 'maintenance'", new { id = serverId });
        return true;
    }

    public async Task<long> EnqueueLaunchJobAsync(MySqlConnection conn, int sessionId, int serverId, int gameId, string executablePath) =>
        await conn.ExecuteScalarAsync<long>(@"
            INSERT INTO cloud_agent_jobs (session_id, server_id, game_id, job_type, executable_path, status)
            VALUES (@sid, @srv, @gid, 'launch', @path, 'pending');
            SELECT LAST_INSERT_ID();",
            new { sid = sessionId, srv = serverId, gid = gameId, path = executablePath });

    public async Task EnqueueStopJobAsync(MySqlConnection conn, int sessionId, int serverId, int gameId)
    {
        await conn.ExecuteAsync(@"
            INSERT INTO cloud_agent_jobs (session_id, server_id, game_id, job_type, status)
            VALUES (@sid, @srv, @gid, 'stop', 'pending')",
            new { sid = sessionId, srv = serverId, gid = gameId });
    }

    /// <summary>Ends an active session when the game process exits on the agent host.</summary>
    public async Task<(bool ok, string? error, string? plan)> EndSessionByAgentAsync(
        int sessionId, int serverId, string? password)
    {
        if (!await VerifyAccessAsync(serverId, password)) return (false, "Invalid server credentials", null);

        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var sessionsList = (await conn.QueryAsync<dynamic>(@"
            SELECT session_id, plan, started_at FROM cloud_sessions
            WHERE session_id=@sid AND server_id=@srv AND status='active'",
            new { sid = sessionId, srv = serverId })).ToList();
        if (sessionsList.Count == 0) return (false, "Session not found or already ended", null);

        var s = sessionsList[0];
        var duration = await conn.ExecuteScalarAsync<int>(
            "SELECT TIMESTAMPDIFF(MINUTE, @start, NOW())", new { start = s.started_at });
        await conn.ExecuteAsync(@"
            UPDATE cloud_sessions SET status='ended', ended_at=NOW(), duration_mins=@dur
            WHERE session_id=@id",
            new { dur = duration, id = sessionId });
        return (true, null, (string)s.plan);
    }

    public async Task<IEnumerable<dynamic>> PollJobsAsync(int serverId, string? password)
    {
        if (!await VerifyAccessAsync(serverId, password)) return [];
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        return await conn.QueryAsync(@"
            SELECT job_id, session_id, game_id, job_type, executable_path, status, created_at
            FROM cloud_agent_jobs
            WHERE server_id = @id AND status = 'pending'
            ORDER BY created_at ASC LIMIT 10", new { id = serverId });
    }

    public async Task<(bool ok, string? error)> UpdateJobAsync(int jobId, int serverId, string? password, string status, string? errorMessage)
    {
        if (!await VerifyAccessAsync(serverId, password)) return (false, "Invalid server credentials");
        var normalized = status.ToLowerInvariant() switch
        {
            "running" => "running",
            "done" => "done",
            "failed" => "failed",
            _ => null
        };
        if (normalized == null) return (false, "Invalid status");

        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var updated = await conn.ExecuteAsync(@"
            UPDATE cloud_agent_jobs SET status = @status, error_message = @err, processed_at = NOW()
            WHERE job_id = @jid AND server_id = @sid AND status IN ('pending','running')",
            new { status = normalized, err = errorMessage, jid = jobId, sid = serverId });
        return updated > 0 ? (true, null) : (false, "Job not found");
    }

    public async Task<IEnumerable<dynamic>> ListForAdminAsync()
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        return await conn.QueryAsync(@"
            SELECT s.server_id, s.name, s.host, s.region, s.gpu_model, s.max_slots, s.server_tier,
                   s.account_username, s.status, s.notes, s.created_at, s.last_heartbeat,
                   (s.access_password_hash IS NOT NULL AND s.access_password_hash != '') AS has_password,
                   (s.player_password_hash IS NOT NULL AND s.player_password_hash != '') AS has_player_password,
                   (SELECT COUNT(*) FROM cloud_sessions cs
                    WHERE cs.server_id = s.server_id AND cs.status = 'active') AS active_sessions,
                   (SELECT COUNT(*) FROM cloud_server_games sg WHERE sg.server_id = s.server_id) AS game_count,
                   (SELECT GROUP_CONCAT(g.name ORDER BY g.name SEPARATOR ', ')
                    FROM cloud_server_games sg
                    JOIN games g ON g.game_id = sg.game_id
                    WHERE sg.server_id = s.server_id) AS game_names
            FROM cloud_servers s ORDER BY s.region, s.name");
    }

    public async Task<dynamic?> GetByIdAsync(int id)
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var rows = (await conn.QueryAsync(@"
            SELECT s.server_id, s.name, s.host, s.region, s.gpu_model, s.max_slots, s.server_tier,
                   s.account_username, s.status, s.notes, s.created_at, s.last_heartbeat,
                   (s.access_password_hash IS NOT NULL AND s.access_password_hash != '') AS has_password,
                   (s.player_password_hash IS NOT NULL AND s.player_password_hash != '') AS has_player_password,
                   (SELECT COUNT(*) FROM cloud_sessions cs
                    WHERE cs.server_id = s.server_id AND cs.status = 'active') AS active_sessions
            FROM cloud_servers s WHERE s.server_id = @id", new { id })).ToList();
        return rows.Count > 0 ? rows[0] : null;
    }

    public async Task<IEnumerable<dynamic>> ListGameMappingsAsync(int serverId)
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        return await conn.QueryAsync(@"
            SELECT sg.game_id, g.name AS game_name, g.slug, sg.executable_path
            FROM cloud_server_games sg
            JOIN games g ON g.game_id = sg.game_id
            WHERE sg.server_id = @id ORDER BY g.name", new { id = serverId });
    }

    public async Task SetGameMappingsAsync(int serverId, IEnumerable<GameMappingInput> mappings)
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        await using var tx = await conn.BeginTransactionAsync();
        await conn.ExecuteAsync("DELETE FROM cloud_server_games WHERE server_id = @id", new { id = serverId }, tx);
        foreach (var m in mappings.Where(m => m.GameId > 0))
        {
            await conn.ExecuteAsync(@"
                INSERT INTO cloud_server_games (server_id, game_id, executable_path)
                VALUES (@sid, @gid, @path)",
                new { sid = serverId, gid = m.GameId, path = (m.ExecutablePath ?? "").Trim() }, tx);
        }
        await tx.CommitAsync();
    }

    public async Task<int> CreateAsync(CloudServerInput input)
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var accessHash = HashOptionalPassword(input.AccessPassword);
        var playerHash = HashOptionalPassword(input.PlayerPassword);
        var tier = NormalizeTier(input.ServerTier);
        return await conn.ExecuteScalarAsync<int>(@"
            INSERT INTO cloud_servers
              (name, host, region, gpu_model, max_slots, account_username, account_secret,
               access_password_hash, player_password_hash, server_tier, status, notes)
            VALUES (@name, @host, @region, @gpu, @slots, @user, @secret, @pass, @ppass, @tier, @status, @notes);
            SELECT LAST_INSERT_ID();",
            new
            {
                name = input.Name.Trim(),
                host = input.Host.Trim(),
                region = string.IsNullOrWhiteSpace(input.Region) ? "eu-central" : input.Region.Trim(),
                gpu = string.IsNullOrWhiteSpace(input.GpuModel) ? "RTX 4080" : input.GpuModel.Trim(),
                slots = Math.Max(1, input.MaxSlots),
                user = input.AccountUsername?.Trim() ?? "",
                secret = input.AccountSecret ?? "",
                pass = accessHash,
                ppass = playerHash,
                tier,
                status = NormalizeStatus(input.Status),
                notes = input.Notes
            });
    }

    public async Task<bool> UpdateAsync(int id, CloudServerUpdate input)
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        if (await conn.ExecuteScalarAsync<int?>("SELECT server_id FROM cloud_servers WHERE server_id = @id", new { id }) == null)
            return false;

        var sets = new List<string>();
        var param = new DynamicParameters();
        param.Add("id", id);

        if (input.Name != null) { sets.Add("name = @name"); param.Add("name", input.Name.Trim()); }
        if (input.Host != null) { sets.Add("host = @host"); param.Add("host", input.Host.Trim()); }
        if (input.Region != null) { sets.Add("region = @region"); param.Add("region", input.Region.Trim()); }
        if (input.GpuModel != null) { sets.Add("gpu_model = @gpu"); param.Add("gpu", input.GpuModel.Trim()); }
        if (input.MaxSlots.HasValue) { sets.Add("max_slots = @slots"); param.Add("slots", Math.Max(1, input.MaxSlots.Value)); }
        if (input.AccountUsername != null) { sets.Add("account_username = @user"); param.Add("user", input.AccountUsername.Trim()); }
        if (input.AccountSecret != null) { sets.Add("account_secret = @secret"); param.Add("secret", input.AccountSecret); }
        if (input.Status != null) { sets.Add("status = @status"); param.Add("status", NormalizeStatus(input.Status)); }
        if (input.Notes != null) { sets.Add("notes = @notes"); param.Add("notes", input.Notes); }
        if (input.AccessPassword != null)
        {
            sets.Add("access_password_hash = @pass");
            param.Add("pass", HashOptionalPassword(input.AccessPassword));
        }
        if (input.PlayerPassword != null)
        {
            sets.Add("player_password_hash = @ppass");
            param.Add("ppass", HashOptionalPassword(input.PlayerPassword));
        }
        if (input.ServerTier != null)
        {
            sets.Add("server_tier = @tier");
            param.Add("tier", NormalizeTier(input.ServerTier));
        }

        if (sets.Count == 0) return true;
        await conn.ExecuteAsync($"UPDATE cloud_servers SET {string.Join(", ", sets)} WHERE server_id = @id", param);
        return true;
    }

    public async Task<(bool ok, string? error)> DeleteAsync(int id)
    {
        await using var conn = db.CreateConnection();
        await conn.OpenAsync();
        var active = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM cloud_sessions WHERE server_id = @id AND status = 'active'", new { id });
        if (active > 0) return (false, "Cannot delete server with active streaming sessions");
        var deleted = await conn.ExecuteAsync("DELETE FROM cloud_servers WHERE server_id = @id", new { id });
        return deleted > 0 ? (true, null) : (false, "Server not found");
    }

    private static string? HashOptionalPassword(string? password)
    {
        if (password == null) return null;
        if (string.IsNullOrWhiteSpace(password)) return "";
        return BCrypt.Net.BCrypt.HashPassword(password.Trim(), 10);
    }

    private static string NormalizeTier(string? tier) =>
        tier?.Trim().ToLowerInvariant() switch
        {
            "free_fake" => "free_fake",
            "paid_fake" => "paid_fake",
            _ => "real"
        };

    private static string NormalizeStatus(string? status) =>
        status?.Trim().ToLowerInvariant() switch
        {
            "online" => "online",
            "maintenance" => "maintenance",
            _ => "offline"
        };

    public record CloudServerInput(
        string Name, string Host, string? Region, string? GpuModel,
        int MaxSlots, string? AccountUsername, string? AccountSecret,
        string? AccessPassword, string? PlayerPassword, string? ServerTier,
        string? Status, string? Notes);

    public record CloudServerUpdate(
        string? Name, string? Host, string? Region, string? GpuModel,
        int? MaxSlots, string? AccountUsername, string? AccountSecret,
        string? AccessPassword, string? PlayerPassword, string? ServerTier,
        string? Status, string? Notes);

    public record GameMappingInput(int GameId, string ExecutablePath);
}
