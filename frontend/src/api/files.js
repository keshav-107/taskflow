import api from './client';

export const uploadFiles = (taskId, fileType, files) => {
  const form = new FormData();
  form.append('file_type', fileType);
  files.forEach(f => form.append('files', f));
  return api.post(`/files/upload/${taskId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const getSignedUrl = (fileId) =>
  api.get(`/files/signed-url/${fileId}`).then(r => r.data);

export const deleteFile = (fileId) =>
  api.delete(`/files/${fileId}`);

/**
 * Fetch file bytes via backend proxy and return a blob URL.
 * Use this for preview to avoid Google Drive iframe auth issues.
 */
export const getFileBlob = async (fileId) => {
  const resp = await api.get(`/files/proxy/${fileId}`, { responseType: 'blob' });
  return URL.createObjectURL(resp.data);
};

