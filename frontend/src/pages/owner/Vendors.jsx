import { useEffect, useState } from 'react';
import { listVendors, createVendor, updateVendor, deleteVendor } from '../../api/vendors';
import { useToast } from '../../context/ToastContext';

const EMPTY_FORM = { full_name: '', email: '', password: '', phone: '', company_name: '' };

export default function Vendors() {
  const toast = useToast();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'create' | {vendor}
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    listVendors().then(setVendors).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setModal('create'); };
  const openEdit = (v) => {
    setForm({ full_name: v.full_name, email: v.email, password: '', phone: v.phone || '', company_name: v.company_name || '' });
    setModal(v);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal === 'create') {
        await createVendor(form);
        toast.success('Vendor created successfully');
      } else {
        const updates = { full_name: form.full_name, phone: form.phone, company_name: form.company_name };
        await updateVendor(modal.id, updates);
        toast.success('Vendor updated');
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (v) => {
    try {
      await updateVendor(v.id, { is_active: !v.is_active });
      toast.success(v.is_active ? 'Vendor deactivated' : 'Vendor activated');
      load();
    } catch { toast.error('Failed to update status'); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Vendors</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Manage your vendor accounts</p>
        </div>
        <button id="add-vendor-btn" className="btn btn-primary" onClick={openCreate}>
          ＋ Add Vendor
        </button>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: 64 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : vendors.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🏢</span>
            <span className="empty-title">No vendors yet</span>
            <span className="empty-desc">Add your first vendor to start assigning tasks.</span>
            <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: 8 }}>
              Add Vendor
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Company</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map(v => {
                  const initials = v.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <tr key={v.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials}</div>
                          <div>
                            <div className="font-semibold" style={{ fontSize: 14 }}>{v.full_name}</div>
                            <div className="text-muted text-sm">{v.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{v.company_name || <span className="text-muted">—</span>}</td>
                      <td>{v.phone || <span className="text-muted">—</span>}</td>
                      <td>
                        <span className={v.is_active ? 'badge badge-completed' : 'badge badge-rejected'}>
                          <span className="badge-dot" />
                          {v.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-muted text-sm">
                        {new Date(v.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(v)}>
                            ✏️ Edit
                          </button>
                          <button
                            className={`btn btn-sm ${v.is_active ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => toggleActive(v)}
                          >
                            {v.is_active ? '🚫 Deactivate' : '✅ Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {modal === 'create' ? '➕ Add New Vendor' : `✏️ Edit ${modal.full_name}`}
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name <span>*</span></label>
                  <input className="form-input" required value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                {modal === 'create' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Email <span>*</span></label>
                      <input type="email" className="form-input" required value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password <span>*</span></label>
                      <input type="password" className="form-input" required minLength={8} value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Min. 8 characters" />
                    </div>
                  </>
                )}
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company</label>
                    <input className="form-input" value={form.company_name}
                      onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> Saving…</> : '💾 Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
