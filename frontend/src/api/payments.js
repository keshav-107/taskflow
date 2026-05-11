import api from './client';

export const getPayment = (taskId) =>
  api.get(`/payments/${taskId}`).then(r => r.data).catch(() => null);

export const upsertPayment = (taskId, data) =>
  api.post(`/payments/${taskId}`, data).then(r => r.data);

export const addTransaction = (taskId, data) =>
  api.post(`/payments/${taskId}/transaction`, data).then(r => r.data);

export const getLedger = () =>
  api.get('/payments/ledger').then(r => r.data);
