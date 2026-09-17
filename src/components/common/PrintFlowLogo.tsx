import React from 'react';

interface PrintFlowLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'horizontal' | 'mark';
  showSubtitle?: boolean;
  className?: string;
  useImage?: boolean;
}

export const PrintFlowIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-9 h-9',
  size,
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <img
        src="/logo.png"
        alt="PrintFlow Logo"
        className="w-full h-full object-contain drop-shadow-xs"
        onError={(e) => {
          // Graceful fallback to SVG if image fails
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
    </div>
  );
};

export const PrintFlowLogo: React.FC<PrintFlowLogoProps> = ({
  size = 'md',
  variant = 'horizontal',
  showSubtitle = false,
  className = '',
  useImage = true,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl sm:text-3xl',
    xl: 'text-3xl sm:text-4xl',
  };

  const subtitleSizes = {
    sm: 'text-[9px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-sm',
  };

  if (variant === 'mark') {
    return <PrintFlowIcon className={`${iconSizes[size]} ${className}`} />;
  }

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <div className="relative mb-2">
          {useImage ? (
            <img
              src="/logo.png"
              alt="PrintFlow Logo"
              className={`${iconSizes[size]} object-contain drop-shadow-sm`}
            />
          ) : (
            <PrintFlowIcon className={iconSizes[size]} />
          )}
        </div>
        <div className={`font-extrabold tracking-tight text-slate-900 ${textSizes[size]} leading-none`}>
          Print<span className="text-blue-600">Flow</span>
        </div>
        {(showSubtitle || true) && (
          <div className={`flex items-center justify-center gap-1.5 font-semibold text-slate-500 tracking-wider mt-1.5 uppercase ${subtitleSizes[size]}`}>
            <span>Scan</span>
            <span className="w-1 h-1 rounded-full bg-blue-500 inline-block" />
            <span>Upload</span>
            <span className="w-1 h-1 rounded-full bg-blue-500 inline-block" />
            <span>Print</span>
          </div>
        )}
      </div>
    );
  }

  // Default: 'horizontal'
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative shrink-0">
        <img
          src="/logo.png"
          alt="PrintFlow Mark"
          className={`${iconSizes[size]} object-contain`}
        />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-extrabold tracking-tight text-slate-900 ${textSizes[size]}`}>
            Print<span className="text-blue-600">Flow</span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            SaaS
          </span>
        </div>
        {showSubtitle && (
          <p className={`font-medium text-slate-500 mt-0.5 tracking-normal ${subtitleSizes[size]}`}>
            Scan • Upload • Print
          </p>
        )}
      </div>
    </div>
  );
};
