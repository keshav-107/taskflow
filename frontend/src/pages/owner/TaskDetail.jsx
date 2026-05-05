import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getTask, updateTask, deleteTask } from '../../api/tasks';
import { uploadFiles, getSignedUrl, deleteFile } from '../../api/files';
import StatusBadge from '../../components/StatusBadge';
import FileUploadZone from '../../components/FileUploadZone';
import { useToast } from '../../context/ToastContext';

function fileIcon(mime) {
  if (mime?.includes('pdf')) return '📄';
  if (mime?.includes('image')) return '🖼️';
  return '📎';
}

export default function OwnerTaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newFiles, setNewFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState({});

  const load = () => {
    setLoading(true);
    getTask(id).then(setTask).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const fetchUrl = async (fileId) => {
    if (signedUrls[fileId]) {
      window.open(signedUrls[fileId], '_blank');
      return;
    }
    try {
      const data = await getSignedUrl(fileId);
      setSignedUrls(u => ({ ...u, [fileId]: data.signed_url }));
      window.open(data.signed_url, '_blank');
    } catch { toast.error('Could not get file URL'); }
  };

  const handleUploadMore = async () => {
    if (!newFiles.length) return;
    setUploading(true);
    try {
      await uploadFiles(id, 'owner_attachment', newFiles);
      toast.success(`${newFiles.length} file(s) uploaded`);
      setNewFiles([]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleDeleteFile = async (fileId, fileName) => {
    if (!confirm(`Delete "${fileName}"?`)) return;
    try {
      await deleteFile(fileId);
      toast.success('File removed');
      load();
    } catch { toast.error('Delete failed'); }
  };

  const handleStatusChange = async (status) => {
    try {
      await updateTask(id, { status });
      toast.success('Status updated');
      if (status === 'completed') {
        navigate('/owner/dashboard');
      } else {
        load();
      }
    } catch { toast.error('Update failed'); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task and all its files?')) return;
    try {
      await deleteTask(id);
      toast.success('Task deleted');
      navigate('/owner/tasks');
    } catch { toast.error('Delete failed'); }
  };

  if (loading) return (
    <div className="page-body flex items-center justify-center" style={{ minHeight: 300 }}>
      <div className="spinner spinner-lg" />
    </div>
  );
  if (!task) return <div className="page-body">Task not found.</div>;

  const attachments = task.files?.filter(f => f.file_type === 'owner_attachment') || [];
  const deliverables = task.files?.filter(f => f.file_type === 'vendor_deliverable') || [];
  const existingCount = attachments.length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/owner/tasks" className="btn btn-ghost btn-sm">← Tasks</Link>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Assigned to {task.vendor?.full_name} · Created {new Date(task.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {task.status === 'submitted' && (
            <>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--success-muted)', color: 'var(--success)', border: '1px solid rgba(34,197,94,.3)' }}
                onClick={() => handleStatusChange('completed')}
              >
                ✅ Mark Complete
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleStatusChange('rejected')}>
                ❌ Reject
              </button>
            </>
          )}
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑 Delete</button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, maxWidth: 960 }}>
          {/* Main */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Description */}
            <div className="card card-body">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>📝 Description</div>
              <p style={{ color: task.description ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 14, lineHeight: 1.7 }}>
                {task.description || 'No description provided.'}
              </p>
            </div>

            {/* Owner Attachments */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">📎 Your Attachments ({attachments.length}/5)</span>
              </div>
              <div className="card-body">
                {attachments.length > 0 && (
                  <div className="file-list" style={{ marginBottom: 16, marginTop: 0 }}>
                    {attachments.map(f => (
                      <div key={f.id} className="file-item">
                        <span className="file-item-icon">{fileIcon(f.mime_type)}</span>
                        <span className="file-item-name">{f.file_name}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => fetchUrl(f.id)}>⬇️</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                          onClick={() => handleDeleteFile(f.id, f.file_name)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {existingCount < 5 && (
                  <>
                    <FileUploadZone
                      files={newFiles}
                      onChange={setNewFiles}
                      maxFiles={5 - existingCount}
                    />
                    {newFiles.length > 0 && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 10 }}
                        onClick={handleUploadMore}
                        disabled={uploading}
                      >
                        {uploading ? <><span className="spinner" /> Uploading…</> : `⬆️ Upload ${newFiles.length} file(s)`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Vendor Deliverables */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">📤 Vendor Deliverables ({deliverables.length}/2)</span>
              </div>
              <div className="card-body">
                {deliverables.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 0' }}>
                    <span className="empty-icon" style={{ fontSize: 32 }}>📭</span>
                    <span className="empty-title" style={{ fontSize: 14 }}>No deliverables yet</span>
                    <span className="empty-desc" style={{ fontSize: 13 }}>Waiting for vendor to submit PDFs</span>
                  </div>
                ) : (
                  <div className="file-list" style={{ marginTop: 0 }}>
                    {deliverables.map(f => (
                      <div key={f.id} className="file-item">
                        <span className="file-item-icon">📄</span>
                        <span className="file-item-name">{f.file_name}</span>
                        <span className="text-muted text-sm">{new Date(f.created_at).toLocaleDateString()}</span>
                        <button className="btn btn-primary btn-sm" onClick={() => fetchUrl(f.id)}>⬇️ Download</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>ℹ️ Task Info</div>
              <hr className="divider" />
              <div className="flex justify-between items-center">
                <span className="text-muted text-sm">Status</span>
                <StatusBadge status={task.status} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted text-sm">Vendor</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{task.vendor?.full_name}</span>
              </div>
              {task.vendor?.company_name && (
                <div className="flex justify-between items-center">
                  <span className="text-muted text-sm">Company</span>
                  <span style={{ fontSize: 14 }}>{task.vendor.company_name}</span>
                </div>
              )}
              {task.due_date && (
                <div className="flex justify-between items-center">
                  <span className="text-muted text-sm">Due Date</span>
                  <span style={{ fontSize: 14 }}>{new Date(task.due_date).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted text-sm">Created</span>
                <span style={{ fontSize: 14 }}>{new Date(task.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted text-sm">Updated</span>
                <span style={{ fontSize: 14 }}>{new Date(task.updated_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Quick Status Update */}
            <div className="card card-body">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>🔄 Update Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['pending', 'in_progress', 'completed', 'rejected'].map(s => (
                  <button
                    key={s}
                    className={`btn btn-sm ${task.status === s ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleStatusChange(s)}
                    disabled={task.status === s}
                  >
                    <StatusBadge status={s} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
