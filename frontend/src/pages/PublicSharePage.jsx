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
  Code2,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
} from 'lucide-react';
import { publicShareAPI } from '../api/client';
import { formatBytes, formatDate, getFileTypeCategory } from '../utils/formatters';

export default function PublicSharePage({ token, onBackToDrive }) {
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
    setIsUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      await publicShareAPI.uploadPublic(token, formData, (prog) => {
        setUploadProgress(prog);
      });
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      loadShareInfo(password);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const renderFileIcon = (mime, ext) => {
    const cat = getFileTypeCategory(mime, ext);
    switch (cat) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-pink-500" />;
      case 'video':
        return <Film className="w-5 h-5 text-rose-500" />;
      case 'audio':
        return <Music className="w-5 h-5 text-violet-500" />;
      case 'code':
        return <Code2 className="w-5 h-5 text-emerald-500" />;
      case 'document':
      case 'pdf':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'archive':
        return <Archive className="w-5 h-5 text-amber-600" />;
      default:
        return <File className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Banner */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              EleDrive
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-slate-600 block uppercase">
              Shared Workspace
            </span>
          </div>
        </div>

        {onBackToDrive && (
          <button
            onClick={onBackToDrive}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl transition-colors"
          >
            Go to My Drive →
          </button>
        )}
      </header>

      {/* Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
            Loading shared workspace...
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Share Link Expired or Not Found</h2>
            <p className="text-xs text-slate-600 max-w-sm">{error}</p>
          </div>
        ) : isPasswordRequired ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800 text-center mb-1">
                Password Protected
              </h3>
              <p className="text-xs text-slate-600 text-center mb-5">
                This shared item requires a password to view or download.
              </p>

              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <input
                  type="password"
                  autoFocus
                  placeholder="Enter link password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                />
                {passwordError && (
                  <p className="text-xs text-red-600 font-medium">{passwordError}</p>
                )}
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Unlock Item
                </button>
              </form>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  {data.target_type === 'folder' ? (
                    <Folder className="w-8 h-8 text-amber-500" />
                  ) : (
                    <FileText className="w-8 h-8 text-blue-500" />
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    {data.target_type === 'folder' ? data.folder?.name : data.file?.name}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {data.target_type === 'folder'
                      ? `${(data.subfolders?.length || 0) + (data.files?.length || 0)} items in folder`
                      : `${formatBytes(data.file?.size)} • ${data.file?.mime_type}`}
                  </p>
                </div>
              </div>

              {/* Actions: Download / Upload */}
              <div className="flex items-center gap-3">
                {data.permission === 'upload_and_view' && data.target_type === 'folder' && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{isUploading ? 'Uploading...' : 'Upload to this Folder'}</span>
                  </button>
                )}

                <button
                  onClick={handleDownloadAll}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-bold shadow-md transition-all"
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
              <div className="bg-white rounded-2xl p-4 border border-blue-200 shadow-sm space-y-2">
                <div className="flex justify-between text-xs font-bold text-blue-900">
                  <span>Uploading files to shared drive...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-blue-50 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold p-3 rounded-2xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Files successfully uploaded to this folder!</span>
              </div>
            )}

            {/* Folder Contents */}
            {data.target_type === 'folder' && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Folder Contents
                  </span>
                  <span className="text-xs text-slate-600">
                    {data.permission === 'upload_and_view'
                      ? '✓ Collaboration enabled: You can view, download & upload'
                      : 'View & download only'}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* Subfolders */}
                  {data.subfolders?.map((sf) => (
                    <div
                      key={sf.id}
                      className="px-6 py-3 flex items-center justify-between hover:bg-slate-50/70 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-3 truncate pr-4">
                        <Folder className="w-5 h-5 text-amber-500 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">{sf.name}</span>
                      </div>
                      <span className="text-slate-600 shrink-0">{sf.item_count || 0} items</span>
                    </div>
                  ))}

                  {/* Files */}
                  {data.files?.map((fl) => (
                    <div
                      key={fl.id}
                      className="px-6 py-3 flex items-center justify-between hover:bg-slate-50/70 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-3 truncate pr-4">
                        {renderFileIcon(fl.mime_type, fl.extension)}
                        <span className="font-semibold text-slate-800 truncate">{fl.name}</span>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-slate-600">{formatBytes(fl.size)}</span>
                        <a
                          href={`/api/files/${fl.id}/download?inline=0`}
                          download={fl.name}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}

                  {(!data.subfolders || data.subfolders.length === 0) &&
                    (!data.files || data.files.length === 0) && (
                      <div className="text-center py-12 text-slate-600 text-xs">
                        This shared folder is empty.
                        {data.permission === 'upload_and_view' && (
                          <div className="mt-2">
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="text-blue-600 font-bold hover:underline"
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
    </div>
  );
}
