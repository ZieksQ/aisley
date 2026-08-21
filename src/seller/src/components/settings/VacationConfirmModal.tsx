import React from 'react';
import { FaUmbrellaBeach, FaCircleCheck, FaXmark } from 'react-icons/fa6';

interface VacationConfirmModalProps {
  isOpen: boolean;
  isCurrentlyOnVacation: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const VacationConfirmModal: React.FC<VacationConfirmModalProps> = ({
  isOpen,
  isCurrentlyOnVacation,
  onConfirm,
  onCancel,
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

        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div
            className={`size-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              isCurrentlyOnVacation
                ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                : 'bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-300 border-amber-300 dark:border-amber-700'
            }`}
          >
            {isCurrentlyOnVacation ? (
              <FaCircleCheck className="size-5" />
            ) : (
              <FaUmbrellaBeach className="size-5" />
            )}
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
              {isCurrentlyOnVacation ? 'Resume Store Operations?' : 'Activate Vacation Mode?'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {isCurrentlyOnVacation
                ? 'Your boutique storefront will immediately reopen. Buyers across the Aisley marketplace will be able to browse and place new orders.'
                : 'Incoming orders will be temporarily paused on your storefront and buyers will see your vacation announcement banner.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
              isCurrentlyOnVacation
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-amber-600 hover:bg-amber-500'
            }`}
          >
            {isCurrentlyOnVacation ? 'Resume Store' : 'Confirm Vacation'}
          </button>
        </div>
      </div>
    </div>
  );
};
