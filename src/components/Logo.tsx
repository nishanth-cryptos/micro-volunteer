// Reusable Hey Padosi Logo Component.
// Centralizes official brand asset rendering throughout the application.

import logoAsset from '../assets/hey-padosi-logo.png';

export interface LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function Logo({ className = '', size = 'md' }: LogoProps) {
  const sizeClasses = {
    xs: 'h-6 sm:h-7',
    sm: 'h-8 sm:h-9',
    md: 'h-9 sm:h-11',
    lg: 'h-12 sm:h-14 md:h-16',
    xl: 'h-16 sm:h-20 md:h-24',
  }[size];

  return (
    <img
      src={logoAsset}
      alt="Hey Padosi"
      className={`w-auto shrink-0 max-w-full object-contain select-none transition-transform ${sizeClasses} ${className}`}
      loading="eager"
    />
  );
}
