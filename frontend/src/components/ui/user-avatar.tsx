'use client';

import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/get-initials';

type Size = 'sm' | 'md' | 'lg';

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-lg',
};

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: Size;
  className?: string;
}

export function UserAvatar({
  name,
  email,
  image,
  size = 'md',
  className,
}: UserAvatarProps) {
  const sizeCls = sizeClasses[size];
  const altText = name ?? email ?? 'Utilisateur';

  if (image) {
    return (
      <img
        src={image}
        alt={altText}
        className={cn('rounded-full object-cover shrink-0', sizeCls, className)}
      />
    );
  }

  const initials = getInitials(name ?? email ?? '');

  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold shrink-0',
        sizeCls,
        className,
      )}
      aria-label={altText}
      role="img"
    >
      {initials}
    </div>
  );
}
