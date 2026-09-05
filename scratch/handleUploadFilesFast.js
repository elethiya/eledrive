  const handleUploadFiles = async (filesList) => {
    if (!filesList || filesList.length === 0) return;

    if (uploadAbortControllerRef.current) {
      try {
        uploadAbortControllerRef.current.abort();
      } catch (_) {}
    }

    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;

    let totalUploadBytes = 0;
    for (let i = 0; i < filesList.length; i++) {
      totalUploadBytes += filesList[i].size || 0;
    }

    setUploadStatus({
      isUploading: true,
      progress: 0,
      totalFiles: filesList.length,
      loadedBytes: 0,
      totalBytes: totalUploadBytes,
      speed: 0,
      success: false,
      cancelled: false,
      error: null,
    });

    let lastTime = Date.now();
    let lastLoaded = 0;
    let currentSpeed = 0;
    let totalCompletedBytes = 0;

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks
    const CONCURRENCY = 4; // 4 concurrent chunks = 20MB in flight

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
      for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
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
          
          const now = Date.now();
          const timeDelta = (now - lastTime) / 1000;
          if (timeDelta >= 0.25) {
            currentSpeed = (currentTotalLoaded - lastLoaded) / timeDelta;
            lastLoaded = currentTotalLoaded;
            lastTime = now;
          }

          setUploadStatus((prev) =>
            prev
              ? {
                  ...prev,
                  progress: percent,
                  loadedBytes: currentTotalLoaded,
                  speed: currentSpeed,
                }
              : null
          );
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

              fileAPI.uploadChunk(chunkFormData, (e) => {
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
        
        // Finalize this file
        await fileAPI.finalizeUpload({
          upload_id: uploadId,
          filename: file.name,
          relative_path: file.webkitRelativePath || '',
          folder_id: currentFolderId || '',
          total_chunks: totalChunks,
          total_size: file.size
        }, controller.signal);
      }

      uploadAbortControllerRef.current = null;

      setUploadStatus((prev) =>
        prev
          ? {
              ...prev,
              isUploading: false,
              progress: 100,
              loadedBytes: totalUploadBytes,
              totalBytes: totalUploadBytes,
              speed: 0,
              success: true,
            }
          : null
      );

      refreshUser();
      const temp = currentFolderId;
      setCurrentFolderId('__temp');
      setTimeout(() => setCurrentFolderId(temp), 50);

      setTimeout(() => {
        setUploadStatus(null);
      }, 4000);
    } catch (err) {
      uploadAbortControllerRef.current = null;
      if (
        controller.signal.aborted ||
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError' ||
        err?.code === 'ERR_CANCELED' ||
        err.message === 'AbortError'
      ) {
        setUploadStatus((prev) =>
          prev
            ? {
                ...prev,
                isUploading: false,
                cancelled: true,
                progress: 0,
                error: 'Upload cancelled by user',
              }
            : null
        );
        setTimeout(() => {
          setUploadStatus(null);
        }, 2500);
        return;
      }

      setUploadStatus((prev) =>
        prev
          ? {
              ...prev,
              isUploading: false,
              error: err.message,
            }
          : null
      );
    }
  };
