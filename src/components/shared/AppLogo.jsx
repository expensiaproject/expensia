import React from 'react';

// Official Expensia Logo Component
// Uses Base44 generated brand logo consistently across the app

export function AppLogo({ size = 'md', showText = true, variant = 'default', className = '' }) {
  const sizes = {
    xs: { icon: 'w-6 h-6', text: 'text-sm', gap: 'gap-1.5' },
    sm: { icon: 'w-8 h-8', text: 'text-lg', gap: 'gap-2' },
    md: { icon: 'w-10 h-10', text: 'text-xl', gap: 'gap-3' },
    lg: { icon: 'w-14 h-14', text: 'text-2xl', gap: 'gap-3' },
    xl: { icon: 'w-20 h-20', text: 'text-3xl', gap: 'gap-4' },
  };

  const sizeConfig = sizes[size] || sizes.md;

  // Hero variant with white circular background for login/welcome screens
  if (variant === 'hero') {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center mb-4">
          <LogoIcon className="w-14 h-14" />
        </div>
        {showText && (
          <span className="font-bold text-3xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Expensia
          </span>
        )}
      </div>
    );
  }

  // Default variant for headers/sidebars
  return (
    <div className={`flex items-center ${sizeConfig.gap} ${className}`}>
      <LogoIcon className={sizeConfig.icon} />
      {showText && (
        <span className={`font-bold ${sizeConfig.text} bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent`}>
          Expensia
        </span>
      )}
    </div>
  );
}

// The actual logo icon - Base44 style gradient icon
export function LogoIcon({ className = 'w-10 h-10' }) {
  return (
    <div className={`${className} bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200/50`}>
      <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        className="w-[55%] h-[55%] text-white"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    </div>
  );
}

// For PDF exports - returns SVG as string
export function getLogoSVGForExport() {
  return `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4F46E5"/>
          <stop offset="100%" style="stop-color:#9333EA"/>
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#logoGradient)"/>
      <g transform="translate(8, 8)" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <line x1="9" y1="15" x2="15" y2="15"/>
      </g>
    </svg>
  `;
}

export default AppLogo;