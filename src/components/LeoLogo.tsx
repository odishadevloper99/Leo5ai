import React, { useId } from 'react';

interface LeoLogoMarkProps {
  className?: string;
  size?: number | string;
  title?: string;
}

/**
 * Official Leo AI Brand Logo Mark (SVG)
 * Animated white "hacker face" mark — hooded silhouette with a scanning visor,
 * a subtle idle float, and an occasional glitch flicker.
 */
export const LeoLogoMark: React.FC<LeoLogoMarkProps> = ({
  className = 'w-7 h-7',
  size,
  title = 'Leo AI Logo',
}) => {
  const styleProps = size !== undefined ? { width: size, height: size } : undefined;
  const clipId = `leo-visor-clip-${useId()}`;

  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={title}
      style={styleProps}
      className={`leo-facelogo shrink-0 select-none ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <clipPath id={clipId}>
          <rect x="34" y="52" width="52" height="16" rx="6" />
        </clipPath>
      </defs>

      {/* hood */}
      <path
        className="leo-facelogo-hood"
        d="M22,60 C22,28 42,10 60,10 C78,10 98,28 98,60 L98,88 C98,88 84,74 60,74 C36,74 22,88 22,88 Z"
      />

      {/* head base line */}
      <path
        className="leo-facelogo-head"
        d="M30,70 C30,92 42,104 60,104 C78,104 90,92 90,70"
      />

      {/* visor / eyes bar with scanning glint */}
      <g clipPath={`url(#${clipId})`}>
        <rect className="leo-facelogo-visor" x="34" y="52" width="52" height="16" rx="6" />
        <rect className="leo-facelogo-scan" x="34" y="52" width="14" height="16" />
      </g>

      {/* simple mouth */}
      <path className="leo-facelogo-mouth" d="M50,86 L70,86" />
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
