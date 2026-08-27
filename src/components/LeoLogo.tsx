import React from 'react';

interface LeoLogoMarkProps {
  className?: string;
  size?: number | string;
  title?: string;
}

/**
 * Official Leo AI Brand Logo Mark (SVG)
 * Crisp white geometric origami / polyhedral icon matching reference design
 */
export const LeoLogoMark: React.FC<LeoLogoMarkProps> = ({
  className = 'w-7 h-7',
  size,
  title = 'Leo AI Logo',
}) => {
  const styleProps = size !== undefined ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      style={styleProps}
      className={`shrink-0 select-none ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {/* Sleek interwoven geometric origami form */}
      <path
        d="M50 12L78 28V60L50 76L22 60V28L50 12Z"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path
        d="M50 12V44L78 60M50 44L22 60M50 44L50 76"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36 20L64 36M64 36V68M36 52L64 68"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="50" cy="44" r="4" fill="#ffffff" />
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
 * Official Full Leo AI Brand Component (Mark + Typography)
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
      gap: 'gap-2',
      tag: 'text-[8px] tracking-[1.5px]',
    },
    sm: {
      mark: 'w-6 h-6',
      text: 'text-base font-bold tracking-tight',
      gap: 'gap-2',
      tag: 'text-[9px] tracking-[2px]',
    },
    md: {
      mark: 'w-7 h-7',
      text: 'text-lg font-bold tracking-tight',
      gap: 'gap-2.5',
      tag: 'text-[10px] tracking-[2.5px]',
    },
    lg: {
      mark: 'w-9 h-9',
      text: 'text-xl font-bold tracking-tight',
      gap: 'gap-3',
      tag: 'text-[11px] tracking-[3px]',
    },
    xl: {
      mark: 'w-12 h-12',
      text: 'text-2xl sm:text-3xl font-extrabold tracking-tight',
      gap: 'gap-3.5',
      tag: 'text-xs tracking-[3px]',
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
      <LeoLogoMark className={`${currentSize.mark} ${iconClassName}`} />
      <div className="flex flex-col justify-center">
        <span
          className={`font-sans font-bold text-white tracking-tight ${currentSize.text} ${textClassName}`}
        >
          LeoAI
        </span>
        {showTagline && (
          <span
            className={`font-sans font-medium uppercase text-zinc-400 mt-0.5 leading-none ${currentSize.tag} ${taglineClassName}`}
          >
            AI Intelligence & Security Core
          </span>
        )}
      </div>
    </div>
  );
};
