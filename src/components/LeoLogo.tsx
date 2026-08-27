import React, { useId } from 'react';

interface LeoLogoMarkProps {
  className?: string;
  size?: number | string;
  title?: string;
}

/**
 * Official Leo AI Brand Logo Mark (SVG)
 * Minimalist geometric AI mark with deep dark surfaces and sleek accent glow
 */
export const LeoLogoMark: React.FC<LeoLogoMarkProps> = ({
  className = 'w-8 h-8',
  size,
  title = 'Leo AI Logo',
}) => {
  const rawId = useId();
  const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const gradId = `leo-g-${cleanId}`;
  const glowId = `leo-glow-${cleanId}`;

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
        <linearGradient id={gradId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <radialGradient id={glowId} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient background glow */}
      <circle cx="50" cy="50" r="48" fill={`url(#${glowId})`} />

      {/* Outer Rounded Container */}
      <rect
        x="8"
        y="8"
        width="84"
        height="84"
        rx="22"
        fill="#141416"
        stroke="#27272a"
        strokeWidth="2.5"
      />

      {/* Geometric L & Sparkle Iconography */}
      <path
        d="M32 26V68C32 70.2 33.8 72 36 72H68"
        fill="none"
        stroke="url(#${gradId})"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Floating Intelligence Sparkle */}
      <path
        d="M58 34L61 24L64 34L74 37L64 40L61 50L58 40L48 37Z"
        fill="#ffffff"
        opacity="0.95"
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
      text: 'text-sm font-semibold tracking-tight',
      gap: 'gap-2',
      tag: 'text-[8px] tracking-[1.5px]',
    },
    sm: {
      mark: 'w-6 h-6',
      text: 'text-base font-semibold tracking-tight',
      gap: 'gap-2.5',
      tag: 'text-[9px] tracking-[2px]',
    },
    md: {
      mark: 'w-8 h-8',
      text: 'text-lg font-bold tracking-tight',
      gap: 'gap-3',
      tag: 'text-[10px] tracking-[2.5px]',
    },
    lg: {
      mark: 'w-11 h-11',
      text: 'text-2xl font-bold tracking-tight',
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
        className={`${currentSize.mark} drop-shadow-[0_0_12px_rgba(168,85,247,0.25)] ${iconClassName}`}
      />
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-sans font-bold text-white tracking-tight ${currentSize.text} ${textClassName}`}
          >
            Leo <span className="text-purple-400 font-medium">AI</span>
          </span>
        </div>
        {showTagline && (
          <span
            className={`font-sans font-medium uppercase text-neutral-400 mt-0.5 leading-none ${currentSize.tag} ${taglineClassName}`}
          >
            Intelligence & Coding Assistant
          </span>
        )}
      </div>
    </div>
  );
};

