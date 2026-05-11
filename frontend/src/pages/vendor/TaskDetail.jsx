import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTask, updateTask } from '../../api/tasks';
import { uploadFiles, getSignedUrl, deleteFile, getFileBlob } from '../../api/files';
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

/* ─── File Preview Overlay ────────────────────────────────────────────────── */
function FilePreviewModal({ file, onClose, onDownload }) {
  const isImage = file.mime?.includes('image');
  const isPdf   = file.mime?.includes('pdf');
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.85)', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
          padding: 16, maxWidth: '92vw', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', gap: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,.8)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 600, flex: 1, fontSize: 14, color: 'var(--text-secondary)' }}>{file.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={onDownload}>⬇️ Download</button>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isImage && (
            <img src={file.url} alt={file.name} style={{ maxWidth: '85vw', maxHeight: '75vh', borderRadius: 8, objectFit: 'contain' }} />
          )}
          {isPdf && (
            <iframe
              src={file.url}
              title={file.name}
              style={{ width: '80vw', height: '75vh', border: 'none', borderRadius: 8 }}
            />
          )}
          {!isImage && !isPdf && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📎</div>
              <p>Preview not available for this file type.</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={onDownload}>Download to view</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Comments Section ────────────────────────────────────────────────────── */
function CommentsSection({ taskId }) {
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
    try {
      await addComment(taskId, message.trim());
      setMessage('');
      load();
    } catch { toast.error('Failed to send comment'); }
    finally { setSaving(false); }
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">💬 Remarks ({comments.length})</span>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Message list */}
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {comments.length === 0 && <p className="text-muted text-sm">No remarks yet. Be the first to comment.</p>}
          {comments.map(c => (
            <div key={c.id} style={{
              background: 'var(--bg-elevated)', borderRadius: 'var(--radius)',
              padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{c.author_name}</span>
                <span className="text-muted" style={{ fontSize: 11 }}>{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>{c.message}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {/* Compose */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <textarea
            className="form-textarea"
            style={{ flex: 1, minHeight: 64, resize: 'vertical' }}
            placeholder="Add a remark or update…"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) submit(); }}
          />
          <button
            className="btn btn-primary btn-sm"
            style={{ alignSelf: 'flex-end', padding: '8px 14px' }}
            onClick={submit}
            disabled={saving || !message.trim()}
          >
            {saving ? <span className="spinner" /> : '💬 Send'}
          </button>
        </div>
        <p className="form-hint" style={{ marginTop: 0 }}>Ctrl+Enter to send</p>
      </div>
    </div>
  );
}

/* ─── Payment Card (Vendor view) ──────────────────────────────────────────── */
function VendorPaymentCard({ taskId }) {
  const toast = useToast();
  const [payment, setPayment] = useState(null);
  const [form, setForm] = useState({ payment_link: '', policy_amount: '', commission_amount: '', notes: '' });
  const [txnForm, setTxnForm] = useState({ amount: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = () => getPayment(taskId).then(p => { if (p) { setPayment(p); setForm({ payment_link: p.payment_link || '', policy_amount: p.policy_amount || '', commission_amount: p.commission_amount || '', notes: p.notes || '' }); } }).catch(() => {});
  useEffect(() => { load(); }, [taskId]);

  const savePayment = async () => {
    setSaving(true);
    try {
      await upsertPayment(taskId, { payment_link: form.payment_link || undefined, policy_amount: form.policy_amount ? Number(form.policy_amount) : undefined, commission_amount: form.commission_amount ? Number(form.commission_amount) : undefined, notes: form.notes || undefined });
      toast.success('Payment info saved');
      load();
    } catch { toast.error('Failed to save payment info'); }
    finally { setSaving(false); }
  };

  const recordSelfPayment = async () => {
    if (!txnForm.amount) { toast.error('Enter an amount'); return; }
    setSaving(true);
    try {
      await addTransaction(taskId, { transaction_type: 'vendor_self_payment', amount: Number(txnForm.amount), description: txnForm.description || 'Vendor paid policy amount directly' });
      toast.success('Self-payment recorded');
      setTxnForm({ amount: '', description: '' });
      load();
    } catch { toast.error('Failed to record payment'); }
    finally { setSaving(false); }
  };

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">💰 Payment Info</span></div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {payment && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)' }}>
            <span className="text-muted text-sm">Net Balance</span>
            <span style={{ fontWeight: 700, color: payment.net_balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              ₹{Math.abs(payment.net_balance || 0).toLocaleString()}
            </span>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Policy Amount (₹)</label>
          <input className="form-input" type="number" placeholder="e.g. 12000" value={form.policy_amount} onChange={e => setForm(f => ({ ...f, policy_amount: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Commission (₹)</label>
          <input className="form-input" type="number" placeholder="e.g. 1200" value={form.commission_amount} onChange={e => setForm(f => ({ ...f, commission_amount: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Payment Link for Owner</label>
          <input className="form-input" placeholder="https://pay.link/..." value={form.payment_link} onChange={e => setForm(f => ({ ...f, payment_link: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input className="form-input" placeholder="Any notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <button className="btn btn-primary btn-sm w-full" onClick={savePayment} disabled={saving}>{saving ? <span className="spinner" /> : '💾 Save Payment Info'}</button>

        <hr className="divider" />
        <div style={{ fontWeight: 600, fontSize: 13 }}>I Paid the Policy Myself</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input btn-sm" type="number" placeholder="Amount (₹)" value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))} />
          <input className="form-input btn-sm" placeholder="Notes" value={txnForm.description} onChange={e => setTxnForm(f => ({ ...f, description: e.target.value }))} />
          <button className="btn btn-secondary btn-sm" onClick={recordSelfPayment} disabled={saving}>Record</button>
        </div>

        {payment?.transactions?.length > 0 && (
          <>
            <hr className="divider" />
            <div style={{ fontWeight: 600, fontSize: 13 }}>Transaction Log</div>
            {payment.transactions.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="text-muted">{t.transaction_type.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 600, color: t.direction === 'credit' ? 'var(--success)' : 'var(--warning)' }}>
                  {t.direction === 'credit' ? '+' : '-'}₹{Number(t.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function VendorTaskDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deliverables, setDeliverables] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState({});   // file_id → download URL
  const [previewUrls, setPreviewUrls] = useState({});  // file_id → preview URL
  const [preview, setPreview] = useState(null); // { url, name, mime }

  const load = () => {
    setLoading(true);
    getTask(id).then(setTask).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const fetchUrls = async (fileId) => {
    // Return cached if available
    if (signedUrls[fileId]) return { download: signedUrls[fileId], preview: previewUrls[fileId] };
    try {
      const data = await getSignedUrl(fileId);
      const dl = data.signed_url;
      const pv = data.preview_url || data.signed_url; // fallback for Supabase
      setSignedUrls(u => ({ ...u, [fileId]: dl }));
      setPreviewUrls(u => ({ ...u, [fileId]: pv }));
      return { download: dl, preview: pv };
    } catch {
      toast.error('Could not get file URL');
      return null;
    }
  };

  const handlePreview = async (f) => {
    try {
      const blobUrl = await getFileBlob(f.id);
      setPreview({ url: blobUrl, name: f.file_name, mime: f.mime_type });
    } catch {
      const urls = await fetchUrls(f.id);
      if (urls) setPreview({ url: urls.download, name: f.file_name, mime: f.mime_type });
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
    } catch {
      window.open(urls.download, '_blank');
    }
  };

  const handleStartWork = async () => {
    try { await updateTask(id, { status: 'in_progress' }); toast.success('Task marked as In Progress'); load(); }
    catch { toast.error('Update failed'); }
  };

  const handleSubmit = async () => {
    if (deliverables.length === 0) { toast.error('Please upload at least one PDF deliverable.'); return; }
    setUploading(true);
    try {
      // Rename files with registration number prefix (same as owner attachments)
      const regPrefix = task.registration_no ? `${task.registration_no}_` : '';
      const renamedFiles = deliverables.map(f => {
        const newName = `${regPrefix}${f.name}`;
        return new File([f], newName, { type: f.type });
      });
      await uploadFiles(id, 'vendor_deliverable', renamedFiles);
      await updateTask(id, { status: 'submitted' });
      toast.success('Deliverables submitted!');
      setDeliverables([]); load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Submission failed'); }
    finally { setUploading(false); }
  };

  const handleDeleteDeliverable = async (fileId, fileName) => {
    if (!confirm(`Delete "${fileName}"?`)) return;
    try { await deleteFile(fileId); toast.success('File removed'); load(); }
    catch { toast.error('Delete failed'); }
  };

  if (loading) return <div className="page-body flex items-center justify-center" style={{ minHeight: 300 }}><div className="spinner spinner-lg" /></div>;
  if (!task) return <div className="page-body">Task not found.</div>;

  const attachments = task.files?.filter(f => f.file_type === 'owner_attachment') || [];
  const existingDeliverables = task.files?.filter(f => f.file_type === 'vendor_deliverable') || [];
  const canSubmit = ['pending', 'in_progress', 'rejected'].includes(task.status);
  const remainingSlots = 2 - existingDeliverables.length;

  return (
    <>
      {/* Preview Overlay */}
      {preview && (
        <FilePreviewModal
          file={preview}
          onClose={() => setPreview(null)}
          onDownload={() => {
            // Find which file matches this preview and download it
            const fileId = Object.keys(previewUrls).find(k => previewUrls[k] === preview.url);
            if (fileId) handleDownload({ id: fileId, file_name: preview.name });
            setPreview(null);
          }}
        />
      )}

      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <HamburgerBtn />
            <Link to="/vendor/tasks" className="btn btn-ghost btn-sm">← Tasks</Link>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {task.registration_no && <span style={{ fontWeight: 600, color: 'var(--text-accent)' }}>🚗 {task.registration_no} · </span>}
            Assigned {new Date(task.created_at).toLocaleDateString()}
            {task.due_date && ` · Due ${new Date(task.due_date).toLocaleDateString()}`}
          </p>
        </div>
        {task.status === 'pending' && (
          <button className="btn btn-primary" onClick={handleStartWork}>▶️ Start Working</button>
        )}
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 24, maxWidth: 960 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Description */}
            <div className="card card-body">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>📝 Task Description</div>
              <p style={{ color: task.description ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 14, lineHeight: 1.7 }}>
                {task.description || 'No description provided.'}
              </p>
            </div>

            {/* Owner files */}
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

            {/* Deliverables upload */}
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
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteDeliverable(f.id, f.file_name)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {remainingSlots > 0 && (
                    <>
                      <FileUploadZone files={deliverables} onChange={setDeliverables} maxFiles={remainingSlots} vendorMode />
                      <p className="form-hint">PDF files only · max {remainingSlots} more file(s)</p>
                    </>
                  )}
                  <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={uploading || (deliverables.length === 0 && existingDeliverables.length === 0)}>
                    {uploading ? <><span className="spinner" /> Submitting…</> : '🚀 Submit to Owner'}
                  </button>
                </div>
              </div>
            )}

            {/* Status banners */}
            {task.status === 'submitted' && (
              <div className="card card-body" style={{ background: 'var(--accent-muted)', borderColor: 'rgba(91,91,246,.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>⏳</span>
                  <div><div className="font-semibold">Submitted — Awaiting Review</div><p className="text-muted text-sm">The owner is reviewing your deliverables.</p></div>
                </div>
              </div>
            )}
            {task.status === 'completed' && (
              <div className="card card-body" style={{ background: 'var(--success-muted)', borderColor: 'rgba(34,197,94,.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🎉</span>
                  <div><div className="font-semibold" style={{ color: 'var(--success)' }}>Task Completed!</div><p className="text-muted text-sm">The owner marked this as done.</p></div>
                </div>
              </div>
            )}
            {task.status === 'rejected' && (
              <div className="card card-body" style={{ background: 'var(--danger-muted)', borderColor: 'rgba(239,68,68,.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>❌</span>
                  <div><div className="font-semibold" style={{ color: 'var(--danger)' }}>Rejected</div><p className="text-muted text-sm">Please resubmit your deliverables.</p></div>
                </div>
              </div>
            )}

            {/* Comments */}
            <CommentsSection taskId={id} />
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Task Info */}
            <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>ℹ️ Task Info</div>
              <hr className="divider" />
              {task.registration_no && (
                <div className="flex justify-between">
                  <span className="text-muted text-sm">Reg. No.</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-accent)' }}>{task.registration_no}</span>
                </div>
              )}
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

            {/* Payment card */}
            <VendorPaymentCard taskId={id} />
          </div>
        </div>
      </div>
    </>
  );
}
