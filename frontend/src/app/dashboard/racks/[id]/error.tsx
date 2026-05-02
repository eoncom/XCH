'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Rack Detail Error]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[600px] p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <CardTitle>Erreur de chargement de la baie</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Une erreur s&apos;est produite lors du chargement des détails de la baie.
            </p>
            {error.message && (
              <p className="text-sm font-mono bg-muted p-3 rounded-md">
                {error.message}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              Réessayer
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/racks">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux baies
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                Tableau de bord
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
