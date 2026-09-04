import React, { useEffect } from 'react';
import { AlertTriangle, Info, Trash2, Users, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // 'danger' | 'warning' | 'info' | 'team' | 'share'
  icon,
  itemHighlight,
  subMessage,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          glow: 'bg-amber-500/10',
          badgeBg: 'bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10',
          defaultIcon: <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />,
          button:
            'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20 border border-amber-400/40',
        };
      case 'info':
      case 'team':
      case 'share':
        return {
          glow: 'bg-blue-500/10',
          badgeBg: 'bg-blue-500/15 border border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/10',
          defaultIcon: variant === 'team' || variant === 'share' ? <Users className="w-5 h-5 sm:w-6 sm:h-6" /> : <Info className="w-5 h-5 sm:w-6 sm:h-6" />,
          button:
            'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-600/25 border border-blue-500/30',
        };
      case 'danger':
      default:
        return {
          glow: 'bg-rose-500/10',
          badgeBg: 'bg-rose-500/15 border border-rose-500/30 text-rose-400 shadow-lg shadow-rose-500/10',
          defaultIcon: <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />,
          button:
            'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold shadow-lg shadow-rose-600/30 border border-rose-500/30',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="relative bg-slate-900 border border-slate-800/90 rounded-3xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl shadow-black/90 animate-in zoom-in-95 duration-150 overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div
          className={`absolute -top-16 -left-16 w-44 h-44 rounded-full blur-3xl pointer-events-none ${styles.glow}`}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-start gap-3.5 mb-2">
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${styles.badgeBg}`}>
            {icon || styles.defaultIcon}
          </div>
          <div className="pt-0.5 pr-6 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight leading-snug">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Optional item highlight card */}
        {itemHighlight && (
          typeof itemHighlight === 'object' ? (
            <div className="mt-3.5 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                {itemHighlight.avatarColor && (
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: itemHighlight.avatarColor }}
                  />
                )}
                <div className="truncate">
                  <span className="font-semibold text-slate-200 block truncate">
                    {itemHighlight.teamName || itemHighlight.name || itemHighlight.label}
                  </span>
                  {itemHighlight.membersCount !== undefined && (
                    <span className="text-[11px] text-slate-400 font-mono block">
                      {itemHighlight.membersCount} {itemHighlight.membersCount === 1 ? 'member' : 'members'}
                    </span>
                  )}
                </div>
              </div>
              {itemHighlight.permission && (
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/25 text-[11px] font-semibold text-blue-300 shrink-0">
                  {itemHighlight.permission}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-3.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-mono">
              {itemHighlight}
            </div>
          )
        )}

        {/* Optional secondary note */}
        {subMessage && (
          <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
            {subMessage}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 border border-slate-700 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`flex-1 sm:flex-none px-5 py-2.5 text-xs rounded-xl transition-all transform active:scale-95 cursor-pointer ${styles.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
