'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Silently ignore — always show success
    } finally {
      setIsLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold text-primary">XCH</CardTitle>
          <CardDescription>Mot de passe oublié</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <Mail className="h-12 w-12 text-primary" />
              <p className="text-sm text-muted-foreground">
                Si un compte existe avec l&apos;adresse <strong>{email}</strong>, un email de réinitialisation a été envoyé.
                Vérifiez votre boîte de réception.
              </p>
              <Button onClick={() => router.push('/login')} variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à la connexion
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Entrez votre adresse email. Si un compte existe, vous recevrez un lien de réinitialisation.
              </p>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11"
                />
              </div>

              <Button type="submit" className="w-full h-11 text-base font-medium" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  'Envoyer le lien de réinitialisation'
                )}
              </Button>

              <div className="text-center">
                <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" />
                  Retour à la connexion
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
