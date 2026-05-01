'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mapApiErrorToFr } from '@/lib/error-messages';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  variant?: 'inline' | 'page';
  className?: string;
}

export function ErrorState({
  title = 'Une erreur est survenue',
  description,
  error,
  onRetry,
  variant = 'inline',
  className,
}: ErrorStateProps) {
  const detail = description ?? (error !== undefined ? mapApiErrorToFr(error) : undefined);

  return (
    <div
      role="alert"
      className={cn(
        'text-center flex flex-col items-center',
        variant === 'page' ? 'min-h-[60vh] justify-center py-12' : 'py-12',
        className,
      )}
    >
      <AlertTriangle
        className="h-12 w-12 mx-auto text-destructive/70 mb-4"
        aria-hidden
      />
      <p className="text-foreground font-medium">{title}</p>
      {detail && <p className="text-sm text-muted-foreground mt-1 max-w-md">{detail}</p>}
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Réessayer
        </Button>
      )}
    </div>
  );
}
