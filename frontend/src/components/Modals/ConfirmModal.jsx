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
  showCloseButton = true,
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
          badgeBg: 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-md shadow-amber-500/10',
          defaultIcon: <AlertTriangle className="w-7 h-7" strokeWidth={1.8} />,
          button:
            'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-500/25 border border-amber-400/40',
        };
      case 'info':
      case 'team':
      case 'share':
        return {
          glow: 'bg-blue-500/10',
          badgeBg: 'bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-500/10',
          defaultIcon: variant === 'team' || variant === 'share' ? <Users className="w-7 h-7" strokeWidth={1.8} /> : <Info className="w-7 h-7" strokeWidth={1.8} />,
          button:
            'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-600/30 border border-blue-500/30',
        };
      case 'danger':
      default:
        return {
          glow: 'bg-rose-500/10',
          badgeBg: 'bg-[#24121b] border border-rose-500/30 text-rose-400 shadow-md shadow-rose-950/40',
          defaultIcon: <Trash2 className="w-7 h-7 text-rose-400" strokeWidth={1.8} />,
          button:
            'bg-[#df2137] hover:bg-[#c91d31] active:bg-[#b01729] text-white font-semibold shadow-lg shadow-red-600/35 border border-red-500/20',
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
        className="relative bg-[#0f1422] border border-slate-800/90 rounded-3xl max-w-[460px] w-full p-6 shadow-2xl shadow-black/90 animate-in zoom-in-95 duration-150 overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div
          className={`absolute -top-16 -left-16 w-44 h-44 rounded-full blur-3xl pointer-events-none ${styles.glow}`}
        />

        {/* Top-Right Close button as in image/1.png */}
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Icon & Title */}
        <div className="flex items-start gap-4 mb-1">
          {/* Rounded squircle icon badge */}
          <div className={`w-16 h-16 rounded-[22px] flex items-center justify-center shrink-0 ${styles.badgeBg}`}>
            {icon || styles.defaultIcon}
          </div>
          <div className="pt-1 pr-6 min-w-0 flex-1">
            <h3 className="text-[17px] font-bold text-white tracking-tight leading-snug">
              {title}
            </h3>
            <p className="text-[13px] text-slate-300/90 mt-1 leading-relaxed">
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
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            {subMessage}
          </p>
        )}

        {/* Divider line as in image/1.png */}
        <div className="border-t border-slate-800/80 my-5" />

        {/* Action Buttons: Centered with exact button shapes and gap as in image/1.png */}
        <div className="flex items-center justify-center gap-8">
          <button
            type="button"
            onClick={onClose}
            className="px-7 py-2 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white bg-[#1e293b] hover:bg-slate-700/80 active:bg-slate-800 border border-slate-700/70 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 min-w-[96px]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`px-7 py-2 text-xs sm:text-sm rounded-xl transition-all transform active:scale-95 cursor-pointer min-w-[130px] ${styles.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
