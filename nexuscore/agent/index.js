#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const { startStreaming } = require('./stream');

const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('Missing config.json — copy config.example.json and edit it.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const apiUrl = (config.apiUrl || 'http://localhost:5000/api').replace(/\/$/, '');
const serverId = config.serverId;
const password = config.password || '';
const pollMs = config.pollIntervalMs || 3000;

if (!serverId) {
  console.error('config.json must include serverId (Admin → Cloud → your machine).');
  process.exit(1);
}

const runningBySession = new Map();
const streamConns = new Map();

async function apiPost(route, body) {
  const res = await fetch(`${apiUrl}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ server_id: serverId, password: password || null, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || `HTTP ${res.status}`);
  return data;
}

async function heartbeat() {
  await apiPost('/cloud/agent/heartbeat', {});
}

async function setJobStatus(jobId, status, error) {
  await apiPost(`/cloud/agent/jobs/${jobId}/status`, { status, error: error || null });
}

function launchGame(job) {
  const exe = job.executable_path;
  if (!exe || !fs.existsSync(exe)) throw new Error(`Executable not found: ${exe}`);
  const cwd = path.dirname(exe);
  const child = spawn(exe, [], { cwd, detached: false, stdio: 'ignore' });
  runningBySession.set(job.session_id, child);
  child.on('exit', () => runningBySession.delete(job.session_id));
  return child;
}

function stopGame(sessionId) {
  const stream = streamConns.get(sessionId);
  if (stream) {
    stream.stop().catch(() => {});
    streamConns.delete(sessionId);
  }
  const proc = runningBySession.get(sessionId);
  if (!proc) return false;
  try {
    if (process.platform === 'win32') exec(`taskkill /PID ${proc.pid} /T /F`);
    else proc.kill('SIGTERM');
  } catch (_) {}
  runningBySession.delete(sessionId);
  return true;
}

async function handleJob(job) {
  const type = job.job_type;
  console.log(`[job ${job.job_id}] ${type} session=${job.session_id} game=${job.game_id}`);

  if (type === 'launch') {
    await setJobStatus(job.job_id, 'running');
    try {
      launchGame(job);
      console.log(`  Launched: ${job.executable_path}`);
      const conn = await startStreaming({
        apiUrl, serverId, password, sessionId: job.session_id,
      });
      if (conn) streamConns.set(job.session_id, conn);
      await setJobStatus(job.job_id, 'done');
    } catch (err) {
      console.error(`  Launch failed: ${err.message}`);
      await setJobStatus(job.job_id, 'failed', err.message);
    }
    return;
  }

  if (type === 'stop') {
    stopGame(job.session_id);
    console.log(`  Stop requested for session ${job.session_id}`);
    await setJobStatus(job.job_id, 'done');
  }
}

async function poll() {
  try {
    await heartbeat();
    const { jobs } = await apiPost('/cloud/agent/jobs/poll', {});
    for (const job of jobs || []) await handleJob(job);
  } catch (err) {
    console.error(`[agent] ${err.message}`);
  }
}

console.log('');
console.log('  NexusCore Cloud Agent');
console.log(`  API:      ${apiUrl}`);
console.log(`  Server:   #${serverId}`);
console.log(`  Password: ${password ? '(set)' : '(none)'}`);
console.log('');
console.log('  Waiting for cloud play jobs…');
console.log('');

poll();
setInterval(poll, pollMs);
