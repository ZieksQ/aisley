import React from 'react';

interface AisleyLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
}

export const AisleyLogo: React.FC<AisleyLogoProps> = ({
  size = 'md',
  showWordmark = true,
  theme = 'dark',
  className = '',
}) => {
  const dimensions = {
    sm: { w: 32, h: 36, textClass: 'text-sm' },
    md: { w: 42, h: 48, textClass: 'text-lg' },
    lg: { w: 56, h: 64, textClass: 'text-2xl' },
    xl: { w: 80, h: 92, textClass: 'text-3xl' },
  }[size];

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* SVG Icon of Aisley Boutique Bag */}
      <svg
        width={dimensions.w}
        height={dimensions.h}
        viewBox="0 0 100 115"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Arched Top Handle */}
        <path
          d="M32 30V18C32 8.05888 40.0589 0 50 0C59.9411 0 68 8.05888 68 18V30"
          stroke="#E723A2"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Dimensional Slate Depth Tab */}
        <polygon points="12,32 18,24 82,24 88,32" fill="#64748B" />

        {/* Main Boutique Shopping Bag Body */}
        <rect x="10" y="30" width="80" height="80" rx="14" fill="#E723A2" />

        {/* 3-Box Central Atelier Window Display */}
        {/* Left Large Showcase Box */}
        <rect x="18" y="38" width="30" height="50" rx="6" fill="#0B0F19" />
        {/* Silhouette of Gown / Dress inside left box */}
        <path
          d="M29 44H37L39 52L41 78H25L27 52L29 44Z"
          fill="#FFFFFF"
          opacity="0.9"
        />
        <path d="M31 44L33 49L35 44" stroke="#0B0F19" strokeWidth="1" />

        {/* Top-Right Small Box (Perfume Flacon) */}
        <rect x="52" y="38" width="30" height="23" rx="6" fill="#0B0F19" />
        <rect x="63" y="42" width="8" height="4" rx="1" fill="#E723A2" />
        <rect x="60" y="46" width="14" height="11" rx="2" fill="#FFFFFF" opacity="0.9" />

        {/* Bottom-Right Small Box (Handbag / Jewel) */}
        <rect x="52" y="65" width="30" height="23" rx="6" fill="#0B0F19" />
        <path
          d="M62 72C62 69.5 64 68 67 68C70 68 72 69.5 72 72"
          stroke="#E723A2"
          strokeWidth="2"
        />
        <rect x="59" y="72" width="16" height="11" rx="3" fill="#FFFFFF" opacity="0.9" />

        {/* AISLEY Bold Wordmark across the base */}
        <text
          x="50"
          y="102"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="11"
          fontWeight="900"
          letterSpacing="2.5"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          AISLEY
        </text>
      </svg>

      {showWordmark && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-wider uppercase font-sans ${
                theme === 'dark' ? 'text-white' : 'text-slate-950'
              } ${dimensions.textClass}`}
            >
              AISLEY
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-widest uppercase bg-[#E723A2] text-white rounded-md">
              ATELIER
            </span>
          </div>
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[#64748B]">
            Seller Console
          </span>
        </div>
      )}
    </div>
  );
};
