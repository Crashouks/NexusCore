const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'logs');
const logFile = path.join(logDir, 'agent.log');
const maxBytes = 512 * 1024;

function ensureLogDir() {
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
}

function trimLogIfHuge() {
  try {
    if (!fs.existsSync(logFile)) return;
    const stat = fs.statSync(logFile);
    if (stat.size <= maxBytes) return;
    const tail = fs.readFileSync(logFile, 'utf8').slice(-Math.floor(maxBytes / 2));
    fs.writeFileSync(logFile, `[${new Date().toISOString()}] [info] Log trimmed\n${tail}`);
  } catch (_) {}
}

function write(level, message, detail) {
  ensureLogDir();
  const extra = detail !== undefined ? ` | ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : '';
  const line = `[${new Date().toISOString()}] [${level}] ${message}${extra}`;
  const out = level === 'error' ? console.error : console.log;
  out(line);
  try {
    fs.appendFileSync(logFile, `${line}\n`);
    trimLogIfHuge();
  } catch (err) {
    console.error(`Could not write log file: ${err.message}`);
  }
}

module.exports = {
  logFile,
  info: (msg, detail) => write('info', msg, detail),
  warn: (msg, detail) => write('warn', msg, detail),
  error: (msg, detail) => write('error', msg, detail),
  debug: (msg, detail) => write('debug', msg, detail),
};
