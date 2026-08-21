import React, { useId } from 'react';

interface LeoLogoMarkProps {
  className?: string;
  size?: number | string;
  title?: string;
}

/**
 * Official Leo AI Brand Logo Mark (SVG)
 * Source of truth: Vector rounded app mark with neural-core L, AI spark, and glass highlight
 */
export const LeoLogoMark: React.FC<LeoLogoMarkProps> = ({
  className = 'w-8 h-8',
  size,
  title = 'Leo AI Logo',
}) => {
  const rawId = useId();
  const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const gradId = `leo-g-${cleanId}`;
  const shineId = `leo-shine-${cleanId}`;

  const styleProps = size !== undefined ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      style={styleProps}
      className={`shrink-0 select-none ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="12" y1="10" x2="88" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6D20D8" />
          <stop offset="52%" stopColor="#9B4DFF" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>
        <linearGradient id={shineId} x1="30" y1="18" x2="76" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Rounded-square app mark */}
      <rect x="5" y="5" width="90" height="90" rx="27" fill={`url(#${gradId})`} />

      {/* Minimal abstract L / neural-core symbol */}
      <path
        d="M31 27v35c0 9 5 14 14 14h19"
        fill="none"
        stroke="#ffffff"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* AI spark */}
      <path
        d="M68 25l2.8 7.8L79 36l-8.2 3.2L68 47l-3-7.8L57 36l8-3.2L68 25z"
        fill="#ffffff"
      />
      <circle cx="78" cy="53" r="3.2" fill="#ffffff" opacity="0.92" />

      {/* Subtle glass highlight */}
      <path
        d="M25 19c10-10 27-13 39-8"
        fill="none"
        stroke={`url(#${shineId})`}
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
};

interface LeoLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  taglineClassName?: string;
  onClick?: () => void;
}

/**
 * Official Full Leo AI Brand Component (Mark + Typography + Optional Tagline)
 */
export const LeoLogo: React.FC<LeoLogoProps> = ({
  size = 'md',
  showTagline = false,
  className = '',
  iconClassName = '',
  textClassName = '',
  taglineClassName = '',
  onClick,
}) => {
  const sizeMap = {
    xs: {
      mark: 'w-5 h-5',
      text: 'text-sm font-bold tracking-tight',
      gap: 'gap-1.5',
      tag: 'text-[8px] tracking-[1.5px]',
    },
    sm: {
      mark: 'w-6 h-6',
      text: 'text-base font-bold tracking-tight',
      gap: 'gap-2',
      tag: 'text-[9px] tracking-[2px]',
    },
    md: {
      mark: 'w-8 h-8',
      text: 'text-lg font-bold tracking-tight',
      gap: 'gap-2.5',
      tag: 'text-[10px] tracking-[2.5px]',
    },
    lg: {
      mark: 'w-12 h-12',
      text: 'text-2xl font-extrabold tracking-tight',
      gap: 'gap-3.5',
      tag: 'text-[11px] tracking-[3px]',
    },
    xl: {
      mark: 'w-16 h-16 sm:w-20 sm:h-20',
      text: 'text-3xl sm:text-4xl font-extrabold tracking-tight',
      gap: 'gap-4',
      tag: 'text-xs sm:text-sm tracking-[3px]',
    },
  };

  const currentSize = sizeMap[size];

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${currentSize.gap} select-none ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      role={onClick ? 'button' : 'banner'}
      aria-label="Leo AI"
    >
      <LeoLogoMark
        className={`${currentSize.mark} drop-shadow-[0_8px_16px_rgba(126,70,235,0.22)] ${iconClassName}`}
      />
      <div className="flex flex-col justify-center">
        <span
          className={`font-display bg-gradient-to-r from-[#6d20d8] via-[#a855f7] to-[#c084fc] bg-clip-text text-transparent leading-none ${currentSize.text} ${textClassName}`}
        >
          Leo AI
        </span>
        {showTagline && (
          <span
            className={`font-bold uppercase text-[#8b8792] mt-1 leading-none ${currentSize.tag} ${taglineClassName}`}
          >
            Intelligent • Simple • Powerful
          </span>
        )}
      </div>
    </div>
  );
};
