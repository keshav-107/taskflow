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
