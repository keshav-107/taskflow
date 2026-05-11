import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTask } from '../../api/tasks';
import { uploadFiles } from '../../api/files';
import { listVendors } from '../../api/vendors';
import SingleDocumentSlot from '../../components/SingleDocumentSlot';
import { useToast } from '../../context/ToastContext';
import HamburgerBtn from '../../components/HamburgerBtn';

export default function CreateTask() {
  const toast = useToast();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  
  // Specific slots for the owner to upload
  const [docs, setDocs] = useState({
    aadhar_front: null,
    aadhar_back: null,
    pan_card: null,
    registration_cert: null,
    previous_insurance: null,
    additional_doc: null
  });

  const [form, setForm] = useState({ title: '', description: '', vendor_id: '', due_date: '', registration_no: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listVendors().then(vs => setVendors(vs.filter(v => v.is_active)));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vendor_id) { toast.error('Please select a vendor'); return; }
    setSaving(true);
    try {
      const task = await createTask({
        title: form.title,
        description: form.description || undefined,
        vendor_id: form.vendor_id,
        due_date: form.due_date || undefined,
        registration_no: form.registration_no || undefined,
      });

      // Rename files using registration number if available
      const regPrefix = form.registration_no ? `${form.registration_no}_` : '';

      // Gather all filled document slots
      const finalFiles = [];
      const labels = {
        aadhar_front: 'Aadhar Front',
        aadhar_back: 'Aadhar Back',
        pan_card: 'PAN Card',
        registration_cert: 'Registration Certificate',
        previous_insurance: 'Previous Insurance',
        additional_doc: 'Additional Document'
      };

      Object.entries(docs).forEach(([key, file]) => {
        if (file) {
          const ext = file.name.split('.').pop() || 'jpg';
          const cleanName = `${regPrefix}${labels[key]}.${ext}`;
          finalFiles.push(new File([file], cleanName, { type: file.type }));
        }
      });

      if (finalFiles.length > 0) {
        await uploadFiles(task.id, 'owner_attachment', finalFiles);
      }

      toast.success('Task created and assigned!');
      navigate(`/owner/tasks/${task.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const updateDoc = (key, file) => setDocs(prev => ({ ...prev, [key]: file }));

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <HamburgerBtn />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Create New Task</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Assign a task to a vendor with required files</p>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="page-body">
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 24, maxWidth: 1000 }}>
            {/* Main */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>📋 Task Details</div>
                <div className="form-group">
                  <label className="form-label">Vehicle Registration No. <span>*</span></label>
                  <input
                    id="task-reg-no"
                    className="form-input"
                    placeholder="e.g. MH12AB1234"
                    required
                    value={form.registration_no}
                    onChange={e => setForm(f => ({ ...f, registration_no: e.target.value.toUpperCase() }))}
                  />
                  <span className="form-hint">Documents will be named using this registration number.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Task Title <span>*</span></label>
                  <input
                    id="task-title"
                    className="form-input"
                    placeholder="e.g. Renew car insurance"
                    required
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    id="task-description"
                    className="form-textarea"
                    placeholder="Describe what needs to be done, specifications, requirements…"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ minHeight: 90 }}
                  />
                </div>
              </div>

              <div className="card card-body">
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>📎 Required Documents</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <SingleDocumentSlot label="Aadhar Front" file={docs.aadhar_front} onChange={f => updateDoc('aadhar_front', f)} />
                  <SingleDocumentSlot label="Aadhar Back" file={docs.aadhar_back} onChange={f => updateDoc('aadhar_back', f)} />
                  <SingleDocumentSlot label="PAN Card" file={docs.pan_card} onChange={f => updateDoc('pan_card', f)} />
                  <SingleDocumentSlot label="Registration Certificate (RC)" file={docs.registration_cert} onChange={f => updateDoc('registration_cert', f)} />
                  <SingleDocumentSlot label="Previous Insurance" file={docs.previous_insurance} onChange={f => updateDoc('previous_insurance', f)} />
                  <SingleDocumentSlot label="Additional Document" file={docs.additional_doc} onChange={f => updateDoc('additional_doc', f)} />
                </div>
                <p className="form-hint" style={{ marginTop: 4 }}>
                  Files will be automatically renamed when sent to the vendor. PDF, JPEG, or PNG allowed.
                </p>
              </div>
            </div>

            {/* Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>🏢 Assignment</div>
                <div className="form-group">
                  <label className="form-label">Assign to Vendor <span>*</span></label>
                  <select
                    id="vendor-select"
                    className="form-select"
                    value={form.vendor_id}
                    onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}
                    required
                  >
                    <option value="">Select vendor…</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.full_name}{v.company_name ? ` (${v.company_name})` : ''}
                      </option>
                    ))}
                  </select>
                  {vendors.length === 0 && (
                    <p className="form-hint">No active vendors. Add vendors first.</p>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    id="task-due-date"
                    type="date"
                    className="form-input"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    onClick={e => e.target.showPicker && e.target.showPicker()}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <button
                id="create-task-submit"
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={saving || vendors.length === 0}
              >
                {saving ? <><span className="spinner" /> Creating…</> : '🚀 Create & Assign Task'}
              </button>
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
