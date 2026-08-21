import React, { useState } from 'react';
import { useSeller } from '../../context/SellerContext';
import {
  FaStore,
  FaBuildingColumns,
  FaFileShield,
  FaUmbrellaBeach,
  FaFloppyDisk,
  FaCheck,
  FaCircleCheck,
  FaShieldHalved,
} from 'react-icons/fa6';

export const SettingsView: React.FC = () => {
  const { storeSettings, updateStoreSettings } = useSeller();

  // Local form state
  const [storeName, setStoreName] = useState(storeSettings.storeName);
  const [tagline, setTagline] = useState(storeSettings.tagline);
  const [bio, setBio] = useState(storeSettings.bio);
  const [logoUrl, setLogoUrl] = useState(storeSettings.logoUrl);
  const [bannerUrl, setBannerUrl] = useState(storeSettings.bannerUrl);
  const [contactEmail, setContactEmail] = useState(storeSettings.contactEmail);
  const [contactPhone, setContactPhone] = useState(storeSettings.contactPhone);
  const [vacationMode, setVacationMode] = useState(storeSettings.vacationMode);
  const [vacationNotice, setVacationNotice] = useState(storeSettings.vacationNotice || '');

  // Payout Bank
  const [payoutProvider, setPayoutProvider] = useState(storeSettings.payoutBank.provider);
  const [accountName, setAccountName] = useState(storeSettings.payoutBank.accountName);
  const [accountNumber, setAccountNumber] = useState(storeSettings.payoutBank.accountNumber);
  const [autoSchedule, setAutoSchedule] = useState(storeSettings.payoutBank.autoDisbursementSchedule);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
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

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 text-xs max-w-5xl">
      {/* Top Header & Save Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Atelier Store Profile & Financial Settings
          </h1>
          <p className="text-xs text-slate-500">
            Manage your boutique brand presentation, automated payouts, and verified tax credentials.
          </p>
        </div>

        <button
          type="submit"
          className="px-6 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center gap-2 cursor-pointer"
        >
          {savedSuccess ? (
            <>
              <FaCheck className="text-white" /> Settings Saved!
            </>
          ) : (
            <>
              <FaFloppyDisk /> Save All Settings
            </>
          )}
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 font-bold">
          <FaCircleCheck className="text-emerald-600 size-4 shrink-0" />
          <span>Atelier configuration and payout settings updated successfully.</span>
        </div>
      )}

      {/* Vacation Mode Toggle Card */}
      <div
        className={`rounded-2xl border p-5 transition ${
          vacationMode ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`size-10 rounded-xl grid place-items-center shrink-0 ${
                vacationMode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <FaUmbrellaBeach className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">Atelier Vacation Mode</h3>
                <span
                  className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase ${
                    vacationMode
                      ? 'bg-amber-200 text-amber-900 font-mono-num'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {vacationMode ? 'Active (Paused)' : 'Normal Operations'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                When active, your listings remain visible for browsing, but new checkout orders are paused with your custom notice.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={vacationMode}
              onChange={(e) => setVacationMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        {vacationMode && (
          <div className="mt-4 pt-4 border-t border-amber-200">
            <label className="block font-bold text-amber-950 mb-1">
              Buyer Vacation Banner Notice:
            </label>
            <input
              type="text"
              value={vacationNotice}
              onChange={(e) => setVacationNotice(e.target.value)}
              placeholder="e.g. Our atelier is paused for seasonal fabric dyeing. Deliveries resume Monday."
              className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Atelier Store Profile Information */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <FaStore className="text-[#E723A2]" /> Atelier Brand Profile
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Store / Brand Name
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Brand Tagline
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
            Atelier Biography & Brand Heritage
          </label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Concierge Contact Email
            </label>
            <input
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Atelier Hotline Number
            </label>
            <input
              type="text"
              required
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>
        </div>

        {/* Visual Brand Assets (Logo & Banner) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2">
            <label className="block font-bold uppercase tracking-wider text-slate-700">
              Brand Logo URL
            </label>
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="Logo preview"
                className="size-14 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2">
            <label className="block font-bold uppercase tracking-wider text-slate-700">
              Storefront Banner Cover URL
            </label>
            <div className="flex items-center gap-3">
              <img
                src={bannerUrl}
                alt="Banner preview"
                className="w-20 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <input
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payout Banking & Auto-Disbursement */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <FaBuildingColumns className="text-[#10B981]" /> Automated Payout & Settlement Channel
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
            <FaShieldHalved /> Bank KYC Verified
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Disbursement Provider
            </label>
            <select
              value={payoutProvider}
              onChange={(e) => setPayoutProvider(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            >
              <option value="GCash">GCash (Instant Philippine Wallet)</option>
              <option value="Maya">Maya (Enterprise Payout)</option>
              <option value="BDO Unibank">BDO Unibank (Banco de Oro)</option>
              <option value="BPI">Bank of the Philippine Islands (BPI)</option>
              <option value="UnionBank of the Philippines">UnionBank of the Philippines</option>
              <option value="Metrobank">Metrobank</option>
            </select>
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Account Registered Name
            </label>
            <input
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Account / Phone Number
            </label>
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono-num font-bold focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
            Auto-Disbursement Frequency
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'daily', title: 'Daily Settlement', desc: 'Disbursed every 18:00 PHT' },
              { id: 'weekly', title: 'Weekly Batch', desc: 'Every Monday morning' },
              { id: 'biweekly', title: 'Bi-Weekly', desc: '15th & 30th of month' },
            ].map((s) => (
              <div
                key={s.id}
                onClick={() => setAutoSchedule(s.id as any)}
                className={`p-3 rounded-xl border-2 cursor-pointer transition ${
                  autoSchedule === s.id
                    ? 'border-[#E723A2] bg-[#FDF2F9]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="font-bold text-slate-900">{s.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KYC & Tax Document Repository */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <FaFileShield className="text-slate-900" /> Compliance Document Repository & BIR Tax Info
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            All Documents Approved
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Registered Tax Entity</span>
            <p className="font-bold text-slate-900">{storeSettings.taxInfo.registeredEntityName}</p>
            <p className="text-[11px] font-mono-num text-slate-500">TIN: {storeSettings.taxInfo.tinNumber}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">BIR Form 2303 Certificate</span>
            <p className="font-bold text-emerald-700 flex items-center gap-1">
              <FaCircleCheck className="size-3" /> {storeSettings.taxInfo.bir2303FileName}
            </p>
            <p className="text-[10px] text-slate-400">Status: Verified Official</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">DTI / SEC Corporate Permit</span>
            <p className="font-bold text-emerald-700 flex items-center gap-1">
              <FaCircleCheck className="size-3" /> {storeSettings.taxInfo.dtiSecFileName}
            </p>
            <p className="text-[10px] text-slate-400">Reg: {storeSettings.taxInfo.dtiSecRegistrationNumber}</p>
          </div>
        </div>
      </div>
    </form>
  );
};
