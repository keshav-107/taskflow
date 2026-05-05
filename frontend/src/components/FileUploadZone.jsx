import { useRef, useState, useCallback } from 'react';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const OWNER_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const VENDOR_TYPES = ['application/pdf'];

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

export default function FileUploadZone({ files, onChange, maxFiles = 5, vendorMode = false }) {
  const inputRef = useRef();
  const [drag, setDrag] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef();
  const streamRef = useRef();
  const allowed = vendorMode ? VENDOR_TYPES : OWNER_TYPES;

  const addFiles = useCallback((newFiles) => {
    const valid = Array.from(newFiles).filter(f => {
      if (!allowed.includes(f.type)) return false;
      if (f.size > MAX_SIZE) return false;
      return true;
    });
    const combined = [...files, ...valid].slice(0, maxFiles);
    onChange(combined);
  }, [files, onChange, maxFiles, allowed]);

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (i) => onChange(files.filter((_, idx) => idx !== i));

  // Camera capture
  const openCamera = async () => {
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
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      addFiles([file]);
    }, 'image/jpeg', 0.9);
    closeCamera();
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraOpen(false);
  };

  return (
    <div>
      <div
        className={`upload-zone${drag ? ' drag-over' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <div className="upload-zone-icon">☁️</div>
        <div className="upload-zone-text">
          Drop files here or <strong>click to browse</strong>
        </div>
        <div className="upload-zone-hint">
          {vendorMode
            ? 'PDF only · max 2 files · 10 MB each'
            : 'PDF, JPEG, PNG · max 5 files · 10 MB each'}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={allowed.join(',')}
        style={{ display: 'none' }}
        onChange={e => addFiles(e.target.files)}
      />

      {!vendorMode && (
        <button
          type="button"
          className="btn btn-secondary btn-sm mt-4"
          onClick={openCamera}
          style={{ marginTop: 8 }}
        >
          📷 Use Camera
        </button>
      )}

      {cameraOpen && (
        <div className="modal-overlay" onClick={closeCamera}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">📷 Camera Capture</span>
              <button className="btn btn-ghost btn-icon" onClick={closeCamera}>✕</button>
            </div>
            <div className="modal-body">
              <video ref={videoRef} autoPlay playsInline className="camera-preview" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeCamera}>Cancel</button>
              <button className="btn btn-primary" onClick={capturePhoto}>📸 Capture</button>
            </div>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="file-list">
          {files.map((f, i) => (
            <div key={i} className="file-item">
              <span className="file-item-icon">{fileIcon(f.type)}</span>
              <span className="file-item-name">{f.name}</span>
              <span className="file-item-size">{formatSize(f.size)}</span>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => removeFile(i)}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
