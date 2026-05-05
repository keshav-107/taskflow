import { useRef, useState } from 'react';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const OWNER_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function fileIcon(mime) {
  if (mime?.includes('pdf')) return '📄';
  if (mime?.includes('image')) return '🖼️';
  return '📎';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SingleDocumentSlot({ label, file, onChange }) {
  const inputRef = useRef();
  const [drag, setDrag] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef();
  const streamRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    if (!OWNER_TYPES.includes(f.type)) return alert('Invalid file type. Only PDF/JPEG/PNG allowed.');
    if (f.size > MAX_SIZE) return alert('File too large (max 10MB)');
    onChange(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files?.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const openCamera = async (e) => {
    e.stopPropagation();
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      alert('Camera not accessible');
      setCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      const newFile = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      handleFile(newFile);
    }, 'image/jpeg', 0.9);
    closeCamera();
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraOpen(false);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {file ? (
        <div className="file-item" style={{ marginTop: 0, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
          <span className="file-item-icon">{fileIcon(file.type)}</span>
          <span className="file-item-name" style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name}
          </span>
          <span className="file-item-size" style={{ fontSize: 12 }}>{formatSize(file.size)}</span>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onChange(null)}>✕</button>
        </div>
      ) : (
        <div
          className={`upload-zone${drag ? ' drag-over' : ''}`}
          onClick={() => inputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          style={{ padding: '16px', minHeight: '80px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}
        >
          <div className="upload-zone-text" style={{ fontSize: 13, margin: 0 }}>
            Drop or <strong>click</strong>
          </div>
          <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCamera} style={{ fontSize: 13 }}>
            📷 Camera
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={OWNER_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />

      {cameraOpen && (
        <div className="modal-overlay" onClick={closeCamera}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">📷 Capture {label}</span>
              <button type="button" className="btn btn-ghost btn-icon" onClick={closeCamera}>✕</button>
            </div>
            <div className="modal-body">
              <video ref={videoRef} autoPlay playsInline className="camera-preview" />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeCamera}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={capturePhoto}>📸 Capture</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
