import api from './client';

export const listVendors = () =>
  api.get('/vendors').then(r => r.data);

export const createVendor = (data) =>
  api.post('/vendors', data).then(r => r.data);

export const getVendor = (id) =>
  api.get(`/vendors/${id}`).then(r => r.data);

export const updateVendor = (id, data) =>
  api.patch(`/vendors/${id}`, data).then(r => r.data);

export const deleteVendor = (id) =>
  api.delete(`/vendors/${id}`);
