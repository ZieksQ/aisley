import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSeller } from '../../context/SellerContext';
import { Badge } from '../common/Badge';
import { UnsavedChangesModal } from './UnsavedChangesModal';
import { VacationConfirmModal } from './VacationConfirmModal';
import {
  FaStore,
  FaSun,
  FaMoon,
  FaCircleHalfStroke,
  FaLock,
  FaBuildingColumns,
  FaUmbrellaBeach,
  FaBell,
  FaFloppyDisk,
  FaCheck,
  FaCircleCheck,
  FaTruckFast,
  FaMobileScreen,
  FaKey,
  FaEnvelope,
  FaPhone,
  FaClock,
  FaSliders,
  FaEye,
  FaEyeSlash,
} from 'react-icons/fa6';

type SettingsTab =
  | 'information'
  | 'appearance'
  | 'security'
  | 'payout'
  | 'operations'
  | 'notifications';

export const SettingsView: React.FC = () => {
  const {
    storeSettings,
    updateStoreSettings,
    theme,
    setTheme,
    setIsSettingsDirty,
    pendingViewChange,
    confirmPendingNavigation,
    cancelPendingNavigation,
    setSaveSettingsHandler,
  } = useSeller();

  const [activeTab, setActiveTab] = useState<SettingsTab>('information');
  const [pendingInternalTab, setPendingInternalTab] = useState<SettingsTab | null>(null);

  // Store Information State
  const [storeName, setStoreName] = useState(storeSettings.storeName);
  const [tagline, setTagline] = useState(storeSettings.tagline);
  const [bio, setBio] = useState(storeSettings.bio);
  const [logoUrl, setLogoUrl] = useState(storeSettings.logoUrl);
  const [bannerUrl, setBannerUrl] = useState(storeSettings.bannerUrl);
  const [contactEmail, setContactEmail] = useState(storeSettings.contactEmail);
  const [contactPhone, setContactPhone] = useState(storeSettings.contactPhone);

  // Operations & Vacation State
  const [vacationMode, setVacationMode] = useState(storeSettings.vacationMode);
  const [vacationNotice, setVacationNotice] = useState(storeSettings.vacationNotice || '');
  const [defaultCourier, setDefaultCourier] = useState('Aisley Express');
  const [dailyCutoffTime, setDailyCutoffTime] = useState('16:00');
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);

  // Payout Bank State
  const [payoutProvider, setPayoutProvider] = useState<
    'GCash' | 'Maya' | 'BDO Unibank' | 'BPI' | 'UnionBank of the Philippines' | 'Metrobank'
  >(storeSettings.payoutBank.provider);
  const [accountName, setAccountName] = useState(storeSettings.payoutBank.accountName);
  const [accountNumber, setAccountNumber] = useState(storeSettings.payoutBank.accountNumber);
  const [autoSchedule, setAutoSchedule] = useState<'daily' | 'weekly' | 'biweekly'>(
    storeSettings.payoutBank.autoDisbursementSchedule
  );

  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [showIpAddress, setShowIpAddress] = useState(false);

  // Notification Preferences State
  const [notifyNewOrder, setNotifyNewOrder] = useState(true);
  const [notifyChatInquiry, setNotifyChatInquiry] = useState(true);
  const [notifyCourierHandover, setNotifyCourierHandover] = useState(true);
  const [notifyLowStock, setNotifyLowStock] = useState(true);
  const [notifyWeeklyStatement, setNotifyWeeklyStatement] = useState(true);

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Calculate if form is dirty
  const isDirty = useMemo(() => {
    return (
      storeName !== storeSettings.storeName ||
      tagline !== storeSettings.tagline ||
      bio !== storeSettings.bio ||
      logoUrl !== storeSettings.logoUrl ||
      bannerUrl !== storeSettings.bannerUrl ||
      contactEmail !== storeSettings.contactEmail ||
      contactPhone !== storeSettings.contactPhone ||
      vacationMode !== storeSettings.vacationMode ||
      vacationNotice !== (storeSettings.vacationNotice || '') ||
      payoutProvider !== storeSettings.payoutBank.provider ||
      accountName !== storeSettings.payoutBank.accountName ||
      accountNumber !== storeSettings.payoutBank.accountNumber ||
      autoSchedule !== storeSettings.payoutBank.autoDisbursementSchedule ||
      currentPassword.length > 0 ||
      newPassword.length > 0 ||
      confirmPassword.length > 0
    );
  }, [
    storeName,
    tagline,
    bio,
    logoUrl,
    bannerUrl,
    contactEmail,
    contactPhone,
    vacationMode,
    vacationNotice,
    payoutProvider,
    accountName,
    accountNumber,
    autoSchedule,
    currentPassword,
    newPassword,
    confirmPassword,
    storeSettings,
  ]);

  // Sync dirty state to global context
  useEffect(() => {
    setIsSettingsDirty(isDirty);
    return () => setIsSettingsDirty(false);
  }, [isDirty, setIsSettingsDirty]);

  const handleSave = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      updateStoreSettings({
        storeName,
        tagline,
        bio,
        logoUrl,
        bannerUrl,
        contactEmail,
        contactPhone,
        vacationMode,
        vacationNotice,
        payoutBank: {
          provider: payoutProvider,
          accountName,
          accountNumber,
          autoDisbursementSchedule: autoSchedule,
          isVerified: true,
        },
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsSettingsDirty(false);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    },
    [
      storeName,
      tagline,
      bio,
      logoUrl,
      bannerUrl,
      contactEmail,
      contactPhone,
      vacationMode,
      vacationNotice,
      payoutProvider,
      accountName,
      accountNumber,
      autoSchedule,
      updateStoreSettings,
      setIsSettingsDirty,
    ]
  );

  // Register save handler for context navigation guard
  useEffect(() => {
    setSaveSettingsHandler(() => handleSave);
    return () => setSaveSettingsHandler(null);
  }, [handleSave, setSaveSettingsHandler]);

  // Handle switching sub-tabs inside settings
  const handleTabClick = (tabId: SettingsTab) => {
    if (tabId === activeTab) return;
    if (isDirty) {
      setPendingInternalTab(tabId);
    } else {
      setActiveTab(tabId);
    }
  };

  const resetFormToSaved = () => {
    setStoreName(storeSettings.storeName);
    setTagline(storeSettings.tagline);
    setBio(storeSettings.bio);
    setLogoUrl(storeSettings.logoUrl);
    setBannerUrl(storeSettings.bannerUrl);
    setContactEmail(storeSettings.contactEmail);
    setContactPhone(storeSettings.contactPhone);
    setVacationMode(storeSettings.vacationMode);
    setVacationNotice(storeSettings.vacationNotice || '');
    setPayoutProvider(storeSettings.payoutBank.provider);
    setAccountName(storeSettings.payoutBank.accountName);
    setAccountNumber(storeSettings.payoutBank.accountNumber);
    setAutoSchedule(storeSettings.payoutBank.autoDisbursementSchedule);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsSettingsDirty(false);
  };

  const handleInternalSaveAndProceed = () => {
    handleSave();
    if (pendingInternalTab) {
      setActiveTab(pendingInternalTab);
      setPendingInternalTab(null);
    }
  };

  const handleInternalDiscardAndProceed = () => {
    resetFormToSaved();
    if (pendingInternalTab) {
      setActiveTab(pendingInternalTab);
      setPendingInternalTab(null);
    }
  };

  const handleConfirmVacationToggle = () => {
    const newVacationState = !vacationMode;
    setVacationMode(newVacationState);
    updateStoreSettings({ vacationMode: newVacationState });
    setIsVacationModalOpen(false);
  };

  const navCategories: {
    id: SettingsTab;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'information',
      label: 'Store Information',
      description: 'Brand identity, bio & contacts',
      icon: <FaStore className="size-4" />,
    },
    {
      id: 'appearance',
      label: 'Appearance & Theme',
      description: 'Light and Obsidian Dark mode',
      icon: <FaCircleHalfStroke className="size-4" />,
    },
    {
      id: 'security',
      label: 'Security & Access',
      description: 'Password, 2FA & active sessions',
      icon: <FaLock className="size-4" />,
    },
    {
      id: 'payout',
      label: 'Payout & Banking',
      description: 'Disbursement accounts & schedule',
      icon: <FaBuildingColumns className="size-4" />,
    },
    {
      id: 'operations',
      label: 'Operations & Logistics',
      description: 'Vacation mode & carrier cutoffs',
      icon: <FaSliders className="size-4" />,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      description: 'SMS, email & chat alerts',
      icon: <FaBell className="size-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Global Save Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Store Profile & Configuration
            </h1>
            {isDirty && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 text-[10px] font-bold">
                Unsaved Edits
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure boutique brand presentation, banking settlement channels, security, and operations.
          </p>
        </div>

        <button
          onClick={() => handleSave()}
          type="button"
          className="px-6 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center gap-2 cursor-pointer"
        >
          {savedSuccess ? (
            <>
              <FaCheck className="text-white size-3.5" /> Settings Saved!
            </>
          ) : (
            <>
              <FaFloppyDisk className="size-3.5" /> Save Changes
            </>
          )}
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-300 flex items-center gap-2.5 font-bold text-xs shadow-xs transition-all">
          <FaCircleCheck className="text-emerald-600 dark:text-emerald-400 size-4 shrink-0" />
          <span>All store profile parameters and financial preferences updated successfully.</span>
        </div>
      )}

      {/* Main Settings Split: Left Sub-Sidebar + Right Content Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sub-Sidebar (4 cols on lg) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-3 shadow-sm space-y-1">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Settings Navigation
            </span>
            {isDirty && (
              <span className="size-2 rounded-full bg-amber-500" title="Unsaved changes pending" />
            )}
          </div>

          <div className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible no-scrollbar pb-1 lg:pb-0">
            {navCategories.map((cat) => {
              const isActive = activeTab === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => handleTabClick(cat.id)}
                  className={`w-full text-left p-3 rounded-xl transition cursor-pointer flex items-center gap-3 shrink-0 lg:shrink ${
                    isActive
                      ? 'bg-[#E723A2] text-white shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div
                    className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-[#E723A2] dark:text-pink-400'
                    }`}
                  >
                    {cat.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate leading-tight">{cat.label}</p>
                    <p
                      className={`text-[10px] truncate ${
                        isActive ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {cat.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Settings Content Canvas (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-6">
          {/* TAB 1: STORE INFORMATION */}
          {activeTab === 'information' && (
            <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <FaStore className="text-[#E723A2]" /> Store Profile & Brand Identity
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    How your store appears to customers across the Aisley marketplace storefront.
                  </p>
                </div>
                <Badge variant="primary">Public Profile</Badge>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Boutique Store Name <span className="text-[#E723A2]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Store Tagline & Pitch
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Refined Haute Couture, Raw Silk Tailoring & Fine Artisanal Adornments"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Brand Biography & Craftsmanship Heritage
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe your design philosophy, materials sourced, and bespoke heritage..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Store Logo Image URL
                    </label>
                    <div className="flex items-center gap-3">
                      <img
                        src={logoUrl}
                        alt="Logo Preview"
                        className="size-12 rounded-xl object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                      />
                      <input
                        type="url"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono-num text-xs focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Store Banner Hero URL
                    </label>
                    <input
                      type="url"
                      value={bannerUrl}
                      onChange={(e) => setBannerUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono-num text-xs focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                      <FaEnvelope className="text-[#E723A2]" /> Customer Service Email
                    </label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                      <FaPhone className="text-[#0284C7]" /> Support Phone / Landline
                    </label>
                    <input
                      type="tel"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium font-mono-num focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE & THEME */}
          {activeTab === 'appearance' && (
            <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <FaCircleHalfStroke className="text-[#E723A2]" /> Appearance & Interface Theme
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Customize your console visual experience across all seller screens.
                  </p>
                </div>
                <Badge variant={theme === 'dark' ? 'neutral' : 'warning'}>
                  Current: {theme === 'dark' ? 'Obsidian Noir' : 'Light Canvas'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Light Mode Card */}
                <div
                  onClick={() => setTheme('light')}
                  className={`p-5 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between ${
                    theme === 'light'
                      ? 'border-[#E723A2] bg-[#FDF2F9] text-slate-900 shadow-sm'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="size-10 rounded-xl bg-white border border-slate-300 flex items-center justify-center text-amber-500 shadow-xs">
                      <FaSun className="size-5" />
                    </div>
                    {theme === 'light' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#E723A2] text-white text-[10px] font-bold">
                        Active Theme
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <h3 className="font-black text-sm">Light Canvas Mode</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Clean boutique white canvas with blueprint architectural grid and high-contrast borders.
                    </p>
                  </div>
                </div>

                {/* Dark Mode Card */}
                <div
                  onClick={() => setTheme('dark')}
                  className={`p-5 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between ${
                    theme === 'dark'
                      ? 'border-[#E723A2] bg-[#FDF2F9] dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="size-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400 shadow-xs">
                      <FaMoon className="size-5" />
                    </div>
                    {theme === 'dark' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#E723A2] text-white text-[10px] font-bold">
                        Active Theme
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <h3 className="font-black text-sm">Obsidian Noir Dark Mode</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Deep luxury obsidian dark palette optimized for reduced eye strain and evening store fulfillment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & AUTHENTICATION */}
          {activeTab === 'security' && (
            <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <FaLock className="text-[#E723A2]" /> Security, Passwords & Access Control
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Maintain secure access to your merchant finances, tokens, and staff authorization.
                  </p>
                </div>
                <Badge variant="success" dot>Sanctum RBAC Guarded</Badge>
              </div>

              {/* Password update fields */}
              <div className="space-y-4 text-xs">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Update Account Password
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2FA Toggle */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-sky-50 dark:bg-sky-950/70 text-[#0284C7] dark:text-sky-300 flex items-center justify-center border border-sky-200 dark:border-sky-800/80 shrink-0">
                    <FaKey className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Two-Factor Authentication (2FA) for GCash / Bank Payouts
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Requires one-time OTP verification to modify disbursement accounts or change payout thresholds.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    twoFactorEnabled
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {twoFactorEnabled ? '2FA Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Active Sessions with Hidden IP Toggle */}
              <div className="space-y-3 pt-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Active Verified Sessions
                </h3>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-300 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 text-xs">
                  <div className="p-3.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <FaMobileScreen className="text-[#E723A2] size-4 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">Google Chrome (Linux OS / BGC Makati)</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono-num">
                            Current Session • IP:{' '}
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {showIpAddress ? '120.29.88.19' : '••••••••••••'}
                            </span>
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowIpAddress(!showIpAddress)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer flex items-center justify-center"
                            title={showIpAddress ? 'Hide IP Address' : 'Reveal IP Address'}
                          >
                            {showIpAddress ? <FaEyeSlash className="size-3" /> : <FaEye className="size-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <Badge variant="success" size="sm">Active Now</Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PAYOUT & BANKING */}
          {activeTab === 'payout' && (
            <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <FaBuildingColumns className="text-[#E723A2]" /> Automated Merchant Disbursement Channel
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Net settlement payouts are automatically transferred according to your disbursement schedule.
                  </p>
                </div>
                <Badge variant="success" dot>Bank Verified</Badge>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Banking / E-Wallet Provider
                    </label>
                    <select
                      value={payoutProvider}
                      onChange={(e) => setPayoutProvider(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    >
                      <option value="GCash">GCash Business (0917-xxx-xxxx)</option>
                      <option value="Maya">Maya Business</option>
                      <option value="BDO Unibank">BDO Unibank (Checking / Savings)</option>
                      <option value="BPI">BPI (Commercial)</option>
                      <option value="UnionBank of the Philippines">UnionBank MSME Hub</option>
                      <option value="Metrobank">Metrobank Corporate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Disbursement Schedule Cycle
                    </label>
                    <select
                      value={autoSchedule}
                      onChange={(e) => setAutoSchedule(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    >
                      <option value="daily">Daily Auto-Disbursement (17:00 PHT)</option>
                      <option value="weekly">Weekly (Every Monday Morning)</option>
                      <option value="biweekly">Bi-Weekly (15th & 30th Cut-off)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Registered Account Holder Name <span className="text-[#E723A2]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Account / Mobile Number <span className="text-[#E723A2]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono-num font-bold focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: OPERATIONS & LOGISTICS */}
          {activeTab === 'operations' && (
            <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <FaSliders className="text-[#E723A2]" /> Operations, Cut-offs & Vacation Mode
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Configure daily courier cutoff windows and temporary store pause states.
                  </p>
                </div>
                <Badge variant={vacationMode ? 'warning' : 'success'}>
                  {vacationMode ? 'Store On Break' : 'Store Open'}
                </Badge>
              </div>

              {/* Vacation Mode Toggle with Confirmation Modal Prompt */}
              <div
                className={`p-5 rounded-2xl border transition space-y-3 ${
                  vacationMode
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                    : 'bg-[#F8FAFC] dark:bg-slate-900/60 border-slate-300 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <FaUmbrellaBeach className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-slate-900 dark:text-white">Vacation Mode & Storefront Pause</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Pauses incoming orders while you attend fashion runway shows or material sourcing trips.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsVacationModalOpen(true)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer shrink-0 ${
                      vacationMode
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {vacationMode ? 'Vacation Active' : 'Enable Vacation'}
                  </button>
                </div>

                {vacationMode && (
                  <div className="pt-2">
                    <label className="block font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Customer Notice Message
                    </label>
                    <textarea
                      rows={2}
                      value={vacationNotice}
                      onChange={(e) => setVacationNotice(e.target.value)}
                      placeholder="e.g. Our boutique is currently paused for seasonal collection fabrication. Incoming orders resume Monday."
                      className="w-full px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Logistics Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <FaTruckFast className="text-[#E723A2]" /> Preferred Primary Logistics Fleet
                  </label>
                  <select
                    value={defaultCourier}
                    onChange={(e) => setDefaultCourier(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    <option value="Aisley Express">Aisley Express (White Glove Fleet)</option>
                    <option value="J&T Express">J&T Express (Island Nationwide)</option>
                    <option value="Flash Express">Flash Express (Urban Hubs)</option>
                    <option value="Lalamove">Lalamove (Same-Day Direct)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <FaClock className="text-[#0284C7]" /> Daily Order Cut-off Window (PHT)
                  </label>
                  <input
                    type="time"
                    value={dailyCutoffTime}
                    onChange={(e) => setDailyCutoffTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono-num font-bold focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: NOTIFICATIONS & PREFERENCES */}
          {activeTab === 'notifications' && (
            <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <FaBell className="text-[#E723A2]" /> Notification & Sound Alert Preferences
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Control how and when you receive critical alerts regarding orders and client inquiries.
                  </p>
                </div>
                <Badge variant="primary">Real-time Push</Badge>
              </div>

              <div className="space-y-3 text-xs divide-y divide-slate-200 dark:divide-slate-800">
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">New Customer Order Alerts</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">Instant audio chime & email when an order is placed</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyNewOrder}
                    onChange={(e) => setNotifyNewOrder(e.target.checked)}
                    className="size-5 accent-[#E723A2] cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Client Concierge Chat Messages</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">Push alert for incoming buyer inquiry messages</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyChatInquiry}
                    onChange={(e) => setNotifyChatInquiry(e.target.checked)}
                    className="size-5 accent-[#E723A2] cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Courier Pickup & Handover Reminders</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">SMS alert 1 hour prior to scheduled courier arrival</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyCourierHandover}
                    onChange={(e) => setNotifyCourierHandover(e.target.checked)}
                    className="size-5 accent-[#E723A2] cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Low Inventory Threshold Warning</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">Notify when SKU stock falls below designated threshold</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyLowStock}
                    onChange={(e) => setNotifyLowStock(e.target.checked)}
                    className="size-5 accent-[#E723A2] cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Weekly Payout Statement Digest</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">Certified PDF settlement summary sent to registered email</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyWeeklyStatement}
                    onChange={(e) => setNotifyWeeklyStatement(e.target.checked)}
                    className="size-5 accent-[#E723A2] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unsaved Changes Modal for Internal Tab Switching */}
      <UnsavedChangesModal
        isOpen={Boolean(pendingInternalTab)}
        targetDestination={pendingInternalTab ? `${pendingInternalTab} tab` : 'another section'}
        onSaveAndProceed={handleInternalSaveAndProceed}
        onDiscardAndProceed={handleInternalDiscardAndProceed}
        onCancel={() => setPendingInternalTab(null)}
      />

      {/* Unsaved Changes Modal for Global Navigation (to Dashboard, Orders, etc.) */}
      <UnsavedChangesModal
        isOpen={Boolean(pendingViewChange)}
        targetDestination={pendingViewChange ? `${pendingViewChange} view` : 'another page'}
        onSaveAndProceed={() => confirmPendingNavigation(true)}
        onDiscardAndProceed={() => confirmPendingNavigation(false)}
        onCancel={cancelPendingNavigation}
      />

      {/* Vacation Confirmation Modal */}
      <VacationConfirmModal
        isOpen={isVacationModalOpen}
        isCurrentlyOnVacation={vacationMode}
        onConfirm={handleConfirmVacationToggle}
        onCancel={() => setIsVacationModalOpen(false)}
      />
    </div>
  );
};
