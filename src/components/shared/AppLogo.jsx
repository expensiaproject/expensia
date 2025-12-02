import React from 'react';

// Official Expensia Logo Component
// Uses the official Expensia brand logo

const LOGO_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692525e8f1598b43ae001573/312e69aa4_image.png';

export function AppLogo({ size = 'md', showText = false, variant = 'default', className = '' }) {
  const sizes = {
    xs: { icon: 'h-8', text: 'text-sm' },
    sm: { icon: 'h-10', text: 'text-lg' },
    md: { icon: 'h-12', text: 'text-xl' },
    lg: { icon: 'h-16', text: 'text-2xl' },
    xl: { icon: 'h-24', text: 'text-3xl' },
  };

  const sizeConfig = sizes[size] || sizes.md;

  // Hero variant with white circular background for login/welcome screens
  if (variant === 'hero') {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <img 
          src={LOGO_URL} 
          alt="Expensia" 
          className="h-28 w-auto object-contain"
        />
      </div>
    );
  }

  // Default variant for headers/sidebars - logo includes text already
  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src={LOGO_URL} 
        alt="Expensia" 
        className={`${sizeConfig.icon} w-auto object-contain`}
      />
    </div>
  );
}

// The actual logo icon - for places that need just the icon portion
export function LogoIcon({ className = 'w-10 h-10' }) {
  return (
    <img 
      src={LOGO_URL} 
      alt="Expensia" 
      className={`${className} object-contain`}
    />
  );
}

// Logo URL for exports
export const EXPENSIA_LOGO_URL = LOGO_URL;

export default AppLogo;