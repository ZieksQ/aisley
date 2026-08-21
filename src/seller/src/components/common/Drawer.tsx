import React, { useEffect } from 'react';
import { FaXmark } from 'react-icons/fa6';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: 'md' | 'lg' | 'xl' | '2xl';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClass = {
    md: 'max-w-md',
    lg: 'max-w-xl',
    xl: 'max-w-2xl',
    '2xl': 'max-w-3xl',
  }[width];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0B0F19]/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div
          className={`w-screen ${widthClass} transform bg-white shadow-2xl transition-transform border-l border-slate-300 flex flex-col`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 bg-white">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <FaXmark className="size-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        </div>
      </div>
    </div>
  );
};
