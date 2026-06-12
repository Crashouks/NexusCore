import { Link } from 'react-router-dom';
import { useDownloads } from '../context/DownloadContext';
import { useToast } from './Toast';
import Icon from './Icon';
import { formatSizeGb, isInstalled, isDownloading, needsDownload } from '../utils/download';

export default function LibraryDownloadList({ games, showAll = false }) {
  const { startDownload, getProgress } = useDownloads();
  const { showToast } = useToast();

  const filtered = showAll
    ? games
    : games.filter(g => isDownloading(g) || needsDownload(g));

  const handleDownload = async (game) => {
    try {
      await startDownload(game);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (!filtered.length) {
    return (
      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 48 }}>
        {showAll ? 'No games in library.' : 'No pending downloads. Installed games appear in All Games.'}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {filtered.map(g => {
        const liveProgress = getProgress(g.game_id);
        const progress = liveProgress ?? g.download_progress ?? 0;
        const downloading = isDownloading(g) || liveProgress != null;
        const installed = isInstalled(g);

        return (
          <div key={g.game_id} className="card" style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <img src={g.cover_url} alt={g.name} style={{ width: 56, height: 78, objectFit: 'cover', borderRadius: 8 }} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <Link to={`/games/${g.slug || g.game_id}`} className="font-display" style={{ fontWeight: 600, fontSize: 16 }}>{g.name}</Link>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                {formatSizeGb(g.download_size_gb)}
                {g.cloud_enabled && ' · Cloud play available without install'}
              </p>
              {(downloading || (!installed && progress > 0)) && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>{downloading ? 'Downloading…' : 'Paused'}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${progress}%`, background: 'var(--accent-glow)' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {installed ? (
                <span className="btn btn-success" style={{ cursor: 'default', fontSize: 13 }}>
                  <Icon name="download" size={14} /> Installed
                </span>
              ) : downloading ? (
                <span className="btn btn-ghost" style={{ fontSize: 13, cursor: 'default' }}>In progress…</span>
              ) : (
                <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => handleDownload(g)}>
                  <Icon name="download" size={14} /> Download
                </button>
              )}
              {g.cloud_enabled && (
                <Link to={`/games/${g.slug || g.game_id}`} className="btn btn-neon" style={{ fontSize: 13 }}>
                  <Icon name="cloud" size={14} /> Stream
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
