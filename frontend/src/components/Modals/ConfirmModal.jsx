import React, { useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, Trash2, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // 'danger' | 'warning' | 'info'
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          glow: 'bg-amber-500/10',
          iconBg: 'bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-amber-500/10',
          icon: <AlertCircle className="w-6 h-6" />,
          button:
            'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20',
        };
      case 'info':
        return {
          glow: 'bg-blue-500/10',
          iconBg: 'bg-blue-500/15 border border-blue-500/30 text-blue-400 shadow-blue-500/10',
          icon: <Info className="w-6 h-6" />,
          button:
            'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-600/25',
        };
      case 'danger':
      default:
        return {
          glow: 'bg-red-500/10',
          iconBg: 'bg-red-500/15 border border-red-500/30 text-red-400 shadow-red-500/10',
          icon: <Trash2 className="w-6 h-6" />,
          button:
            'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold shadow-lg shadow-red-600/30',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="relative bg-slate-900 border border-slate-800/90 rounded-3xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl shadow-black/90 animate-in zoom-in-95 duration-200 overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div
          className={`absolute -top-16 -left-16 w-40 h-40 rounded-full blur-3xl pointer-events-none ${styles.glow}`}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-start gap-3.5 mb-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${styles.iconBg}`}>
            {styles.icon}
          </div>
          <div className="pt-0.5 pr-6">
            <h3 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 border border-slate-700 rounded-xl transition-all shadow-xs"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`flex-1 sm:flex-none px-5 py-2.5 text-xs rounded-xl transition-all transform active:scale-95 ${styles.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
