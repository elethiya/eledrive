import React, { useState } from 'react';
import {
  Folder,
  File,
  FileText,
  Code2,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Star,
  MoreVertical,
  Download,
  Share2,
  Edit3,
  FolderInput,
  Trash2,
  Info,
  ExternalLink,
} from 'lucide-react';
import { formatBytes, formatDate, getFileTypeCategory } from '../utils/formatters';
import { fileAPI } from '../api/client';

export default function FileCard({
  item,
  isFolder = false,
  viewMode = 'grid',
  onOpen,
  onDownload,
  onShare,
  onRename,
  onMove,
  onToggleStar,
  onTrash,
  onShowDetails,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const category = !isFolder ? getFileTypeCategory(item.mime_type, item.extension) : 'folder';

  const renderIcon = () => {
    if (isFolder) {
      return (
        <Folder
          className="w-8 h-8 transition-transform group-hover:scale-105"
          style={{ color: item.color || '#f59e0b' }}
        />
      );
    }

    switch (category) {
      case 'image':
        return <ImageIcon className="w-8 h-8 text-pink-500" />;
      case 'video':
        return <Film className="w-8 h-8 text-rose-500" />;
      case 'audio':
        return <Music className="w-8 h-8 text-violet-500" />;
      case 'document':
      case 'pdf':
        return <FileText className="w-8 h-8 text-blue-500" />;
      case 'code':
        return <Code2 className="w-8 h-8 text-emerald-500" />;
      case 'archive':
        return <Archive className="w-8 h-8 text-amber-600" />;
      default:
        return <File className="w-8 h-8 text-slate-400" />;
    }
  };

  // Grid view
  if (viewMode === 'grid') {
    return (
      <div
        onDoubleClick={() => onOpen(item)}
        className="group relative bg-white rounded-2xl border border-slate-200/80 hover:border-blue-400/80 hover:shadow-md transition-all duration-150 p-4 select-none cursor-pointer flex flex-col justify-between"
      >
        {/* Top bar with icon and more menu */}
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
            {renderIcon()}
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
            {onToggleStar && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(item);
                }}
                className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${
                  item.is_starred ? 'text-amber-400' : 'text-slate-300 hover:text-slate-400'
                }`}
                title={item.is_starred ? 'Remove star' : 'Add star'}
              >
                <Star className="w-4 h-4 fill-current" />
              </button>
            )}

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                    }}
                  />
                  <div className="absolute right-0 top-8 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 text-xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onOpen(item);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isFolder ? 'Open Folder' : 'Preview'}</span>
                    </button>

                    {onDownload && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onDownload(item);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-500" />
                        <span>{isFolder ? 'Download ZIP' : 'Download'}</span>
                      </button>
                    )}

                    {onShare && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onShare(item);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                      >
                        <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Share</span>
                      </button>
                    )}

                    {onRename && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onRename(item);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Rename</span>
                      </button>
                    )}

                    {onMove && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onMove(item);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                      >
                        <FolderInput className="w-3.5 h-3.5 text-slate-400" />
                        <span>Move</span>
                      </button>
                    )}

                    {onShowDetails && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onShowDetails(item);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                      >
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span>Details</span>
                      </button>
                    )}

                    {onTrash && (
                      <>
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(false);
                            onTrash(item);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Move to Trash</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Thumbnail Preview for Images */}
        {!isFolder && category === 'image' && (
          <div className="my-2 h-24 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
            <img
              src={fileAPI.getDownloadUrl(item.id, true)}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>
        )}

        {/* Name and Meta */}
        <div className="mt-3">
          <h4
            className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors"
            title={item.name}
          >
            {item.name}
          </h4>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>{isFolder ? `${item.item_count || 0} items` : formatBytes(item.size)}</span>
            <span>{formatDate(item.updated_at)}</span>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div
      onDoubleClick={() => onOpen(item)}
      className="group flex items-center justify-between px-4 py-3 bg-white hover:bg-blue-50/40 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors select-none cursor-pointer text-xs"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
          {renderIcon()}
        </div>
        <span className="font-semibold text-slate-800 truncate group-hover:text-blue-600">
          {item.name}
        </span>
      </div>

      <div className="flex items-center gap-6 shrink-0 text-slate-500">
        <span className="w-24 text-right hidden sm:inline">
          {isFolder ? `${item.item_count || 0} items` : formatBytes(item.size)}
        </span>
        <span className="w-24 text-right hidden md:inline">{formatDate(item.updated_at)}</span>

        <div className="flex items-center gap-1">
          {onToggleStar && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(item);
              }}
              className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${
                item.is_starred ? 'text-amber-400' : 'text-slate-300 hover:text-slate-400'
              }`}
            >
              <Star className="w-4 h-4 fill-current" />
            </button>
          )}

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                  }}
                />
                <div className="absolute right-0 top-8 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 text-xs">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onOpen(item);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isFolder ? 'Open Folder' : 'Preview'}</span>
                  </button>

                  {onDownload && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onDownload(item);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isFolder ? 'Download ZIP' : 'Download'}</span>
                    </button>
                  )}

                  {onShare && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onShare(item);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                    >
                      <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Share</span>
                    </button>
                  )}

                  {onRename && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onRename(item);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Rename</span>
                    </button>
                  )}

                  {onMove && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onMove(item);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                    >
                      <FolderInput className="w-3.5 h-3.5 text-slate-400" />
                      <span>Move</span>
                    </button>
                  )}

                  {onShowDetails && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onShowDetails(item);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium"
                    >
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      <span>Details</span>
                    </button>
                  )}

                  {onTrash && (
                    <>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onTrash(item);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Move to Trash</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
