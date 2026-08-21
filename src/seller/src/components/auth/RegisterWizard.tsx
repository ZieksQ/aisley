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
  FaEnvelope,
  FaPhone,
  FaStar,
  FaTruckFast,
  FaBuildingColumns,
  FaShieldHalved,
  FaBolt,
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
  const [contactNo, setContactNo] = useState('+63 917 ');
  const [birthday, setBirthday] = useState('');
  const [age, setAge] = useState<number>(0);
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
  const [govIdFileName, setGovIdFileName] = useState('government_id_scan.pdf');
  const [permitFileName, setPermitFileName] = useState('dti_sec_permit_2026.pdf');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-calculate age whenever birthday changes
  useEffect(() => {
    if (birthday) {
      const calculated = calculateAge(birthday);
      setAge(calculated);
      if (calculated > 0 && calculated < 18) {
        setAgeError('Aisley requires sellers to be at least 18 years old.');
      } else {
        setAgeError(null);
      }
    } else {
      setAge(0);
      setAgeError(null);
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

  // Quick 1-Click Auto-Fill Sample Data
  const handleAutoFill = () => {
    setFirstName('Camille');
    setLastName('Valdez');
    setMiddleInitial('R');
    setSex('Female');
    setEmail('camille.valdez@manilasilks.ph');
    setContactNo('+63 917 882 4910');
    setBirthday('1996-05-18');
    setAge(calculateAge('1996-05-18'));
    setAgeError(null);

    setBusinessName('Maison Camille Silk Guild');
    setBusinessCategory('Apparel & Haute Couture');
    setSelectedProvince('Metro Manila (NCR)');
    setSelectedCity('Makati City');
    setSelectedBarangay('Bel-Air');
    setStreet('Jupiter St, Renaissance Tower 4F');
    setHouseNumber('Suite 402');
    setPostalCode('1200');

    setIdType('Philippine Passport');
    setGovIdFileName('passport_camille_valdez.pdf');
    setPermitFileName('DTI_Certificate_MaisonCamille.pdf');
    setTermsAgreed(true);
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep === 1) {
      if (age < 18) {
        setAgeError('You must be at least 18 years old to register as a seller.');
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
      alert('Please agree to the Aisley Terms and Marketplace Guidelines.');
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
    <div className="w-full max-w-2xl mx-auto my-4 space-y-6">
      {/* Centered Top Onboarding Showcase */}
      <div className="text-center space-y-3">
        {/* Pink Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E723A2]/10 border border-[#E723A2]/40 text-[#E723A2] text-xs font-bold tracking-wider uppercase">
          <FaBolt className="size-3" /> Aisley Merchant Onboarding Portal
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Launch Your Boutique on Aisley
        </h1>

        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
          Join 1,200+ verified niche apparel, fragrance, fine jewelry, and handcrafted home sellers across the Philippines.
        </p>

        {/* Feature Highlights Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] font-semibold text-slate-300">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 border border-slate-700">
            <FaShieldHalved className="text-emerald-400 size-3" /> 24–48h Fast Verification
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 border border-slate-700">
            <FaTruckFast className="text-[#0284C7] size-3" /> Integrated Waybill Printing
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 border border-slate-700">
            <FaBuildingColumns className="text-emerald-400 size-3" /> Instant Bank & E-Wallet Payouts
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 border border-slate-700">
            <FaStar className="text-amber-400 size-3" /> 0% Listing Fee
          </span>
        </div>

        {/* Auto-fill Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleAutoFill}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold transition shadow-lg cursor-pointer"
          >
            <FaCheck className="size-3" /> Auto-fill Sample Approved Data
          </button>
        </div>
      </div>

      {/* Main High-Contrast White Registration Card */}
      <div className="rounded-3xl bg-white text-slate-900 shadow-2xl border border-slate-200 overflow-hidden">
        {/* Horizontal 3-Step Tab Header */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`py-3.5 px-3 flex items-center justify-center gap-2 text-xs font-bold transition border-b-2 ${
              currentStep === 1
                ? 'border-[#E723A2] text-slate-900 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span
              className={`size-5 rounded-full text-[11px] font-mono-num font-black grid place-items-center ${
                currentStep === 1
                  ? 'bg-[#E723A2] text-white'
                  : currentStep > 1
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {currentStep > 1 ? <FaCheck className="size-2.5" /> : '1'}
            </span>
            <span className="hidden sm:inline">Personal Info</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (firstName && lastName && age >= 18) setCurrentStep(2);
            }}
            className={`py-3.5 px-3 flex items-center justify-center gap-2 text-xs font-bold transition border-b-2 ${
              currentStep === 2
                ? 'border-[#E723A2] text-slate-900 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span
              className={`size-5 rounded-full text-[11px] font-mono-num font-black grid place-items-center ${
                currentStep === 2
                  ? 'bg-[#E723A2] text-white'
                  : currentStep > 2
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {currentStep > 2 ? <FaCheck className="size-2.5" /> : '2'}
            </span>
            <span className="hidden sm:inline">Business & Address</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (businessName && street) setCurrentStep(3);
            }}
            className={`py-3.5 px-3 flex items-center justify-center gap-2 text-xs font-bold transition border-b-2 ${
              currentStep === 3
                ? 'border-[#E723A2] text-slate-900 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span
              className={`size-5 rounded-full text-[11px] font-mono-num font-black grid place-items-center ${
                currentStep === 3
                  ? 'bg-[#E723A2] text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              3
            </span>
            <span className="hidden sm:inline">Documents & Submit</span>
          </button>
        </div>

        {/* Step 1: Personal Representative Details */}
        {currentStep === 1 && (
          <form onSubmit={handleNextStep} className="p-6 sm:p-8 space-y-5">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Personal Representative Details
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Provide legal name matching your government-issued ID.
              </p>
            </div>

            {/* Row 1: First Name, Last Name, M.I. */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  First Name <span className="text-[#E723A2]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Camille"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#E723A2] focus:border-transparent focus:outline-none"
                />
              </div>

              <div className="col-span-12 sm:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Last Name <span className="text-[#E723A2]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Valdez"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#E723A2] focus:border-transparent focus:outline-none"
                />
              </div>

              <div className="col-span-12 sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  M.I.
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={middleInitial}
                  onChange={(e) => setMiddleInitial(e.target.value.toUpperCase())}
                  placeholder="R"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 uppercase text-center focus:ring-2 focus:ring-[#E723A2] focus:border-transparent focus:outline-none"
                />
              </div>
            </div>

            {/* Row 2: Sex, Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sex <span className="text-[#E723A2]">*</span>
                </label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as Sex)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#E723A2] focus:border-transparent focus:outline-none"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mail Address <span className="text-[#E723A2]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <FaEnvelope className="size-3.5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seller@example.com"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#E723A2] focus:border-transparent focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Contact No, Birthday, Age (Autogen) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact No. <span className="text-[#E723A2]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <FaPhone className="size-3" />
                  </div>
                  <input
                    type="text"
                    required
                    value={contactNo}
                    onChange={(e) => setContactNo(e.target.value)}
                    placeholder="+63 917..."
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#E723A2] focus:border-transparent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Birthday <span className="text-[#E723A2]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#E723A2] focus:border-transparent focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Age (Autogen) <span className="text-[#E723A2]">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-[#E723A2] uppercase">
                    Auto
                  </span>
                </div>
                <input
                  type="text"
                  readOnly
                  value={age > 0 ? `${age} years old` : 'Select date'}
                  className={`w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs font-bold font-mono-num ${
                    age >= 18 ? 'text-slate-900' : 'text-slate-400'
                  }`}
                />
              </div>
            </div>

            {ageError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <FaTriangleExclamation className="shrink-0" />
                <span>{ageError}</span>
              </div>
            )}

            {/* Footer Navigation */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="font-bold text-[#E723A2] hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </p>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2 cursor-pointer"
              >
                Continue to Step 2 <FaArrowRight className="size-3" />
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Business & Address */}
        {currentStep === 2 && (
          <form onSubmit={handleNextStep} className="p-6 sm:p-8 space-y-5">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Business & Registered Address
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter registered brand information and Philippine pickup depot.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Business / Brand Name <span className="text-[#E723A2]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Manila Silk & Linen Guild"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#E723A2] focus:border-transparent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#E723A2] focus:border-transparent focus:outline-none"
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
                      placeholder="e.g. Bespoke Millinery"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(false)}
                      className="px-2 text-xs font-bold text-slate-400 hover:text-slate-700"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Cascading Address */}
            <div className="space-y-3 pt-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-900">
                Philippine Address (Cascading Selector)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Province <span className="text-[#E723A2]">*</span>
                  </label>
                  <select
                    value={selectedProvince}
                    onChange={(e) => setSelectedProvince(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    {PHILIPPINE_ADDRESS_DATA.map((p) => (
                      <option key={p.province} value={p.province}>
                        {p.province}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    City / Municipality <span className="text-[#E723A2]">*</span>
                  </label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    {currentCities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Barangay <span className="text-[#E723A2]">*</span>
                  </label>
                  <select
                    value={selectedBarangay}
                    onChange={(e) => setSelectedBarangay(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    {currentBarangays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Street & Landmark <span className="text-[#E723A2]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="e.g. 5th Avenue, High Street West"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    House / Unit No. <span className="text-[#E723A2]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    placeholder="e.g. Suite 18B"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-32 px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-mono-num font-bold"
                />
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
              >
                <FaArrowLeft className="size-3" /> Back
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2 cursor-pointer"
              >
                Continue to Step 3 <FaArrowRight className="size-3" />
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Documents & Submit */}
        {currentStep === 3 && (
          <form onSubmit={handleFinalSubmit} className="p-6 sm:p-8 space-y-5">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                KYC Documents & Verification
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload government ID and business credentials for administrative review.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Primary Government ID Type <span className="text-[#E723A2]">*</span>
              </label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
              >
                <option value="Philippine Passport">Philippine Passport</option>
                <option value="Driver's License">Driver's License (LTO)</option>
                <option value="UMID">Unified Multi-Purpose ID (UMID)</option>
                <option value="Philippine National ID (PhilID)">Philippine National ID (PhilID)</option>
                <option value="PRC ID">Professional Regulation Commission (PRC) ID</option>
              </select>
            </div>

            {/* Document Upload Boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-4 text-center bg-[#F8FAFC] hover:border-[#E723A2] transition">
                <div className="mx-auto size-10 rounded-xl bg-white border border-slate-300 grid place-items-center text-slate-600 mb-2">
                  <FaFileImage />
                </div>
                <p className="text-xs font-bold text-slate-800">Upload Government ID</p>
                <p className="text-[10px] text-slate-400 mt-0.5">PDF, PNG or JPG up to 10MB</p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-mono-num text-slate-600">
                  <FaCheck className="text-emerald-500 size-2.5" /> {govIdFileName}
                </div>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-4 text-center bg-[#F8FAFC] hover:border-[#E723A2] transition">
                <div className="mx-auto size-10 rounded-xl bg-white border border-slate-300 grid place-items-center text-slate-600 mb-2">
                  <FaFilePdf />
                </div>
                <p className="text-xs font-bold text-slate-800">Business Permit / DTI / SEC</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Official registration document</p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-mono-num text-slate-600">
                  <FaCheck className="text-emerald-500 size-2.5" /> {permitFileName}
                </div>
              </div>
            </div>

            {/* Mandatory Legal Notice Callout */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950">
              <div className="flex items-start gap-3">
                <FaCircleInfo className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold uppercase tracking-wider text-amber-800 text-[11px]">
                    Administrative Clearance Policy
                  </p>
                  <p className="leading-relaxed font-semibold text-slate-800">
                    &ldquo;After submitting your registration, please wait for the administrator&rsquo;s approval, which will be sent to your email.&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Aisley maintains verification standards to safeguard authentic Philippine craftsmanship and buyer trust.
                  </p>
                </div>
              </div>
            </div>

            {/* Terms Checkbox */}
            <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-0.5 size-4 rounded text-[#E723A2] focus:ring-[#E723A2] border-slate-300"
              />
              <span className="text-xs text-slate-600">
                I hereby certify that all submitted identification and corporate credentials are authentic and comply with Philippine trade regulations and Aisley Merchant Standards.
              </span>
            </label>

            {/* Footer Navigation */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
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
                    Submit Application <FaCheck className="size-3" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Centered Copyright */}
      <p className="text-center text-xs text-slate-500 font-medium">
        &copy; 2026 Aisley Niche E-Commerce ERP. All rights reserved.
      </p>
    </div>
  );
};
