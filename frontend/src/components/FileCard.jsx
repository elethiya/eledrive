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
        return <ImageIcon className="w-8 h-8 text-pink-400" />;
      case 'video':
        return <Film className="w-8 h-8 text-rose-400" />;
      case 'audio':
        return <Music className="w-8 h-8 text-violet-400" />;
      case 'document':
      case 'pdf':
        return <FileText className="w-8 h-8 text-blue-400" />;
      case 'code':
        return <Code2 className="w-8 h-8 text-emerald-400" />;
      case 'archive':
        return <Archive className="w-8 h-8 text-amber-500" />;
      default:
        return <File className="w-8 h-8 text-slate-400" />;
    }
  };

  // Grid view
  if (viewMode === 'grid') {
    return (
      <div
        onDoubleClick={() => onOpen(item)}
        className="group relative bg-slate-900 hover:bg-slate-850 rounded-2xl border border-slate-800 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-150 p-4 select-none cursor-pointer flex flex-col justify-between text-slate-200"
      >
        {/* Top bar with icon and more menu */}
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800/80">
            {renderIcon()}
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
            {onToggleStar && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(item);
                }}
                className={`p-1.5 rounded-lg hover:bg-slate-800 transition-colors ${
                  item.is_starred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
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
                className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
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
                  <div className="absolute right-0 top-8 w-44 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 text-xs text-slate-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onOpen(item);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 hover:text-blue-400 rounded-xl font-medium transition-colors"
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 hover:text-blue-400 rounded-xl font-medium transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-400" />
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 hover:text-indigo-400 rounded-xl font-medium transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5 text-indigo-400" />
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 rounded-xl font-medium transition-colors"
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 rounded-xl font-medium transition-colors"
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 rounded-xl font-medium transition-colors"
                      >
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span>Details</span>
                      </button>
                    )}

                    {onTrash && (
                      <>
                        <div className="my-1 border-t border-slate-800" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(false);
                            onTrash(item);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:bg-rose-950/40 rounded-xl font-medium transition-colors"
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
          <div className="my-2 h-24 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
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
            className="text-xs font-semibold text-slate-200 truncate group-hover:text-blue-400 transition-colors"
            title={item.name}
          >
            {item.name}
          </h4>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
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
      className="group flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800/80 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors select-none cursor-pointer text-xs text-slate-200"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
        <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
          {renderIcon()}
        </div>
        <span className="font-semibold text-slate-200 truncate group-hover:text-blue-400">
          {item.name}
        </span>
      </div>

      <div className="flex items-center gap-6 shrink-0 text-slate-400">
        <span className="w-24 text-right hidden sm:inline text-[11px]">
          {isFolder ? `${item.item_count || 0} items` : formatBytes(item.size)}
        </span>
        <span className="w-24 text-right hidden md:inline text-[11px]">{formatDate(item.updated_at)}</span>

        <div className="flex items-center gap-1">
          {onToggleStar && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(item);
              }}
              className={`p-1.5 rounded-lg hover:bg-slate-800 transition-colors ${
                item.is_starred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
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
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
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
                <div className="absolute right-0 top-8 w-44 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 text-xs text-slate-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onOpen(item);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 hover:text-blue-400 rounded-xl font-medium transition-colors"
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
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 hover:text-blue-400 rounded-xl font-medium transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-400" />
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
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 hover:text-indigo-400 rounded-xl font-medium transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5 text-indigo-400" />
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
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 rounded-xl font-medium transition-colors"
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
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 rounded-xl font-medium transition-colors"
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
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 rounded-xl font-medium transition-colors"
                    >
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      <span>Details</span>
                    </button>
                  )}

                  {onTrash && (
                    <>
                      <div className="my-1 border-t border-slate-800" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onTrash(item);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:bg-rose-950/40 rounded-xl font-medium transition-colors"
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
