Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class InputInject {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

  public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP = 0x0004;
  public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
  public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
  public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
  public const uint MOUSEEVENTF_MIDDLEUP = 0x0040;

  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
  public const uint KEYEVENTF_KEYUP = 0x0002;

  public static void Click(int x, int y, string button, bool down) {
    SetCursorPos(x, y);
    uint flag = 0;
    if (button == "right") flag = down ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
    else if (button == "middle") flag = down ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;
    else flag = down ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
    mouse_event(flag, 0, 0, 0, 0);
  }

  public static void Key(int vk, bool down) {
    if (vk <= 0) return;
    keybd_event((byte)vk, 0, down ? 0u : KEYEVENTF_KEYUP, 0);
  }
}
"@

while ($null -ne ($line = [Console]::In.ReadLine())) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  try {
    $j = $line | ConvertFrom-Json
    switch ($j.type) {
      'move' {
        if ($null -ne $j.x -and $null -ne $j.y) {
          [InputInject]::SetCursorPos([int]$j.x, [int]$j.y) | Out-Null
        }
      }
      'mousedown' {
        if ($null -ne $j.x -and $null -ne $j.y) {
          [InputInject]::Click([int]$j.x, [int]$j.y, [string]$j.button, $true)
        }
      }
      'mouseup' {
        if ($null -ne $j.x -and $null -ne $j.y) {
          [InputInject]::Click([int]$j.x, [int]$j.y, [string]$j.button, $false)
        }
      }
      'keydown' {
        if ($null -ne $j.vk) { [InputInject]::Key([int]$j.vk, $true) }
      }
      'keyup' {
        if ($null -ne $j.vk) { [InputInject]::Key([int]$j.vk, $false) }
      }
    }
  } catch {}
}
