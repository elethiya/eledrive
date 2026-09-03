import React from 'react';
import { Clock } from 'lucide-react';

export default function RegistrationReviewScreen({ identifier, onReturn }) {
  return (
    <div className="py-2 animate-in fade-in zoom-in-95 duration-200">
      {/* Header with Clock in front of title and account message */}
      <div className="flex items-start gap-3.5 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-amber-500/20 to-amber-500/5 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 shadow-sm shadow-amber-500/10">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100 leading-tight">
            Registration Under Review
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed mt-1">
            {identifier ? (
              <>
                Your account for <strong className="text-amber-300 font-semibold">{identifier}</strong> was created successfully.
              </>
            ) : (
              <>Your account registration was received successfully.</>
            )}
          </p>
        </div>
      </div>

      <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-left mb-6 space-y-2">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-[11px] uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Pending Administrator Approval</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          To protect team workspaces and storage resources, an administrator must review and approve your account before you can sign in.
        </p>
      </div>

      <button
        onClick={onReturn}
        type="button"
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/25 transition-all"
      >
        Return to Sign In
      </button>
    </div>
  );
}
