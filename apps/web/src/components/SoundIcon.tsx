import React from 'react';

interface SoundIconProps {
  src?: string | null;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const SoundIcon: React.FC<SoundIconProps> = ({
  src,
  alt = 'Sonido',
  size = 'md',
  className = ''
}) => {
  const finalSrc = src || '/iconos/music.svg';
  const isSvg = finalSrc.endsWith('.svg');

  const sizeClasses = {
    sm: 'w-7 h-7 rounded-lg',
    md: 'w-9 h-9 rounded-xl',
    lg: 'w-12 h-12 rounded-2xl',
    xl: 'w-16 h-16 rounded-2xl'
  }[size];

  const imgSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
    xl: 'w-9 h-9'
  }[size];

  return (
    <div className={`relative shrink-0 flex items-center justify-center bg-darkbg/90 border border-darkborder shadow-md shadow-black/40 overflow-hidden transition-all duration-300 ${sizeClasses} ${className}`}>
      <img
        src={finalSrc}
        alt={alt}
        className={`${isSvg ? `${imgSizeClasses} object-contain filter drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]` : 'w-full h-full object-cover scale-105 transition-transform duration-300'} `}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/iconos/music.svg';
        }}
      />
    </div>
  );
};
