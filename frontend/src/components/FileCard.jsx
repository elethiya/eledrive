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
  Users,
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

  const renderIcon = (sizeClass = 'w-5 h-5') => {
    if (isFolder) {
      return (
        <Folder
          className={`${sizeClass} transition-transform group-hover:scale-105`}
          style={{ color: item.color || '#f59e0b' }}
        />
      );
    }

    switch (category) {
      case 'image':
        return <ImageIcon className={`${sizeClass} text-pink-400`} />;
      case 'video':
        return <Film className={`${sizeClass} text-rose-400`} />;
      case 'audio':
        return <Music className={`${sizeClass} text-violet-400`} />;
      case 'document':
      case 'pdf':
        return <FileText className={`${sizeClass} text-blue-400`} />;
      case 'code':
        return <Code2 className={`${sizeClass} text-emerald-400`} />;
      case 'archive':
        return <Archive className={`${sizeClass} text-amber-500`} />;
      default:
        return <File className={`${sizeClass} text-slate-400`} />;
    }
  };

  const handleCardClick = (e) => {
    onOpen(item);
  };

  const extClean = (item.extension || '').replace('.', '').toUpperCase();

  // Action Menu Dropdown (shared between views)
  const renderActionMenu = () => (
    menuOpen && (
      <>
        <div
          className="fixed inset-0 z-30"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(false);
          }}
        />
        <div className="absolute right-0 top-8 sm:top-9 w-44 bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800 p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 text-xs text-slate-200">
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
    )
  );

  // 1. Grid View for Folders: Sleek Google Drive style horizontal pill card
  if (viewMode === 'grid' && isFolder) {
    return (
      <div
        onClick={handleCardClick}
        className="group relative flex items-center justify-between p-3 rounded-2xl bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border border-slate-800 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 transition-all select-none cursor-pointer text-slate-200"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-slate-800/80 shadow-inner"
            style={{ backgroundColor: `${item.color || '#f59e0b'}15` }}
          >
            <Folder className="w-5 h-5 transition-transform group-hover:scale-110" style={{ color: item.color || '#f59e0b' }} />
          </div>

          <div className="min-w-0 flex-1">
            <span
              className="text-xs font-semibold text-slate-200 group-hover:text-amber-300 truncate block transition-colors"
              title={item.name}
            >
              {item.name}
            </span>
            <span className="text-[10px] text-slate-500 font-mono block">
              {item.item_count || 0} {item.item_count === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {onToggleStar && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(item);
              }}
              className={`p-1.5 rounded-lg hover:bg-slate-800 transition-colors ${
                item.is_starred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100'
              }`}
              title={item.is_starred ? 'Remove star' : 'Add star'}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
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
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {renderActionMenu()}
          </div>
        </div>
      </div>
    );
  }

  // 2. Grid View for Files: Modern Card with Preview Box & Meta Strip
  if (viewMode === 'grid' && !isFolder) {
    return (
      <div
        onClick={handleCardClick}
        className="group relative bg-slate-900 hover:bg-slate-850 active:bg-slate-800 rounded-2xl border border-slate-800 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5 transition-all p-3 select-none cursor-pointer flex flex-col justify-between text-slate-200"
      >
        {/* Card Header: Icon badge & Star/Menu */}
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800/80 shrink-0 shadow-inner">
            {renderIcon('w-4.5 h-4.5')}
          </div>

          <div className="flex items-center gap-0.5">
            {onToggleStar && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(item);
                }}
                className={`p-1.5 rounded-lg hover:bg-slate-800 transition-colors ${
                  item.is_starred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100'
                }`}
                title={item.is_starred ? 'Remove star' : 'Add star'}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
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
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {renderActionMenu()}
            </div>
          </div>
        </div>

        {/* Thumbnail Preview Area for Media or Clean Card Canvas */}
        {category === 'image' ? (
          <div className="h-24 sm:h-28 rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 flex items-center justify-center relative mb-2.5">
            <img
              src={fileAPI.getDownloadUrl(item.id, true)}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="h-20 sm:h-24 rounded-xl bg-slate-950/70 border border-slate-800/60 flex flex-col items-center justify-center relative mb-2.5 group-hover:border-slate-700/60 transition-colors">
            <div className="p-2 rounded-xl bg-slate-900/90 shadow-inner">
              {renderIcon('w-6 h-6')}
            </div>
            {extClean && (
              <span className="absolute bottom-2 right-2 text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                .{extClean.toLowerCase()}
              </span>
            )}
          </div>
        )}

        {/* Name and Meta Strip */}
        <div>
          <h4
            className="text-xs font-semibold text-slate-200 truncate group-hover:text-blue-400 transition-colors mb-1"
            title={item.name}
          >
            {item.name}
          </h4>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>{formatBytes(item.size)}</span>
            <span>{formatDate(item.updated_at)}</span>
          </div>
        </div>
      </div>
    );
  }

  // 3. Table List View (High-density unified table row for both files and folders)
  return (
    <div
      onClick={handleCardClick}
      className="group flex items-center justify-between px-3 sm:px-4 py-2.5 bg-slate-900/80 hover:bg-slate-850 active:bg-slate-800 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all select-none cursor-pointer text-xs text-slate-200"
    >
      {/* Column 1: Icon + Name + Shared Pill */}
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-3 sm:pr-6">
        <div className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 shadow-inner">
          {renderIcon('w-3.5 h-3.5 sm:w-4 sm:h-4')}
        </div>

        <div className="truncate flex items-center gap-2">
          <span className="font-semibold text-slate-200 truncate group-hover:text-blue-400 transition-colors">
            {item.name}
          </span>

          {item.shared_permission && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-md shrink-0">
              <Users className="w-2.5 h-2.5" />
              <span>Shared</span>
            </span>
          )}

          {!isFolder && extClean && (
            <span className="hidden md:inline-block text-[9px] font-mono font-medium text-slate-500 uppercase px-1 py-0.5 rounded bg-slate-950 border border-slate-800 shrink-0">
              {extClean}
            </span>
          )}
        </div>
      </div>

      {/* Column 2: Size, Modified Date, and Quick Actions */}
      <div className="flex items-center gap-2 sm:gap-6 shrink-0 text-slate-400">
        <span className="w-20 text-right hidden sm:inline font-mono text-[11px] text-slate-400">
          {isFolder ? `${item.item_count || 0} items` : formatBytes(item.size)}
        </span>

        <span className="w-24 text-right hidden md:inline text-[11px] text-slate-500">
          {formatDate(item.updated_at)}
        </span>

        {/* Action icons (Quick Download, Star, and 3-dots Menu) */}
        <div className="flex items-center gap-1">
          {onDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(item);
              }}
              className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100 hidden sm:inline-flex"
              title={isFolder ? 'Download ZIP' : 'Download'}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleStar && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(item);
              }}
              className={`p-1.5 rounded-lg hover:bg-slate-800 transition-colors ${
                item.is_starred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100'
              }`}
              title={item.is_starred ? 'Remove star' : 'Add star'}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
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
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {renderActionMenu()}
          </div>
        </div>
      </div>
    </div>
  );
}
