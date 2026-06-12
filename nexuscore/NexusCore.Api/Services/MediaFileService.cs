namespace NexusCore.Api.Services;

public class MediaFileService(IWebHostEnvironment env)
{
    private static readonly Dictionary<string, string> MimeToExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = "jpg",
        ["image/jpg"] = "jpg",
        ["image/png"] = "png",
        ["image/webp"] = "webp",
        ["image/gif"] = "gif",
    };

    public string UploadsDirectory => Path.Combine(env.ContentRootPath, "uploads");

    /// <summary>Lab naming: game_image_35.jpg</summary>
    public static string BuildGameImageFileName(int gameId, string? originalFileName, string? contentType)
    {
        var ext = ResolveExtension(originalFileName, contentType);
        return $"game_image_{gameId}.{ext}";
    }

    public async Task<(string fileName, string fullPath, string url)> SaveGameImageAsync(
        int gameId, IFormFile file, CancellationToken ct = default)
    {
        Directory.CreateDirectory(UploadsDirectory);
        var fileName = BuildGameImageFileName(gameId, file.FileName, file.ContentType);
        var fullPath = Path.Combine(UploadsDirectory, fileName);

        var existing = Directory.GetFiles(UploadsDirectory, $"game_image_{gameId}.*");
        foreach (var old in existing)
        {
            if (!string.Equals(old, fullPath, StringComparison.OrdinalIgnoreCase))
                File.Delete(old);
        }

        await using var stream = File.Create(fullPath);
        await file.CopyToAsync(stream, ct);
        return (fileName, fullPath, $"/uploads/{fileName}");
    }

    public string? FindGameImagePath(int gameId)
    {
        if (!Directory.Exists(UploadsDirectory)) return null;
        return Directory.GetFiles(UploadsDirectory, $"game_image_{gameId}.*").FirstOrDefault();
    }

    public const long AvatarMaxBytes = 10 * 1024 * 1024;

    public static string BuildAvatarFileName(int userId, string? originalFileName, string? contentType)
    {
        var ext = ResolveExtension(originalFileName, contentType);
        return $"avatar_{userId}.{ext}";
    }

    public async Task<(string fileName, string fullPath, string url)> SaveAvatarAsync(
        int userId, IFormFile file, CancellationToken ct = default)
    {
        if (file.Length > AvatarMaxBytes)
            throw new InvalidOperationException("Avatar must be 10 MB or smaller");

        Directory.CreateDirectory(UploadsDirectory);
        var fileName = BuildAvatarFileName(userId, file.FileName, file.ContentType);
        var fullPath = Path.Combine(UploadsDirectory, fileName);

        foreach (var old in Directory.GetFiles(UploadsDirectory, $"avatar_{userId}.*"))
        {
            if (!string.Equals(old, fullPath, StringComparison.OrdinalIgnoreCase))
                File.Delete(old);
        }

        await using var stream = File.Create(fullPath);
        await file.CopyToAsync(stream, ct);
        return (fileName, fullPath, $"/uploads/{fileName}");
    }

    private static string ResolveExtension(string? originalFileName, string? contentType)
    {
        var ext = Path.GetExtension(originalFileName ?? "").TrimStart('.').ToLowerInvariant();
        if (ext == "jpeg") ext = "jpg";
        if (!string.IsNullOrEmpty(ext) && ext.Length <= 5) return ext;
        if (contentType != null && MimeToExt.TryGetValue(contentType, out var mapped)) return mapped;
        return "jpg";
    }
}
