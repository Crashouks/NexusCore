using MySqlConnector;

namespace NexusCore.Api.Services;

public class DbService(IConfiguration config)
{
    public string ConnectionString =>
        $"Server={Get("DB_HOST", "localhost")};User={Get("DB_USER", "root")};Password={Get("DB_PASSWORD", "")};Database={Get("DB_NAME", "nexuscore")};";

    public MySqlConnection CreateConnection() => new(ConnectionString);

    private string Get(string key, string fallback) =>
        Environment.GetEnvironmentVariable(key) ?? config[key] ?? fallback;
}
