import React, { useState, useEffect } from 'react';
import { useSeller } from '../../context/SellerContext';
import { PHILIPPINE_ADDRESS_DATA } from '../../data/philippineAddresses';
import { calculateAge } from '../../utils/formatters';
import type { Sex } from '../../types/auth';
import {
  FaArrowRight,
  FaArrowLeft,
  FaCheck,
  FaTriangleExclamation,
  FaCircleInfo,
  FaFilePdf,
  FaFileImage,
} from 'react-icons/fa6';

interface RegisterWizardProps {
  onSwitchToLogin: () => void;
}

export const RegisterWizard: React.FC<RegisterWizardProps> = ({ onSwitchToLogin }) => {
  const { registerSeller } = useSeller();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Personal Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [sex, setSex] = useState<Sex>('Female');
  const [email, setEmail] = useState('');
  const [contactNo, setContactNo] = useState('+63 9');
  const [birthday, setBirthday] = useState('2000-01-01');
  const [age, setAge] = useState<number>(calculateAge('2000-01-01'));
  const [ageError, setAgeError] = useState<string | null>(null);

  // Step 2: Business & Address
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('Apparel & Haute Couture');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState(PHILIPPINE_ADDRESS_DATA[0].province);
  const [selectedCity, setSelectedCity] = useState(PHILIPPINE_ADDRESS_DATA[0].cities[0].name);
  const [selectedBarangay, setSelectedBarangay] = useState(PHILIPPINE_ADDRESS_DATA[0].cities[0].barangays[0]);
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [postalCode, setPostalCode] = useState(PHILIPPINE_ADDRESS_DATA[0].cities[0].postalCode);

  // Step 3: KYC
  const [idType, setIdType] = useState('Philippine Passport');
  const [govIdFileName] = useState('government_id_scan.pdf');
  const [permitFileName] = useState('dti_sec_permit_2026.pdf');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-calculate age whenever birthday changes
  useEffect(() => {
    if (birthday) {
      const calculated = calculateAge(birthday);
      setAge(calculated);
      if (calculated < 18) {
        setAgeError('Aisley requires atelier sellers to be at least 18 years old.');
      } else {
        setAgeError(null);
      }
    }
  }, [birthday]);

  // Update cities when province changes
  useEffect(() => {
    const provObj = PHILIPPINE_ADDRESS_DATA.find((p) => p.province === selectedProvince);
    if (provObj && provObj.cities.length > 0) {
      setSelectedCity(provObj.cities[0].name);
      setSelectedBarangay(provObj.cities[0].barangays[0]);
      setPostalCode(provObj.cities[0].postalCode);
    }
  }, [selectedProvince]);

  // Update barangays when city changes
  useEffect(() => {
    const provObj = PHILIPPINE_ADDRESS_DATA.find((p) => p.province === selectedProvince);
    const cityObj = provObj?.cities.find((c) => c.name === selectedCity);
    if (cityObj && cityObj.barangays.length > 0) {
      setSelectedBarangay(cityObj.barangays[0]);
      setPostalCode(cityObj.postalCode);
    }
  }, [selectedCity, selectedProvince]);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep === 1) {
      if (age < 18) {
        setAgeError('You must be at least 18 years old to register as an atelier seller.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAgreed) {
      alert('Please agree to the Aisley Atelier Terms and Marketplace Guidelines.');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      registerSeller({
        firstName,
        lastName,
        middleInitial,
        sex,
        email,
        contactNo,
        birthday,
        age,
        businessName,
        businessCategory: isCustomCategory ? customCategory : businessCategory,
        address: {
          province: selectedProvince,
          city: selectedCity,
          barangay: selectedBarangay,
          street,
          houseNumber,
          postalCode,
        },
        kyc: {
          idType,
          idFileName: govIdFileName,
          businessPermitFileName: permitFileName,
          submittedAt: new Date().toISOString(),
        },
      });
    }, 800);
  };

  const currentCities =
    PHILIPPINE_ADDRESS_DATA.find((p) => p.province === selectedProvince)?.cities || [];
  const currentBarangays =
    currentCities.find((c) => c.name === selectedCity)?.barangays || [];

  return (
    <div className="w-full max-w-2xl mx-auto my-4">
      {/* 3-Step Milestone Stepper Card */}
      <div className="rounded-3xl bg-white p-6 sm:p-8 text-slate-900 shadow-2xl border border-slate-100 relative">
        {/* Step Indicator Header */}
        <div className="mb-8 border-b border-slate-100 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#E723A2]">
                Step {currentStep} of 3
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                {currentStep === 1 && 'Personal Information'}
                {currentStep === 2 && 'Business & Registered Address'}
                {currentStep === 3 && 'KYC Verification & Notice'}
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`size-8 rounded-full grid place-items-center text-xs font-bold transition ${
                    step === currentStep
                      ? 'bg-[#E723A2] text-white shadow-sm'
                      : step < currentStep
                      ? 'bg-[#10B981] text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {step < currentStep ? <FaCheck className="size-3" /> : step}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step 1: Personal Info */}
        {currentStep === 1 && (
          <form onSubmit={handleNextStep} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  First Name <span className="text-[#E723A2]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Lorenzo"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Last Name <span className="text-[#E723A2]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Valdez"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Middle Initial
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={middleInitial}
                  onChange={(e) => setMiddleInitial(e.target.value.toUpperCase())}
                  placeholder="e.g. M"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Sex <span className="text-[#E723A2]">*</span>
                </label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as Sex)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Official Email Address <span className="text-[#E723A2]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seller@domain.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Contact Number (PH) <span className="text-[#E723A2]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactNo}
                  onChange={(e) => setContactNo(e.target.value)}
                  placeholder="+63 917 000 0000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                />
              </div>
            </div>

            {/* Birthday & Auto-calculated Age */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Birthday <span className="text-[#E723A2]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                  <span>Age (Auto-Generated)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Min. 18 years old</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    readOnly
                    value={age}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-900 font-mono-num"
                  />
                  <div
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold shrink-0 border ${
                      age >= 18
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {age >= 18 ? 'Eligible' : 'Underage'}
                  </div>
                </div>
              </div>
            </div>

            {ageError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <FaTriangleExclamation className="shrink-0" />
                <span>{ageError}</span>
              </div>
            )}

            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-xs font-bold text-slate-500 hover:text-slate-900"
              >
                &larr; Back to Login
              </button>

              <button
                type="submit"
                disabled={age < 18}
                className="px-6 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                Proceed to Business & Address <FaArrowRight className="size-3" />
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Business & Cascading Address */}
        {currentStep === 2 && (
          <form onSubmit={handleNextStep} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Business / Brand Name <span className="text-[#E723A2]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Manila Silk & Linen Guild"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Line of Business Category <span className="text-[#E723A2]">*</span>
                </label>
                {!isCustomCategory ? (
                  <select
                    value={businessCategory}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomCategory(true);
                      } else {
                        setBusinessCategory(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    <option value="Apparel & Haute Couture">Apparel & Haute Couture</option>
                    <option value="Silks & Handwoven Textiles">Silks & Handwoven Textiles</option>
                    <option value="Fine Jewelry & Metals">Fine Jewelry & Metals</option>
                    <option value="Artisanal Leather">Artisanal Leather</option>
                    <option value="Botanical Fragrances">Botanical Fragrances</option>
                    <option value="Handcrafted Ceramics">Handcrafted Ceramics</option>
                    <option value="__custom__">+ Add Custom Category...</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bespoke Millinery & Hats"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(false)}
                      className="px-2 text-xs font-semibold text-slate-400 hover:text-slate-700"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Cascading Philippine Address Selectors */}
            <div className="pt-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-900 mb-2">
                Philippine Registered Atelier Address
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Province <span className="text-[#E723A2]">*</span>
                  </label>
                  <select
                    value={selectedProvince}
                    onChange={(e) => setSelectedProvince(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    {PHILIPPINE_ADDRESS_DATA.map((p) => (
                      <option key={p.province} value={p.province}>
                        {p.province}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Municipality / City <span className="text-[#E723A2]">*</span>
                  </label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    {currentCities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Barangay <span className="text-[#E723A2]">*</span>
                  </label>
                  <select
                    value={selectedBarangay}
                    onChange={(e) => setSelectedBarangay(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    {currentBarangays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Street & Building / Landmark <span className="text-[#E723A2]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="e.g. 5th Avenue, High Street West"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Unit / House No. <span className="text-[#E723A2]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  placeholder="e.g. Suite 18B"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Postal Code
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-32 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono-num font-bold"
              />
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
              >
                <FaArrowLeft className="size-3" /> Back
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2"
              >
                Proceed to KYC Verification <FaArrowRight className="size-3" />
              </button>
            </div>
          </form>
        )}

        {/* Step 3: KYC Verification & Explicit Notice */}
        {currentStep === 3 && (
          <form onSubmit={handleFinalSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Primary Government ID Type <span className="text-[#E723A2]">*</span>
              </label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
              >
                <option value="Philippine Passport">Philippine Passport</option>
                <option value="Driver's License">Driver's License (LTO)</option>
                <option value="UMID">Unified Multi-Purpose ID (UMID)</option>
                <option value="Philippine National ID (PhilID)">Philippine National ID (PhilID)</option>
                <option value="PRC ID">Professional Regulation Commission (PRC) ID</option>
              </select>
            </div>

            {/* Simulated File Uploads */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-4 text-center bg-[#F8FAFC] hover:border-[#E723A2] transition group">
                <div className="mx-auto size-10 rounded-xl bg-white border border-slate-200 grid place-items-center text-slate-500 group-hover:text-[#E723A2] mb-2">
                  <FaFileImage />
                </div>
                <p className="text-xs font-bold text-slate-800">Upload Government ID</p>
                <p className="text-[11px] text-slate-400 mt-0.5">PDF, PNG or JPG up to 10MB</p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-mono-num text-slate-600">
                  <FaCheck className="text-emerald-500 size-2.5" /> {govIdFileName}
                </div>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-4 text-center bg-[#F8FAFC] hover:border-[#E723A2] transition group">
                <div className="mx-auto size-10 rounded-xl bg-white border border-slate-200 grid place-items-center text-slate-500 group-hover:text-[#E723A2] mb-2">
                  <FaFilePdf />
                </div>
                <p className="text-xs font-bold text-slate-800">Business Permit / DTI / SEC</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Official registration document</p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-mono-num text-slate-600">
                  <FaCheck className="text-emerald-500 size-2.5" /> {permitFileName}
                </div>
              </div>
            </div>

            {/* Mandatory Legal Notice Callout */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
              <div className="flex items-start gap-3">
                <FaCircleInfo className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold uppercase tracking-wider text-amber-800">
                    Mandatory Administrative Clearance Notice
                  </p>
                  <p className="leading-relaxed font-medium">
                    &ldquo;After submitting your registration, please wait for the administrator&rsquo;s approval, which will be sent to your email.&rdquo;
                  </p>
                  <p className="text-[11px] text-amber-700">
                    Aisley maintains strict curation to safeguard authenticity and consumer trust across our atelier network.
                  </p>
                </div>
              </div>
            </div>

            {/* Terms Agreement Checkbox */}
            <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-0.5 size-4 rounded text-[#E723A2] focus:ring-[#E723A2] border-slate-300"
              />
              <span className="text-xs text-slate-600">
                I hereby certify that all submitted identification and corporate credentials are authentic and comply with Philippine trade regulations and Aisley Atelier Merchant Standards.
              </span>
            </label>

            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
              >
                <FaArrowLeft className="size-3" /> Back
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !termsAgreed}
                className="px-6 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Submit Atelier Application <FaCheck className="size-3" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
