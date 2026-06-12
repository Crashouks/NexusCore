import { useState, forwardRef, useImperativeHandle } from 'react';
import Icon from './Icon';

const API = import.meta.env.VITE_API_URL || '/api';

const ImageInput = forwardRef(function ImageInput({ value, onChange, label = 'Cover Image' }, ref) {
  const [tab, setTab] = useState('url');
  const [urlInput, setUrlInput] = useState(value || '');
  const [preview, setPreview] = useState(value || '');
  const [error, setError] = useState('');
  const [meta, setMeta] = useState('');
  const [pendingFile, setPendingFile] = useState(null);

  useImperativeHandle(ref, () => ({
    hasPendingFile: () => !!pendingFile,
    async resolveUrl(gameId) {
      if (pendingFile) {
        if (!gameId) throw new Error('Save the game first, then upload the cover image');
        const fd = new FormData();
        fd.append('file', pendingFile);
        fd.append('game_id', String(gameId));
        const token = localStorage.getItem('nc_token');
        const res = await fetch(`${API}/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onChange(data.url);
        return data.url;
      }
      return preview || urlInput;
    },
  }));

  const setPreviewAndValue = (url, info = '') => {
    setPreview(url);
    setMeta(info);
    setPendingFile(null);
    onChange(url);
  };

  const validateUrl = async () => {
    setError('');
    if (!urlInput.trim()) return;
    try {
      const token = localStorage.getItem('nc_token');
      const res = await fetch(`${API}/media/validate-url?url=${encodeURIComponent(urlInput)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!data.valid) { setError(data.error || 'Invalid image URL'); return; }
      setPreviewAndValue(urlInput);
    } catch {
      setPreviewAndValue(urlInput);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    if (file.size > 5 * 1024 * 1024) { setError('Max file size is 5 MB'); return; }
    setPendingFile(file);
    const previewUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setMeta(`${img.width}×${img.height} · ${(file.size / 1024).toFixed(0)} KB`);
    img.src = previewUrl;
    setPreview(previewUrl);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['url', 'upload'].map(t => (
          <button key={t} type="button" className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => setTab(t)}>{t === 'url' ? 'URL' : 'Upload'}</button>
        ))}
      </div>
      {tab === 'url' ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="Paste image URL here"
            onBlur={validateUrl}
            style={{ flex: 1, padding: 8, borderRadius: 'var(--radius)', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <button type="button" className="btn btn-ghost" onClick={validateUrl}>Preview</button>
        </div>
      ) : (
        <div style={{ marginBottom: 8 }}>
          <label className="btn btn-ghost" style={{ display: 'inline-flex', cursor: 'pointer' }}>
            <Icon name="upload" size={16} /> Upload from device
            <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif" onChange={handleFile} style={{ display: 'none' }} />
          </label>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>JPG, PNG, WebP, GIF · Max 5 MB</p>
        </div>
      )}
      {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</p>}
      {preview && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', maxWidth: 200 }}>
          <img src={preview} alt="Preview" style={{ width: '100%', display: 'block' }} onError={() => setError('Failed to load image')} />
          {meta && <p style={{ padding: 6, fontSize: 11, color: 'var(--text-dim)', background: 'var(--bg-hover)' }}>{meta}</p>}
        </div>
      )}
    </div>
  );
});

export default ImageInput;
