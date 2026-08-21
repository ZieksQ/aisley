import React from 'react';
import { FaTriangleExclamation, FaFloppyDisk, FaArrowRightFromBracket, FaXmark } from 'react-icons/fa6';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onSaveAndProceed: () => void;
  onDiscardAndProceed: () => void;
  onCancel: () => void;
  targetDestination?: string;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onSaveAndProceed,
  onDiscardAndProceed,
  onCancel,
  targetDestination = 'another page',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-[#0F172A] p-6 text-slate-900 dark:text-white shadow-2xl border border-slate-300 dark:border-slate-700 space-y-5">
        {/* Close top right button */}
        <button
          onClick={onCancel}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-center"
          aria-label="Close modal"
        >
          <FaXmark className="size-4" />
        </button>

        {/* Header with warning icon */}
        <div className="flex items-start gap-3.5">
          <div className="size-11 rounded-2xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700/80 flex items-center justify-center shrink-0">
            <FaTriangleExclamation className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
              Unsaved Settings Changes
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              You modified your store parameters without saving. If you proceed to {targetDestination}, your unsaved changes will be lost.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Keep Editing
          </button>

          <button
            type="button"
            onClick={onDiscardAndProceed}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FaArrowRightFromBracket className="size-3" /> Discard & Leave
          </button>

          <button
            type="button"
            onClick={onSaveAndProceed}
            className="px-5 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <FaFloppyDisk className="size-3.5" /> Save & Proceed
          </button>
        </div>
      </div>
    </div>
  );
};
