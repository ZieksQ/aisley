import React from 'react';
import { useSeller } from '../../context/SellerContext';
import {
  FaCircleCheck,
  FaClock,
  FaCircle,
  FaBolt,
  FaArrowRightFromBracket,
  FaBuilding,
} from 'react-icons/fa6';

export const ApprovalStatusView: React.FC = () => {
  const { seller, approvalMilestones, simulateAdminApproval, logout } = useSeller();

  if (!seller) return null;

  const isApproved = seller.status === 'approved';

  return (
    <div className="w-full max-w-3xl mx-auto my-6">
      <div className="rounded-3xl bg-white p-6 sm:p-8 text-slate-900 shadow-2xl border border-slate-200 relative">
        {/* Header Status Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3.5">
            <div
              className={`grid size-12 place-items-center rounded-2xl ${
                isApproved ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              {isApproved ? <FaCircleCheck className="size-6" /> : <FaClock className="size-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {isApproved ? 'Aisley Storefront Activated' : 'Application Under Compliance Review'}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                    isApproved
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                      : 'bg-amber-50 text-amber-700 border border-amber-300'
                  }`}
                >
                  {isApproved ? 'Approved' : 'In Review'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-mono-num">
                Application Ref: #{seller.id.toUpperCase()} • Submitted on{' '}
                {new Date(seller.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <FaArrowRightFromBracket /> Sign Out
          </button>
        </div>

        {/* Prototype Fast-Track Testing Toolbar */}
        <div className="my-6 p-4 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 border border-slate-700">
          <div className="flex items-center gap-2.5">
            <FaBolt className="text-amber-400 size-4 shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">Prototype Interactive Simulator</p>
              <p className="text-[11px] text-slate-400">
                Instantly simulate backend administrator review clearance without waiting.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isApproved ? (
              <button
                onClick={() => simulateAdminApproval(true)}
                className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <FaCircleCheck /> Simulate Admin Approval
              </button>
            ) : (
              <button
                onClick={() => simulateAdminApproval(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold uppercase tracking-wider transition border border-slate-600 cursor-pointer"
              >
                Reset to Pending Review
              </button>
            )}
          </div>
        </div>

        {/* 4-Step Review Milestone Tracker */}
        <div className="space-y-4 mb-8">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Compliance Inspection Milestones
          </h3>

          <div className="space-y-3">
            {approvalMilestones.map((milestone, idx) => {
              const isCompleted = milestone.status === 'completed' || isApproved;
              const isInProgress = milestone.status === 'in_progress' && !isApproved;

              return (
                <div
                  key={milestone.id}
                  className={`p-4 rounded-2xl border transition ${
                    isCompleted
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : isInProgress
                      ? 'bg-amber-50/50 border-amber-300'
                      : 'bg-slate-50 border-slate-300 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isCompleted ? (
                        <FaCircleCheck className="size-4 text-emerald-600" />
                      ) : isInProgress ? (
                        <FaClock className="size-4 text-amber-600 animate-pulse" />
                      ) : (
                        <FaCircle className="size-3 text-slate-400 mx-0.5 mt-0.5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-sm font-bold ${
                            isCompleted ? 'text-emerald-950' : isInProgress ? 'text-amber-950' : 'text-slate-700'
                          }`}
                        >
                          {idx + 1}. {milestone.title}
                        </p>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isInProgress
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isCompleted ? 'Passed' : isInProgress ? 'In Review' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{milestone.description}</p>
                      {milestone.timestamp && (
                        <p className="text-[10px] font-mono-num text-slate-400 mt-1.5">
                          {milestone.timestamp}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submitted Entity Details Review */}
        <div className="rounded-2xl bg-[#F8FAFC] border border-slate-300 p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <FaBuilding className="text-[#E723A2]" /> Submitted Brand Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Brand Name:</span>
              <p className="font-bold text-slate-900">{seller.businessName}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Category:</span>
              <p className="font-bold text-slate-900">{seller.businessCategory}</p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Representative:</span>
              <p className="font-bold text-slate-900">
                {seller.firstName} {seller.middleInitial ? `${seller.middleInitial}. ` : ''}
                {seller.lastName} ({seller.age} y/o)
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Contact:</span>
              <p className="font-bold text-slate-900 font-mono-num">{seller.contactNo}</p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500 font-medium">Location:</span>
              <p className="font-bold text-slate-900">
                {seller.address.houseNumber} {seller.address.street}, {seller.address.barangay},{' '}
                {seller.address.city}, {seller.address.province} {seller.address.postalCode}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
