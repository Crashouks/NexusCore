param(
  [ValidateSet('Find', 'Capture')]
  [string]$Mode = 'Find',
  [int]$ProcessId = 0,
  [IntPtr]$Hwnd = [IntPtr]::Zero,
  [int]$Quality = 45
)

Add-Type @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public static class WinCap {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left, Top, Right, Bottom;
  }

  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, int nFlags);

  public static IntPtr FindMainWindow(int pid) {
    IntPtr best = IntPtr.Zero;
    int bestArea = 0;
    EnumWindows((hWnd, _) => {
      uint wpid;
      GetWindowThreadProcessId(hWnd, out wpid);
      if ((int)wpid != pid || !IsWindowVisible(hWnd)) return true;
      RECT r;
      if (!GetWindowRect(hWnd, out r)) return true;
      int w = r.Right - r.Left;
      int h = r.Bottom - r.Top;
      if (w < 200 || h < 200) return true;
      int area = w * h;
      if (area > bestArea) { bestArea = area; best = hWnd; }
      return true;
    }, IntPtr.Zero);
    return best;
  }

  public static string DescribeWindow(IntPtr hWnd) {
    RECT r;
    GetWindowRect(hWnd, out r);
    var sb = new StringBuilder(512);
    GetWindowText(hWnd, sb, sb.Capacity);
    return string.Format("{0}|{1}|{2}|{3}|{4}|{5}",
      hWnd.ToInt64(), r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top, sb.ToString().Replace("|", " "));
  }

  public static string CaptureJpegBase64(IntPtr hWnd, long quality) {
    RECT r;
    GetWindowRect(hWnd, out r);
    int w = r.Right - r.Left;
    int h = r.Bottom - r.Top;
    if (w < 1 || h < 1) return "FAIL";
    using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
    using (var g = Graphics.FromImage(bmp)) {
      var hdc = g.GetHdc();
      PrintWindow(hWnd, hdc, 2);
      g.ReleaseHdc(hdc);
      var codec = Array.Find(ImageCodecInfo.GetImageEncoders(), c => c.FormatID == ImageFormat.Jpeg.Guid);
      var ep = new EncoderParameters(1);
      ep.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
      using (var ms = new MemoryStream()) {
        bmp.Save(ms, codec, ep);
        return Convert.ToBase64String(ms.ToArray());
      }
    }
  }
}
"@

if ($Mode -eq 'Find') {
  $hwnd = [WinCap]::FindMainWindow($ProcessId)
  if ($hwnd -eq [IntPtr]::Zero) { Write-Output 'NONE'; exit 0 }
  Write-Output ([WinCap]::DescribeWindow($hwnd))
  exit 0
}

if ($Mode -eq 'Capture') {
  if ($Hwnd -eq [IntPtr]::Zero) { Write-Output 'FAIL'; exit 1 }
  Write-Output ([WinCap]::CaptureJpegBase64($Hwnd, [long]$Quality))
  exit 0
}
