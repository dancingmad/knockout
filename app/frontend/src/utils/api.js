import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export const samplesApi = {
  getSets: () => api.get('/samples/sets'),
  getSamplesInSet: (setId) => api.get(`/samples/sets/${encodeURIComponent(setId)}`),
  getAllSamples: (params) => api.get('/samples', { params }),
  getCategories: () => api.get('/samples/categories'),
  getMeta: (filePath) => api.get('/samples/meta', { params: { filePath } }),
  upload: (formData) => api.post('/samples/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const projectsApi = {
  list: () => api.get('/projects'),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  addSound: (id, sound) => api.post(`/projects/${id}/sounds`, sound),
  removeSound: (id, slot) => api.delete(`/projects/${id}/sounds/${slot}`),
  updatePads: (id, padAssignments) => api.put(`/projects/${id}/pads`, { padAssignments }),
  updatePad: (id, group, pad, config) => api.put(`/projects/${id}/pads/${group}/${pad}`, config),
};

export const exportApi = {
  exportProject: (id) => api.post(`/export/${id}`, {}, { responseType: 'blob' }),
  previewExport: (id) => api.get(`/export/${id}/preview`),
};

export const importApi = {
  previewPpak: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/ppak/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importPpak: (file, name) => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    return api.post('/import/ppak', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const audioApi = {
  getMeta: (filePath) => api.get('/audio/meta', { params: { filePath } }),
  optimize: (filePath, category, options) => api.post('/audio/optimize', { filePath, category, options }),
  optimizeProject: (id) => api.post(`/audio/optimize-project/${id}`),
  getStreamUrl: (filePath) => `${API_BASE}/audio/stream?filePath=${encodeURIComponent(filePath)}`,
};

export default api;
