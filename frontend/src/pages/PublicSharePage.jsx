import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Folder,
  File,
  Lock,
  UploadCloud,
  CheckCircle,
  HardDrive,
  FileText,
  FileSpreadsheet,
  Presentation,
  Code2,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  X,
} from 'lucide-react';
import { publicShareAPI } from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatBytes, getFileTypeCategory, detectFileCategory } from '../utils/formatters';

export default function PublicSharePage({ token, onBackToDrive }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [error, setError] = useState(null);

  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef(null);
  const uploadAbortControllerRef = useRef(null);

  // Prevent reload, leave, or tab close during active upload
  useEffect(() => {
    if (!isUploading) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      const msg = 'File upload is currently in progress. If you leave or reload, your upload will be cancelled.';
      e.returnValue = msg;
      return msg;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading]);

  useEffect(() => {
    loadShareInfo();
  }, [token]);

  const loadShareInfo = async (pw = '') => {
    setLoading(true);
    setError(null);
    setPasswordError('');
    try {
      const res = await publicShareAPI.getPublicInfo(token, pw);
      if (res.data) {
        if (res.data.requires_password) {
          setIsPasswordRequired(true);
        } else {
          setIsPasswordRequired(false);
          setData(res.data);
        }
      }
    } catch (err) {
      if (isPasswordRequired) {
        setPasswordError('Incorrect password');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!password) return;
    loadShareInfo(password);
  };

  const handleDownloadAll = () => {
    window.location.href = publicShareAPI.getDownloadUrl(token);
  };

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
    
    let totalLoaded = 0;
    const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB chunks

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
        
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          if (controller.signal.aborted) throw new Error("AbortError");
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          const chunkFormData = new FormData();
          chunkFormData.append('upload_id', uploadId);
          chunkFormData.append('chunk_index', chunkIndex);
          chunkFormData.append('chunk', chunk);
          
          await publicShareAPI.uploadPublicChunk(token, chunkFormData, controller.signal);
          
          totalLoaded += chunk.size;
          const percent = totalUploadBytes > 0 ? Math.min(100, Math.round((totalLoaded * 100) / totalUploadBytes)) : 100;
          setUploadProgress(percent);
        }
        
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


  const handleCancelUpload = () => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    toast.info('Upload cancelled');
  };

  const renderFileIcon = (mime, ext, name = '') => {
    const cat = detectFileCategory(mime, ext, name);
    switch (cat) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-pink-400" />;
      case 'video':
        return <Film className="w-5 h-5 text-rose-400" />;
      case 'audio':
        return <Music className="w-5 h-5 text-violet-400" />;
      case 'code':
        return <Code2 className="w-5 h-5 text-teal-400" />;
      case 'document':
        return <FileText className="w-5 h-5 text-blue-400" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-400" />;
      case 'spreadsheet':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'presentation':
        return <Presentation className="w-5 h-5 text-orange-400" />;
      case 'archive':
        return <Archive className="w-5 h-5 text-amber-500" />;
      default:
        return <File className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Banner */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              EleDrive
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-slate-400 block uppercase">
              Shared Workspace
            </span>
          </div>
        </div>

        {onBackToDrive && (
          <button
            onClick={onBackToDrive}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl transition-colors"
          >
            Go to My Drive →
          </button>
        )}
      </header>

      {/* Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3.5 sm:p-6 md:p-8 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            Loading shared workspace...
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-3xl bg-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 mb-1">Share Link Expired or Not Found</h2>
            <p className="text-xs text-slate-400 max-w-sm">{error}</p>
          </div>
        ) : isPasswordRequired ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100 text-center mb-1">
                Password Protected
              </h3>
              <p className="text-xs text-slate-400 text-center mb-5">
                This shared item requires a password to view or download.
              </p>

              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <input
                  type="password"
                  autoFocus
                  placeholder="Enter link password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:border-blue-500 outline-none"
                />
                {passwordError && (
                  <p className="text-xs text-red-400 font-medium">{passwordError}</p>
                )}
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Unlock Item
                </button>
              </form>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  {data.target_type === 'folder' ? (
                    <Folder className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400" />
                  ) : (
                    <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-blue-400" />
                  )}
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-100">
                    {data.target_type === 'folder' ? data.folder?.name : data.file?.name}
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {data.target_type === 'folder'
                      ? `${(data.subfolders?.length || 0) + (data.files?.length || 0)} items in folder`
                      : `${formatBytes(data.file?.size)} • ${data.file?.mime_type}`}
                  </p>
                </div>
              </div>

              {/* Actions: Download / Upload */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {data.permission === 'upload_and_view' && data.target_type === 'folder' && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{isUploading ? 'Uploading...' : 'Upload to this Folder'}</span>
                  </button>
                )}

                <button
                  onClick={handleDownloadAll}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl text-xs font-bold shadow-md transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>{data.target_type === 'folder' ? 'Download All as ZIP' : 'Download File'}</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleUploadFiles(Array.from(e.target.files));
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            {/* Upload Progress feedback */}
            {isUploading && (
              <div className="bg-slate-900 rounded-2xl p-4 border border-blue-500/40 shadow-sm space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-blue-300">
                  <span>Uploading files to shared drive...</span>
                  <div className="flex items-center gap-3">
                    <span>{uploadProgress}%</span>
                    <button
                      type="button"
                      onClick={handleCancelUpload}
                      className="px-2 py-0.5 text-[11px] font-semibold text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-600 rounded-lg transition-colors flex items-center gap-1"
                      title="Cancel upload"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadSuccess && (
              <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold p-3.5 rounded-2xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Files successfully uploaded to this folder!</span>
              </div>
            )}

            {/* Folder Contents */}
            {data.target_type === 'folder' && (
              <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Folder Contents
                  </span>
                  <span className="text-xs text-slate-400">
                    {data.permission === 'upload_and_view'
                      ? '✓ Collaboration enabled: You can view, download & upload'
                      : 'View & download only'}
                  </span>
                </div>

                <div className="divide-y divide-slate-800/70">
                  {/* Subfolders */}
                  {data.subfolders?.map((sf) => (
                    <div
                      key={sf.id}
                      className="px-6 py-3 flex items-center justify-between hover:bg-slate-800/40 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-3 truncate pr-4">
                        <Folder className="w-5 h-5 text-amber-400 shrink-0" />
                        <span className="font-semibold text-slate-200 truncate">{sf.name}</span>
                      </div>
                      <span className="text-slate-500 shrink-0">{sf.item_count || 0} items</span>
                    </div>
                  ))}

                  {/* Files */}
                  {data.files?.map((fl) => (
                    <div
                      key={fl.id}
                      className="px-6 py-3 flex items-center justify-between hover:bg-slate-800/40 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-3 truncate pr-4">
                        {renderFileIcon(fl.mime_type, fl.extension)}
                        <span className="font-semibold text-slate-200 truncate">{fl.name}</span>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-slate-500">{formatBytes(fl.size)}</span>
                        <a
                          href={`/api/files/${fl.id}/download?inline=0`}
                          download={fl.name}
                          className="p-1.5 text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}

                  {(!data.subfolders || data.subfolders.length === 0) &&
                    (!data.files || data.files.length === 0) && (
                      <div className="text-center py-12 text-slate-500 text-xs">
                        This shared folder is empty.
                        {data.permission === 'upload_and_view' && (
                          <div className="mt-2">
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="text-blue-400 font-bold hover:underline"
                            >
                              Upload the first file now
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>

      {/* Footer Attribution */}
      <footer className="py-4 border-t border-slate-800 text-center shrink-0 bg-slate-950/60">
        <p className="text-[11px] text-slate-500 font-medium tracking-wide">
          Developed and Powered by{' '}
          <span className="font-bold text-slate-400 tracking-wider">ELETHIYA</span>
        </p>
      </footer>
    </div>
  );
}
