  uploadChunk: (formData, signal) =>
    api.post('/upload/chunk', formData, {
      signal,
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  finalizeUpload: (data, signal) =>
    api.post('/upload/finalize', data, { signal }),
