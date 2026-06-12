using System.Text.RegularExpressions;

namespace NexusCore.Api.Services;

public static partial class Slugify
{
    public static string FromName(string name) =>
        MyRegex().Replace(name.ToLowerInvariant().Replace(' ', '-'), "");

    [GeneratedRegex(@"[^a-z0-9-]")]
    private static partial Regex MyRegex();
}
