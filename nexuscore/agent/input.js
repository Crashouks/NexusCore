const { spawn } = require('child_process');
const path = require('path');
const log = require('./logger');

let bridge = null;
let mapCoords = (input) => input;

const VK = {
  Backspace: 0x08, Tab: 0x09, Enter: 0x0D, Escape: 0x1B, Space: 0x20,
  ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28,
  Delete: 0x2E,
  ShiftLeft: 0xA0, ShiftRight: 0xA1,
  ControlLeft: 0xA2, ControlRight: 0xA3,
  AltLeft: 0xA4, AltRight: 0xA5,
  MetaLeft: 0x5B, MetaRight: 0x5C,
  F1: 0x70, F2: 0x71, F3: 0x72, F4: 0x73, F5: 0x74, F6: 0x75,
  F7: 0x76, F8: 0x77, F9: 0x78, F10: 0x79, F11: 0x7A, F12: 0x7B,
};

function vkFromInput(input) {
  if (input.vk != null) return input.vk;
  const code = input.code || input.key || '';
  if (VK[code] != null) return VK[code];
  if (code.startsWith('Key') && code.length === 4) return code.charCodeAt(3);
  if (code.startsWith('Digit') && code.length === 6) return code.charCodeAt(5);
  if (code.startsWith('Numpad') && code.length === 7) {
    const d = code.charCodeAt(6);
    if (d >= 48 && d <= 57) return d;
  }
  const key = input.key || '';
  if (key.length === 1) return key.toUpperCase().charCodeAt(0);
  return null;
}

function ensureBridge() {
  if (process.platform !== 'win32') return null;
  if (bridge && !bridge.killed) return bridge;

  const script = path.join(__dirname, 'inputBridge.ps1');
  bridge = spawn(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Sta', '-File', script],
    { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true }
  );

  bridge.stderr?.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) log.warn('input bridge', msg.slice(0, 120));
  });

  bridge.on('exit', () => { bridge = null; });
  return bridge;
}

function setInputMapper(fn) {
  mapCoords = fn || ((input) => input);
}

function stopInputBridge() {
  if (bridge && !bridge.killed) {
    try { bridge.stdin.end(); bridge.kill(); } catch (_) {}
    bridge = null;
  }
}

function handleInput(input) {
  if (process.platform !== 'win32') return;
  const proc = ensureBridge();
  if (!proc) return;

  const mapped = mapCoords(input);
  const payload = { ...mapped, button: mapped.button || 'left' };

  if (payload.type === 'keydown' || payload.type === 'keyup') {
    payload.vk = vkFromInput(payload);
    if (!payload.vk) return;
  }

  try {
    proc.stdin.write(`${JSON.stringify(payload)}\n`);
  } catch (_) {
    bridge = null;
  }
}

module.exports = { handleInput, setInputMapper, stopInputBridge, VK };
