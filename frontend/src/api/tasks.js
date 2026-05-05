import api from './client';

export const listTasks = (params = {}) =>
  api.get('/tasks', { params }).then(r => r.data);

export const getTask = (id) =>
  api.get(`/tasks/${id}`).then(r => r.data);

export const createTask = (data) =>
  api.post('/tasks', data).then(r => r.data);

export const updateTask = (id, data) =>
  api.patch(`/tasks/${id}`, data).then(r => r.data);

export const deleteTask = (id) =>
  api.delete(`/tasks/${id}`);
