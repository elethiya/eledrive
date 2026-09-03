import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eledrive_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/share/')) {
      // Don't auto-redirect on share pages
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        localStorage.removeItem('eledrive_token');
        localStorage.removeItem('eledrive_user');
      }
    }
    const message = error.response?.data?.error || error.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  searchUsers: (q) => api.get(`/users/search?q=${encodeURIComponent(q)}`),
  listMembers: () => api.get('/users'),
};

export const folderAPI = {
  getContents: (folderId = '') => api.get(`/folders?folder_id=${folderId}`),
  getFolder: (folderId = '') => api.get(`/folders?folder_id=${folderId}`),
  createFolder: (name, parentId = null, color = null) =>
    api.post('/folders', { name, parent_id: parentId, color }),
  updateFolder: (id, data) => api.put(`/folders/${id}`, data),
  toggleStar: (id) => api.post(`/folders/${id}/star`),
  moveFolder: (id, targetParentId) => api.post(`/folders/${id}/move`, { target_parent_id: targetParentId }),
  trashFolder: (id) => api.delete(`/folders/${id}`),
  restoreFolder: (id) => api.post(`/folders/${id}/restore`),
  permanentDeleteFolder: (id) => api.delete(`/folders/${id}/permanent`),
  getDownloadZipUrl: (id) => {
    const token = localStorage.getItem('eledrive_token');
    return `/api/folders/${id}/download?token=${token}`;
  },
};

export const fileAPI = {
  uploadFiles: (formData, onProgress) =>
    api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }),
  getMetadata: (id) => api.get(`/files/${id}`),
  getPreview: (id) => api.get(`/files/${id}/preview`),
  renameFile: (id, name) => api.put(`/files/${id}`, { name }),
  moveFile: (id, targetFolderId) => api.post(`/files/${id}/move`, { target_folder_id: targetFolderId }),
  toggleStar: (id) => api.post(`/files/${id}/star`),
  trashFile: (id) => api.delete(`/files/${id}`),
  restoreFile: (id) => api.post(`/files/${id}/restore`),
  permanentDeleteFile: (id) => api.delete(`/files/${id}/permanent`),
  search: (q, type = 'all') => api.get(`/files/search?q=${encodeURIComponent(q)}&type=${type}`),
  getDownloadUrl: (id, inline = false) => {
    const token = localStorage.getItem('eledrive_token');
    return `/api/files/${id}/download?inline=${inline ? 1 : 0}&token=${token}`;
  },
};

export const shareAPI = {
  createShare: (data) => api.post('/shares', data),
  getSharedWithMe: () => api.get('/shares'),
  getTargetShares: (type, id) => api.get(`/shares/target?type=${type}&id=${id}`),
  deleteShare: (id) => api.delete(`/shares/${id}`),
};

export const publicShareAPI = {
  createLink: (data) => api.post('/share-links', data),
  getTargetLink: (type, id) => api.get(`/share-links/target?type=${type}&id=${id}`),
  deleteLink: (id) => api.delete(`/share-links/${id}`),
  getPublicInfo: (token, password = '') =>
    api.get(`/public/share/${token}`, {
      headers: password ? { 'X-Share-Password': password } : {},
    }),
  getDownloadUrl: (token) => `/api/public/share/${token}/download`,
  uploadPublic: (token, formData, onProgress) =>
    api.post(`/public/share/${token}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }),
};

export const statsAPI = {
  getStats: () => api.get('/stats'),
  getRecent: () => api.get('/recent'),
  getStarred: () => api.get('/starred'),
  getTrash: () => api.get('/trash'),
  emptyTrash: () => api.post('/trash/empty'),
};

export const profileAPI = {
  updateProfile: (data) => api.put('/user/profile', data),
  changePassword: (data) => api.put('/user/password', data),
  updateSelfStorageLimit: (storageLimitGB) =>
    api.put('/user/storage-limit', { storage_limit_gb: storageLimitGB }),
};

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getLogs: (action = '', q = '') =>
    api.get(`/admin/logs?action=${encodeURIComponent(action)}&q=${encodeURIComponent(q)}`),
  clearLogs: () => api.delete('/admin/logs'),
  listUsers: () => api.get('/admin/users'),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  approveUser: (id) => api.post(`/admin/users/${id}/approve`),
  rejectUser: (id) => api.post(`/admin/users/${id}/reject`),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
  inspectLeak: (formDataOrJson) => {
    if (formDataOrJson instanceof FormData) {
      return api.post('/admin/security/inspect', formDataOrJson, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/admin/security/inspect', formDataOrJson);
  },
  getSecurityStats: () => api.get('/admin/security/stats'),
};

export const teamAPI = {
  listTeams: () => api.get('/teams'),
  createTeam: (data) => api.post('/teams', data),
  getTeam: (id) => api.get(`/teams/${id}`),
  addMember: (teamId, data) => api.post(`/teams/${teamId}/members`, data),
  removeMember: (teamId, userId) => api.delete(`/teams/${teamId}/members/${userId}`),
  deleteTeam: (id) => api.delete(`/teams/${id}`),
  getAvailableUsers: () => api.get('/team-members/available'),
};

export const webhookAPI = {
  trigger: (data) => api.post('/webhook', data),
};

export default api;
