using System.Collections.Concurrent;

namespace NexusCore.Api.Services;

public class CloudDiagnosticsLog
{
    private const int MaxEntries = 250;
    private readonly ConcurrentQueue<Entry> _entries = new();

    public void Info(string source, string message, object? detail = null) => Add("info", source, message, detail);
    public void Warn(string source, string message, object? detail = null) => Add("warn", source, message, detail);
    public void Error(string source, string message, object? detail = null) => Add("error", source, message, detail);
    public void Debug(string source, string message, object? detail = null) => Add("debug", source, message, detail);

    public IReadOnlyList<Entry> Recent(int limit = 100)
    {
        var list = _entries.ToArray();
        if (limit >= list.Length) return list;
        return list.Skip(list.Length - limit).ToArray();
    }

    private void Add(string level, string source, string message, object? detail)
    {
        var entry = new Entry(DateTime.UtcNow, level, source, message, detail?.ToString());
        _entries.Enqueue(entry);
        while (_entries.Count > MaxEntries && _entries.TryDequeue(out _)) { }

        var detailSuffix = detail != null ? $" | {detail}" : "";
        Console.WriteLine($"[cloud:{level}] [{source}] {message}{detailSuffix}");
    }

    public record Entry(DateTime At, string Level, string Source, string Message, string? Detail);
}
