import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTask, updateTask } from '../../api/tasks';
import { uploadFiles, getSignedUrl, deleteFile } from '../../api/files';
import StatusBadge from '../../components/StatusBadge';
import FileUploadZone from '../../components/FileUploadZone';
import { useToast } from '../../context/ToastContext';
import HamburgerBtn from '../../components/HamburgerBtn';

function fileIcon(mime) {
  if (mime?.includes('pdf')) return '📄';
  if (mime?.includes('image')) return '🖼️';
  return '📎';
}

export default function VendorTaskDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deliverables, setDeliverables] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState({});

  const load = () => {
    setLoading(true);
    getTask(id).then(setTask).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const fetchUrl = async (fileId) => {
    if (signedUrls[fileId]) { window.open(signedUrls[fileId], '_blank'); return; }
    try {
      const data = await getSignedUrl(fileId);
      setSignedUrls(u => ({ ...u, [fileId]: data.signed_url }));
      window.open(data.signed_url, '_blank');
    } catch { toast.error('Could not get file URL'); }
  };

  const handleStartWork = async () => {
    try {
      await updateTask(id, { status: 'in_progress' });
      toast.success('Task marked as In Progress');
      load();
    } catch { toast.error('Update failed'); }
  };

  const handleSubmit = async () => {
    if (deliverables.length === 0) {
      toast.error('Please upload at least one PDF deliverable before submitting.');
      return;
    }
    setUploading(true);
    try {
      await uploadFiles(id, 'vendor_deliverable', deliverables);
      await updateTask(id, { status: 'submitted' });
      toast.success('Deliverables submitted successfully!');
      setDeliverables([]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed');
    } finally { setUploading(false); }
  };

  const handleDeleteDeliverable = async (fileId, fileName) => {
    if (!confirm(`Delete "${fileName}"?`)) return;
    try {
      await deleteFile(fileId);
      toast.success('File removed');
      load();
    } catch { toast.error('Delete failed'); }
  };

  if (loading) return (
    <div className="page-body flex items-center justify-center" style={{ minHeight: 300 }}>
      <div className="spinner spinner-lg" />
    </div>
  );
  if (!task) return <div className="page-body">Task not found.</div>;

  const attachments = task.files?.filter(f => f.file_type === 'owner_attachment') || [];
  const existingDeliverables = task.files?.filter(f => f.file_type === 'vendor_deliverable') || [];
  const canSubmit = ['pending', 'in_progress', 'rejected'].includes(task.status);
  const remainingSlots = 2 - existingDeliverables.length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <HamburgerBtn />
            <Link to="/vendor/tasks" className="btn btn-ghost btn-sm back-btn-desktop">← Tasks</Link>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Assigned {new Date(task.created_at).toLocaleDateString()}
            {task.due_date && ` · Due ${new Date(task.due_date).toLocaleDateString()}`}
          </p>
        </div>
        {task.status === 'pending' && (
          <button className="btn btn-primary" onClick={handleStartWork}>
            ▶️ Start Working
          </button>
        )}
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 24, maxWidth: 900 }}>
          {/* Main */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Description */}
            <div className="card card-body">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>📝 Task Description</div>
              <p style={{
                color: task.description ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 14, lineHeight: 1.7
              }}>
                {task.description || 'No description provided.'}
              </p>
            </div>

            {/* Owner files to download */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">📎 Files from Owner ({attachments.length})</span>
              </div>
              <div className="card-body">
                {attachments.length === 0 ? (
                  <p className="text-muted text-sm">No files attached yet.</p>
                ) : (
                  <div className="file-list" style={{ marginTop: 0 }}>
                    {attachments.map(f => (
                      <div key={f.id} className="file-item">
                        <span className="file-item-icon">{fileIcon(f.mime_type)}</span>
                        <span className="file-item-name">{f.file_name}</span>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => fetchUrl(f.id)}
                        >
                          ⬇️ Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Vendor Deliverables Upload */}
            {canSubmit && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">📤 Submit Deliverables ({existingDeliverables.length}/2)</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {existingDeliverables.length > 0 && (
                    <div className="file-list" style={{ marginTop: 0 }}>
                      {existingDeliverables.map(f => (
                        <div key={f.id} className="file-item">
                          <span className="file-item-icon">📄</span>
                          <span className="file-item-name">{f.file_name}</span>
                          <span className="text-muted text-sm">{new Date(f.created_at).toLocaleDateString()}</span>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => handleDeleteDeliverable(f.id, f.file_name)}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {remainingSlots > 0 && (
                    <>
                      <FileUploadZone
                        files={deliverables}
                        onChange={setDeliverables}
                        maxFiles={remainingSlots}
                        vendorMode
                      />
                      <p className="form-hint">PDF files only · max {remainingSlots} more file(s)</p>
                    </>
                  )}

                  <button
                    className="btn btn-primary w-full"
                    onClick={handleSubmit}
                    disabled={uploading || (deliverables.length === 0 && existingDeliverables.length === 0)}
                  >
                    {uploading
                      ? <><span className="spinner" /> Submitting…</>
                      : '🚀 Submit to Owner'}
                  </button>
                </div>
              </div>
            )}

            {/* Already submitted / completed */}
            {task.status === 'submitted' && (
              <div className="card card-body" style={{ background: 'var(--accent-muted)', borderColor: 'rgba(91,91,246,.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>⏳</span>
                  <div>
                    <div className="font-semibold">Submitted — Awaiting Review</div>
                    <p className="text-muted text-sm">The owner is reviewing your deliverables.</p>
                  </div>
                </div>
              </div>
            )}

            {task.status === 'completed' && (
              <div className="card card-body" style={{ background: 'var(--success-muted)', borderColor: 'rgba(34,197,94,.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🎉</span>
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--success)' }}>Task Completed!</div>
                    <p className="text-muted text-sm">Great work — the owner marked this as done.</p>
                  </div>
                </div>
              </div>
            )}

            {task.status === 'rejected' && (
              <div className="card card-body" style={{ background: 'var(--danger-muted)', borderColor: 'rgba(239,68,68,.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>❌</span>
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--danger)' }}>Rejected</div>
                    <p className="text-muted text-sm">Please review the task and resubmit your deliverables.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'start' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>ℹ️ Task Info</div>
            <hr className="divider" />
            <div className="flex justify-between">
              <span className="text-muted text-sm">Status</span>
              <StatusBadge status={task.status} />
            </div>
            {task.due_date && (
              <div className="flex justify-between">
                <span className="text-muted text-sm">Due Date</span>
                <span style={{ fontSize: 14 }}>{new Date(task.due_date).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted text-sm">Attachments</span>
              <span style={{ fontSize: 14 }}>{attachments.length} file(s)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted text-sm">Deliverables</span>
              <span style={{ fontSize: 14 }}>{existingDeliverables.length}/2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted text-sm">Assigned</span>
              <span style={{ fontSize: 14 }}>{new Date(task.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
