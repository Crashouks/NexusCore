/** API URL for the Node cloud agent (must be reachable from the gaming PC). */
export function getAgentApiUrl() {
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

export function buildAgentConfig(serverId, agentPassword = '') {
  return {
    apiUrl: getAgentApiUrl(),
    serverId: Number(serverId),
    password: agentPassword || '',
    pollIntervalMs: 3000,
  };
}

export function agentSetupInstructions(serverId, serverName, agentPassword = '') {
  const apiUrl = getAgentApiUrl();
  const pwdNote = agentPassword
    ? 'Agent password is included in the downloaded config.'
    : 'If you set an agent password in Admin, edit config.json and fill the password field.';
  return `NexusCore Cloud Agent — ${serverName}
Server ID: ${serverId}
API URL: ${apiUrl}

1. Admin → Cloud → download config.json (or use the button on your machine row)
2. Save as: nexuscore/agent/config.json
3. ${pwdNote}
4. Run: nexuscore\\agent\\start-agent.bat
   Or double-click start-all.bat in the project root (starts website + agent).

After the agent connects, this server shows "Agent: Connected" in Admin → Cloud.`;
}

export function downloadAgentConfigFile(serverId, agentPassword = '') {
  const config = buildAgentConfig(serverId, agentPassword);
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
