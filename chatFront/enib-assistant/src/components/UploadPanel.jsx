import { useCallback, useRef, useState } from 'react';
import { uploadDocument } from '../lib/api.js';

// file entry shape: { id, name, status: 'pending'|'ok'|'error', progress }

export default function UploadPanel() {
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback((fileList) => {
    const pdfFiles = Array.from(fileList).filter((f) => f.type === 'application/pdf');

    pdfFiles.forEach((file) => {
      const id = `${file.name}-${Date.now()}-${Math.random()}`;

      setFiles((prev) => [...prev, { id, name: file.name, status: 'pending', progress: 0 }]);

      uploadDocument(file, (pct) => {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: pct } : f)));
      })
        .then(() => {
          setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'ok', progress: 100 } : f)));
        })
        .catch(() => {
          setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'error' } : f)));
        });
    });
  }, []);

  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="desk">
      <h2>Dépôt de documents</h2>
      <p className="desk-hint">
        Ajoutez un PDF pour l'indexer. Il devient interrogeable dans la conversation dès la fin du
        traitement.
      </p>

      <div
        className={`dropzone${dragActive ? ' active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
      >
        <div className="dz-label">Glissez un PDF ici</div>
        <div className="dz-sub">ou cliquez pour parcourir vos fichiers</div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((f) => (
            <div className="file-row" key={f.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span className={`status-dot ${f.status}`} />
                <span className="name">{f.name}</span>
              </div>
              {f.status === 'pending' && (
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${f.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
