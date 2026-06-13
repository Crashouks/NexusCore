using System.Diagnostics;

namespace NexusCore.Api.Helpers;

public static class ExecutableBrowse
{
    public static string? PickWindowsExecutable(string scriptPath)
    {
        if (!OperatingSystem.IsWindows())
            return null;
        if (!File.Exists(scriptPath))
            return null;

        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -ExecutionPolicy Bypass -Sta -File \"{scriptPath}\"",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
        process.Start();
        var output = process.StandardOutput.ReadToEnd().Trim();
        process.WaitForExit(TimeSpan.FromMinutes(2));
        return string.IsNullOrWhiteSpace(output) ? null : output;
    }
}
