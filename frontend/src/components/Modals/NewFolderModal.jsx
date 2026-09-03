import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';

const COLORS = [
  { label: 'Default', hex: '#64748b' },
  { label: 'Blue', hex: '#3b82f6' },
  { label: 'Emerald', hex: '#10b981' },
  { label: 'Purple', hex: '#8b5cf6' },
  { label: 'Amber', hex: '#f59e0b' },
  { label: 'Rose', hex: '#f43f5e' },
];

import { useToast } from '../../context/ToastContext';

export default function NewFolderModal({ isOpen, onClose, onCreate }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].hex);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate(name.trim(), selectedColor);
      toast.success(`Folder "${name.trim()}" created successfully!`);
      setName('');
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="relative bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl shadow-black/80 border border-slate-800 p-5 sm:p-6 animate-in zoom-in-95 duration-150 text-slate-100 overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 -left-16 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-md shadow-blue-500/10">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">New Folder</h3>
              <p className="text-xs text-slate-400">Organize your files and projects</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Folder Name
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. backend-api, assets"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:border-blue-500 outline-none shadow-inner transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Folder Accent Color
            </label>
            <div className="flex items-center gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setSelectedColor(c.hex)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    selectedColor === c.hex ? 'scale-115 ring-2 ring-offset-2 ring-offset-slate-900 ring-blue-500 shadow-md' : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95"
            >
              {loading ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
