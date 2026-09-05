  const handleUploadFiles = async (files) => {
    if (!files || files.length === 0) return;

    if (uploadAbortControllerRef.current) {
      try {
        uploadAbortControllerRef.current.abort();
      } catch (_) {}
    }

    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);
    
    let totalUploadBytes = 0;
    for (let i = 0; i < files.length; i++) {
      totalUploadBytes += files[i].size || 0;
    }
    
    let totalCompletedBytes = 0;
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks
    const CONCURRENCY = 4;

    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadId = generateUUID();
        const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
        
        let chunkIndex = 0;
        let activeUploads = 0;
        let hasError = false;
        
        const activeChunks = new Map();

        const updateProgress = () => {
          let activeBytes = 0;
          activeChunks.forEach((val) => { activeBytes += val; });
          const currentTotalLoaded = totalCompletedBytes + activeBytes;
          
          const percent = totalUploadBytes > 0 ? Math.min(100, Math.round((currentTotalLoaded * 100) / totalUploadBytes)) : 100;
          setUploadProgress(percent);
        };

        await new Promise((resolve, reject) => {
          const next = () => {
            if (hasError || controller.signal.aborted) {
              if (controller.signal.aborted && !hasError) {
                 reject(new Error("AbortError"));
              }
              return;
            }
            if (chunkIndex >= totalChunks && activeUploads === 0) {
              resolve();
              return;
            }
            
            while (activeUploads < CONCURRENCY && chunkIndex < totalChunks && !hasError) {
              const currentIndex = chunkIndex++;
              activeUploads++;
              
              const start = currentIndex * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, file.size);
              const chunk = file.slice(start, end);
              
              const chunkFormData = new FormData();
              chunkFormData.append('upload_id', uploadId);
              chunkFormData.append('chunk_index', currentIndex);
              chunkFormData.append('chunk', chunk);
              
              activeChunks.set(currentIndex, 0);
              
              publicShareAPI.uploadPublicChunk(token, chunkFormData, (e) => {
                  activeChunks.set(currentIndex, e.loaded || 0);
                  updateProgress();
              }, controller.signal)
                .then(() => {
                  activeChunks.delete(currentIndex);
                  totalCompletedBytes += chunk.size;
                  updateProgress();
                  
                  activeUploads--;
                  next();
                })
                .catch((err) => {
                  if (!hasError) {
                     hasError = true;
                     reject(err);
                  }
                });
            }
          };
          next();
        });
        
        await publicShareAPI.uploadPublicFinalize(token, {
          upload_id: uploadId,
          filename: file.name,
          total_chunks: totalChunks,
          total_size: file.size
        }, controller.signal);
      }

      uploadAbortControllerRef.current = null;
      setUploadProgress(100);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      loadShareInfo(password);
      toast.success('Files uploaded successfully!');
    } catch (err) {
      uploadAbortControllerRef.current = null;
      if (
        controller.signal.aborted ||
        err.name === 'CanceledError' ||
        err.name === 'AbortError' ||
        err.code === 'ERR_CANCELED' ||
        err.message === 'AbortError'
      ) {
        toast.info('Upload cancelled');
        return;
      }
      toast.error('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };
