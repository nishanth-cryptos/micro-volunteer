// Reusable Hey Padosi Logo Component.
// Centralizes official brand asset rendering throughout the application.

import logoAsset from '../assets/hey-padosi-logo.png';

export interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Logo({ className = '', size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-9 sm:h-10',
    md: 'h-11 sm:h-12',
    lg: 'h-14 sm:h-16',
    xl: 'h-20 sm:h-24',
  }[size];

  return (
    <img
      src={logoAsset}
      alt="Hey Padosi"
      className={`w-auto object-contain select-none transition-transform ${sizeClasses} ${className}`}
      loading="eager"
    />
  );
}
