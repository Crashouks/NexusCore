/** API URL for the Node cloud agent (must be reachable from the gaming PC). */
export function getAgentApiUrl() {
  const publicUrl = import.meta.env.VITE_PUBLIC_API_URL;
  if (publicUrl && /^https?:\/\//i.test(publicUrl)) return publicUrl.replace(/\/$/, '');

  const env = import.meta.env.VITE_API_URL;
  if (env && /^https?:\/\//i.test(env)) return env.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (port === '5173' || port === '3000' || port === '4173') {
      return `${protocol}//${hostname}:5000/api`;
    }
    return `${window.location.origin}/api`.replace(/\/$/, '');
  }
  return 'http://localhost:5000/api';
}

export function getPublicWebUrl() {
  const u = import.meta.env.VITE_PUBLIC_WEB_URL;
  if (u && /^https?:\/\//i.test(u)) return u.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:5173';
}

export function buildAgentConfig(serverId, agentPassword = '', playerPassword = '') {
  const config = {
    apiUrl: getAgentApiUrl(),
    serverId: Number(serverId),
    password: agentPassword || '',
    pollIntervalMs: 3000,
    streamMinFps: 2,
    streamMaxFps: 20,
    streamMinQuality: 22,
    streamMaxQuality: 72,
  };
  if (playerPassword) config.playerPassword = playerPassword;
  return config;
}

export function agentSetupInstructions(serverId, serverName, agentPassword = '') {
  const apiUrl = getAgentApiUrl();
  const webUrl = getPublicWebUrl();
  const pwdNote = agentPassword
    ? 'Agent password is included in the downloaded config.'
    : 'If you set an agent password in Admin, edit config.json and fill the password field.';
  return `NexusCore Cloud Agent — ${serverName}
Server ID: ${serverId}
API URL: ${apiUrl}
Player site URL: ${webUrl}

1. Save config.json to nexuscore/agent/ on the gaming PC
2. ${pwdNote}
3. Run start-cloud-gaming.bat on the gaming PC
4. Players open ${webUrl} (not localhost unless same machine)

After the agent connects, Admin → Cloud shows "Agent: Connected".`;
}

export function downloadAgentConfigFile(serverId, agentPassword = '', playerPassword = '') {
  const config = buildAgentConfig(serverId, agentPassword, playerPassword);
  const json = `${JSON.stringify(config, null, 2)}\n`;
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'config.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyAgentSetup(serverId, serverName, agentPassword = '') {
  const text = agentSetupInstructions(serverId, serverName, agentPassword);
  await navigator.clipboard.writeText(text);
  return text;
}
