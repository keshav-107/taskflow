import api from './client';

export const getComments = (taskId) =>
  api.get(`/comments/${taskId}`).then(r => r.data);

export const addComment = (taskId, message) =>
  api.post(`/comments/${taskId}`, { message }).then(r => r.data);
