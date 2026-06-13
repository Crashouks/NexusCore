const signalR = require('@microsoft/signalr');

function hubBase(apiUrl) {
  return apiUrl.replace(/\/api\/?$/, '');
}

async function startStreaming({ apiUrl, serverId, password, sessionId }) {
  const conn = new signalR.HubConnectionBuilder()
    .withUrl(`${hubBase(apiUrl)}/hubs/cloud-stream`)
    .withAutomaticReconnect()
    .build();

  const { handleInput } = require('./input');
  let screenshot;
  try {
    screenshot = require('screenshot-desktop');
  } catch {
    console.warn('  Install screenshot-desktop: npm install screenshot-desktop');
    return null;
  }

  conn.on('ReceiveInput', (input) => handleInput(input));

  await conn.start();
  await conn.invoke('AgentJoin', sessionId, serverId, password || null);
  console.log(`  Streaming session ${sessionId} — sending screen frames`);

  const interval = setInterval(async () => {
    if (conn.state !== 'Connected') return;
    try {
      const buf = await screenshot({ format: 'jpg', quality: 60 });
      const frameBase64 = buf.toString('base64');
      await conn.invoke('SendFrame', sessionId, serverId, password || null, frameBase64);
    } catch (_) { /* skip frame */ }
  }, 150);

  conn.onclose(() => clearInterval(interval));
  return conn;
}

module.exports = { startStreaming };
