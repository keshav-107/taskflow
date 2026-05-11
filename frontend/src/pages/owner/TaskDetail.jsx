import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getTask, updateTask, deleteTask } from '../../api/tasks';
import { uploadFiles, getSignedUrl, deleteFile } from '../../api/files';
import { getComments, addComment } from '../../api/comments';
import { getPayment, upsertPayment, addTransaction } from '../../api/payments';
import StatusBadge from '../../components/StatusBadge';
import FileUploadZone from '../../components/FileUploadZone';
import { useToast } from '../../context/ToastContext';
import HamburgerBtn from '../../components/HamburgerBtn';

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
  const [signedUrls, setSignedUrls] = useState({});   // file_id → download URL
  const [previewUrls, setPreviewUrls] = useState({});  // file_id → preview URL
  const [preview, setPreview] = useState(null);

  const load = () => {
    setLoading(true);
    getTask(id).then(setTask).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const fetchUrls = async (fileId) => {
    if (signedUrls[fileId]) return { download: signedUrls[fileId], preview: previewUrls[fileId] };
    try {
      const data = await getSignedUrl(fileId);
      const dl = data.signed_url;
      const pv = data.preview_url || data.signed_url;
      setSignedUrls(u => ({ ...u, [fileId]: dl }));
      setPreviewUrls(u => ({ ...u, [fileId]: pv }));
      return { download: dl, preview: pv };
    } catch {
      toast.error('Could not get file URL');
      return null;
    }
  };

  const handleDownload = async (f) => {
    const urls = await fetchUrls(f.id);
    if (!urls) return;
    try {
      const resp = await fetch(urls.download);
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const obj = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = obj; a.download = f.file_name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(obj);
    } catch { window.open(urls.download, '_blank'); }
  };

  const handlePreview = async (f) => {
    const urls = await fetchUrls(f.id);
    if (urls) setPreview({ url: urls.preview, name: f.file_name, mime: f.mime_type });
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
      {/* Preview Overlay */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPreview(null)}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: 16, maxWidth: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 24px 80px rgba(0,0,0,.8)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 600, flex: 1, fontSize: 14, color: 'var(--text-secondary)' }}>{preview.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { handleDownload({ id: Object.keys(signedUrls).find(k => signedUrls[k] === preview.url), file_name: preview.name }); setPreview(null); }}>⬇️ Download</button>
              <button className="btn btn-ghost btn-icon" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {preview.mime?.includes('image') && <img src={preview.url} alt={preview.name} style={{ maxWidth: '85vw', maxHeight: '75vh', borderRadius: 8, objectFit: 'contain' }} />}
              {preview.mime?.includes('pdf') && <iframe src={preview.url} title={preview.name} style={{ width: '80vw', height: '75vh', border: 'none', borderRadius: 8 }} />}
              {!preview.mime?.includes('image') && !preview.mime?.includes('pdf') && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📎</div><p>Preview not available.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <HamburgerBtn />
            <Link to="/owner/tasks" className="btn btn-ghost btn-sm">← Tasks</Link>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {task.registration_no && <span style={{ fontWeight: 600, color: 'var(--text-accent)' }}>🚗 {task.registration_no} · </span>}
            Assigned to {task.vendor?.full_name} · Created {new Date(task.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {task.status === 'submitted' && (
            <>
              <button className="btn btn-sm" style={{ background: 'var(--success-muted)', color: 'var(--success)', border: '1px solid rgba(34,197,94,.3)' }} onClick={() => handleStatusChange('completed')}>✅ Mark Complete</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleStatusChange('rejected')}>❌ Reject</button>
            </>
          )}
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑 Delete</button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 24, maxWidth: 960 }}>
          {/* Main */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card card-body">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>📝 Description</div>
              <p style={{ color: task.description ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 14, lineHeight: 1.7 }}>
                {task.description || 'No description provided.'}
              </p>
            </div>

            {/* Owner Attachments */}
            <div className="card">
              <div className="card-header"><span className="card-title">📎 Your Attachments ({attachments.length}/5)</span></div>
              <div className="card-body">
                {attachments.length > 0 && (
                  <div className="file-list" style={{ marginBottom: 16, marginTop: 0 }}>
                    {attachments.map(f => (
                      <div key={f.id} className="file-item">
                        <span className="file-item-icon">{fileIcon(f.mime_type)}</span>
                        <span className="file-item-name">{f.file_name}</span>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handlePreview(f)}>👁️</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(f)}>⬇️</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteFile(f.id, f.file_name)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {existingCount < 5 && (
                  <>
                    <FileUploadZone files={newFiles} onChange={setNewFiles} maxFiles={5 - existingCount} />
                    {newFiles.length > 0 && (
                      <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={handleUploadMore} disabled={uploading}>
                        {uploading ? <><span className="spinner" /> Uploading…</> : `⬆️ Upload ${newFiles.length} file(s)`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Vendor Deliverables */}
            <div className="card">
              <div className="card-header"><span className="card-title">📤 Vendor Deliverables ({deliverables.length}/2)</span></div>
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
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handlePreview(f)}>👁️ Preview</button>
                          <button className="btn btn-primary btn-sm" onClick={() => handleDownload(f)}>⬇️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comments */}
            <OwnerCommentsSection taskId={id} />
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>ℹ️ Task Info</div>
              <hr className="divider" />
              {task.registration_no && (
                <div className="flex justify-between items-center">
                  <span className="text-muted text-sm">Reg. No.</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-accent)' }}>{task.registration_no}</span>
                </div>
              )}
              <div className="flex justify-between items-center"><span className="text-muted text-sm">Status</span><StatusBadge status={task.status} /></div>
              <div className="flex justify-between items-center"><span className="text-muted text-sm">Vendor</span><span style={{ fontSize: 14, fontWeight: 500 }}>{task.vendor?.full_name}</span></div>
              {task.vendor?.company_name && <div className="flex justify-between items-center"><span className="text-muted text-sm">Company</span><span style={{ fontSize: 14 }}>{task.vendor.company_name}</span></div>}
              {task.due_date && <div className="flex justify-between items-center"><span className="text-muted text-sm">Due</span><span style={{ fontSize: 14 }}>{new Date(task.due_date).toLocaleDateString()}</span></div>}
              <div className="flex justify-between items-center"><span className="text-muted text-sm">Created</span><span style={{ fontSize: 14 }}>{new Date(task.created_at).toLocaleDateString()}</span></div>
            </div>

            {/* Status controls */}
            <div className="card card-body">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>🔄 Update Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['pending', 'in_progress', 'completed', 'rejected'].map(s => (
                  <button key={s} className={`btn btn-sm ${task.status === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleStatusChange(s)} disabled={task.status === s}>
                    <StatusBadge status={s} />
                  </button>
                ))}
              </div>
            </div>

            {/* Payment card */}
            <OwnerPaymentCard taskId={id} />
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Owner Comments Section ─────────────────────────────────────────────── */
function OwnerCommentsSection({ taskId }) {
  const toast = useToast();
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef(null);

  const load = () => getComments(taskId).then(setComments).catch(() => {});
  useEffect(() => { load(); }, [taskId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

  const submit = async () => {
    if (!message.trim()) return;
    setSaving(true);
    try { await addComment(taskId, message.trim()); setMessage(''); load(); }
    catch { toast.error('Failed to send comment'); }
    finally { setSaving(false); }
  };

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">💬 Remarks ({comments.length})</span></div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {comments.length === 0 && <p className="text-muted text-sm">No remarks yet.</p>}
          {comments.map(c => (
            <div key={c.id} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{c.author_name}</span>
                <span className="text-muted" style={{ fontSize: 11 }}>{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>{c.message}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <textarea className="form-textarea" style={{ flex: 1, minHeight: 64, resize: 'vertical' }} placeholder="Add a remark…" value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) submit(); }} />
          <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end', padding: '8px 14px' }} onClick={submit} disabled={saving || !message.trim()}>{saving ? <span className="spinner" /> : '💬 Send'}</button>
        </div>
        <p className="form-hint" style={{ marginTop: 0 }}>Ctrl+Enter to send</p>
      </div>
    </div>
  );
}

/* ─── Owner Payment Card ─────────────────────────────────────────────────── */
function OwnerPaymentCard({ taskId }) {
  const toast = useToast();
  const [payment, setPayment] = useState(null);
  const [txnForm, setTxnForm] = useState({ amount: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = () => getPayment(taskId).then(p => { if (p) setPayment(p); }).catch(() => {});
  useEffect(() => { load(); }, [taskId]);

  const recordOwnerPayment = async () => {
    if (!txnForm.amount) { toast.error('Enter an amount'); return; }
    setSaving(true);
    try {
      await addTransaction(taskId, { transaction_type: 'owner_payment', amount: Number(txnForm.amount), description: txnForm.description || 'Owner paid policy amount' });
      toast.success('Payment recorded');
      setTxnForm({ amount: '', description: '' });
      load();
    } catch { toast.error('Failed to record payment'); }
    finally { setSaving(false); }
  };

  if (!payment) return (
    <div className="card card-body">
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>💰 Payment</div>
      <p className="text-muted text-sm">No payment info yet. Vendor will provide details.</p>
    </div>
  );

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">💰 Payment</span></div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)' }}>
          <span className="text-muted text-sm">Net Balance</span>
          <span style={{ fontWeight: 700, color: payment.net_balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>₹{Math.abs(payment.net_balance || 0).toLocaleString()}</span>
        </div>
        {payment.policy_amount && <div className="flex justify-between"><span className="text-muted text-sm">Policy Amount</span><span style={{ fontSize: 14 }}>₹{Number(payment.policy_amount).toLocaleString()}</span></div>}
        {payment.commission_amount && <div className="flex justify-between"><span className="text-muted text-sm">Commission</span><span style={{ fontSize: 14 }}>₹{Number(payment.commission_amount).toLocaleString()}</span></div>}
        {payment.payment_link && (
          <div>
            <span className="text-muted text-sm">Payment Link</span>
            <a href={payment.payment_link} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm w-full" style={{ marginTop: 6 }}>💳 Pay Now</a>
          </div>
        )}
        <hr className="divider" />
        <div style={{ fontWeight: 600, fontSize: 13 }}>Record My Payment</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input btn-sm" type="number" placeholder="Amount (₹)" value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))} />
          <input className="form-input btn-sm" placeholder="Notes" value={txnForm.description} onChange={e => setTxnForm(f => ({ ...f, description: e.target.value }))} />
          <button className="btn btn-secondary btn-sm" onClick={recordOwnerPayment} disabled={saving}>Record</button>
        </div>
        {payment.transactions?.length > 0 && (
          <>
            <hr className="divider" />
            <div style={{ fontWeight: 600, fontSize: 13 }}>Transaction Log</div>
            {payment.transactions.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="text-muted">{t.transaction_type.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 600, color: t.direction === 'credit' ? 'var(--success)' : 'var(--warning)' }}>{t.direction === 'credit' ? '+' : '-'}₹{Number(t.amount).toLocaleString()}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
