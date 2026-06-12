export function downloadDurationSec(sizeGb) {
  const gb = parseFloat(sizeGb) || 25;
  return Math.max(0.1, gb / 10);
}

export function formatSizeGb(sizeGb) {
  const gb = parseFloat(sizeGb) || 0;
  return gb >= 1 ? `${gb.toFixed(gb % 1 === 0 ? 0 : 1)} GB` : `${(gb * 1024).toFixed(0)} MB`;
}

export function isInstalled(game) {
  return game?.download_status === 'installed';
}

export function isDownloading(game) {
  return game?.download_status === 'downloading';
}

export function needsDownload(game) {
  return game && game.download_status !== 'installed';
}
