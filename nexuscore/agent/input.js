const { execFile } = require('child_process');

function runPs(script) {
  execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], () => {});
}

function handleInput(input) {
  if (process.platform !== 'win32') return;
  const t = input.type;
  if (t === 'move' && input.x != null && input.y != null) {
    runPs(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${input.x}, ${input.y})`);
    return;
  }
  if (t === 'mousedown' || t === 'mouseup') {
    const down = t === 'mousedown';
    const flag = input.button === 'right' ? (down ? '0x0008' : '0x0010') : (down ? '0x0002' : '0x0004');
    runPs(`Add-Type -AssemblyName System.Windows.Forms; $sig='[DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);'; Add-Type -MemberDefinition $sig -Name Win32Mouse -Namespace Win32; [Win32.Win32Mouse]::mouse_event(${flag},0,0,0,0)`);
    return;
  }
  if (t === 'keydown' || t === 'keyup') {
    const key = String(input.key || '').replace(/'/g, "''");
    if (!key || key.length > 1) return;
    runPs(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${key}')`);
  }
}

module.exports = { handleInput };
