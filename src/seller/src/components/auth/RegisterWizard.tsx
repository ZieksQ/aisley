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
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

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
        {/* Horizontal 2-Step Tab Header */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-white">
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
              className={`size-5 rounded-full text-[11px] font-mono-num font-black flex items-center justify-center ${
                currentStep === 1
                  ? 'bg-[#E723A2] text-white'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              {currentStep > 1 ? <FaCheck className="size-2.5" /> : '1'}
            </span>
            <span>Personal Information</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (firstName && lastName && email && age >= 18) {
                setCurrentStep(2);
              }
            }}
            className={`py-3.5 px-3 flex items-center justify-center gap-2 text-xs font-bold transition border-b-2 ${
              currentStep === 2
                ? 'border-[#E723A2] text-slate-900 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span
              className={`size-5 rounded-full text-[11px] font-mono-num font-black flex items-center justify-center ${
                currentStep === 2
                  ? 'bg-[#E723A2] text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              2
            </span>
            <span>Boutique & Address Details</span>
          </button>
        </div>

        {/* Wizard Form Content */}
        <div className="p-6 sm:p-8">
          {/* STEP 1: Personal Details */}
          {currentStep === 1 && (
            <form onSubmit={handleNextStep} className="space-y-4 text-xs">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Merchant Representative Details
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your legal representative profile. You must be at least 18 years old.
                </p>
              </div>

              {/* Row 1: Names */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    First Name <span className="text-[#E723A2]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Camille"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Last Name <span className="text-[#E723A2]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Valdez"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    M.I.
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={middleInitial}
                    onChange={(e) => setMiddleInitial(e.target.value.toUpperCase())}
                    placeholder="R"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium text-center focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 2: Sex & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Sex / Gender <span className="text-[#E723A2]">*</span>
                  </label>
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value as Sex)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div className="sm:col-span-8">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Email Address <span className="text-[#E723A2]">*</span>
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
                      placeholder="merchant@boutique.ph"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Contact, Birthday & Age */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                <div className="sm:col-span-5">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Contact No. <span className="text-[#E723A2]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <FaPhone className="size-3.5" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={contactNo}
                      onChange={(e) => setContactNo(e.target.value)}
                      placeholder="+63 917 123 4567"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium font-mono-num focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Birthday <span className="text-[#E723A2]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Age (Calculated)
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold font-mono-num text-xs flex items-center justify-between">
                    <span>{age > 0 ? `${age} y/o` : '—'}</span>
                    {age >= 18 && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Eligible
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {ageError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs font-medium">
                  <FaTriangleExclamation className="size-3.5 text-rose-600 shrink-0" />
                  <span>{ageError}</span>
                </div>
              )}

              {/* Action */}
              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  Continue to Boutique Info <FaArrowRight className="size-3" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Boutique & Address Details + Agreement */}
          {currentStep === 2 && (
            <form onSubmit={handleFinalSubmit} className="space-y-4 text-xs">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Boutique Details & Business Location
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your public brand identity and physical store fulfillment address.
                </p>
              </div>

              {/* Store Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Boutique Store Name <span className="text-[#E723A2]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Maison Camille Silk Guild"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Primary Category <span className="text-[#E723A2]">*</span>
                  </label>
                  <select
                    value={isCustomCategory ? 'other' : businessCategory}
                    onChange={(e) => {
                      if (e.target.value === 'other') {
                        setIsCustomCategory(true);
                      } else {
                        setIsCustomCategory(false);
                        setBusinessCategory(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    <option value="Apparel & Haute Couture">Apparel & Haute Couture</option>
                    <option value="Silks & Handwoven Textiles">Silks & Handwoven Textiles</option>
                    <option value="Fine Jewelry & Metals">Fine Jewelry & Metals</option>
                    <option value="Artisanal Leather">Artisanal Leather</option>
                    <option value="Botanical Fragrances">Botanical Fragrances</option>
                    <option value="Handcrafted Ceramics">Handcrafted Ceramics</option>
                    <option value="other">Other / Custom Niche</option>
                  </select>
                </div>
              </div>

              {isCustomCategory && (
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Specify Custom Category
                  </label>
                  <input
                    type="text"
                    required
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="e.g. Hand-embroidered bridal veils"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>
              )}

              {/* Province, City, Barangay */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Province / Region <span className="text-[#E723A2]">*</span>
                  </label>
                  <select
                    value={selectedProvince}
                    onChange={(e) => setSelectedProvince(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    {PHILIPPINE_ADDRESS_DATA.map((p) => (
                      <option key={p.province} value={p.province}>
                        {p.province}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    City / Municipality <span className="text-[#E723A2]">*</span>
                  </label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    {currentCities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Barangay <span className="text-[#E723A2]">*</span>
                  </label>
                  <select
                    value={selectedBarangay}
                    onChange={(e) => setSelectedBarangay(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  >
                    {currentBarangays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Street, House No, Postal */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Street / Building <span className="text-[#E723A2]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="e.g. Jupiter St, Renaissance Tower 4F"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    House / Unit No.
                  </label>
                  <input
                    type="text"
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    placeholder="Suite 402"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="1200"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium font-mono-num focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                  />
                </div>
              </div>

              {/* Terms Agreement Checkbox */}
              <div className="pt-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                    className="size-4 mt-0.5 accent-[#E723A2] rounded cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    I agree to the <strong>Aisley Seller Terms & Merchant Code of Conduct</strong>. I certify that all products listed will adhere to authentic craftsmanship and quality standards.
                  </span>
                </label>
              </div>

              {/* Navigation Actions */}
              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition flex items-center gap-2 cursor-pointer"
                >
                  <FaArrowLeft className="size-3" /> Back
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !termsAgreed}
                  className="px-6 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    'Submitting Application...'
                  ) : (
                    <>
                      <FaCheck className="size-3" /> Submit Boutique Application
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Bottom Switch to Login footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center text-xs text-slate-500">
          Already registered as an Aisley seller?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-bold text-[#E723A2] hover:underline cursor-pointer"
          >
            Sign in to Console
          </button>
        </div>
      </div>
    </div>
  );
};
