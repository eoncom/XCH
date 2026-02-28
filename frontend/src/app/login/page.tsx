'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/api/auth';
import { showToast } from '@/lib/toast';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Loader2, Key, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, isAuthenticated, checkSession } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoChecked, setSsoChecked] = useState(false);

  // 2FA state
  const [step, setStep] = useState<'credentials' | 'totp' | 'backup'>('credentials');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [is2FALoading, setIs2FALoading] = useState(false);
  const totpInputRef = useRef<HTMLInputElement>(null);

  // Check setup status, SSO config, and auto-redirect
  useEffect(() => {
    const verifySession = async () => {
      // Check if setup is needed
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/setup/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.needsSetup) {
            router.replace('/setup');
            return;
          }
        }
      } catch {
        // Setup endpoint not available — skip check
      }

      // Check if SSO is enabled
      try {
        const ssoRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/sso-config`);
        if (ssoRes.ok) {
          const ssoData = await ssoRes.json();
          setSsoEnabled(ssoData.ssoEnabled === true);
        }
      } catch {
        // SSO config not available — keep hidden
      }
      setSsoChecked(true);

      await checkSession();
      if (isAuthenticated) {
        router.push('/dashboard');
      }
    };
    verifySession();
  }, [isAuthenticated, checkSession, router]);

  // Auto-focus TOTP input when step changes
  useEffect(() => {
    if (step === 'totp') {
      setTimeout(() => totpInputRef.current?.focus(), 100);
    }
  }, [step]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login({ email, password });
      showToast.success('Connexion réussie !');
      window.location.href = '/dashboard';
    } catch (err: any) {
      if (err.requires2FA && err.tempToken) {
        setTempToken(err.tempToken);
        setStep('totp');
        setError('');
        return;
      }
      const errorMessage = err.message || 'Identifiants invalides';
      setError(errorMessage);
      showToast.error(errorMessage);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken) return;
    setError('');
    setIs2FALoading(true);

    try {
      const data = await authApi.verify2FA(totpCode, tempToken);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      showToast.success('Connexion réussie !');
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Code TOTP invalide');
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleBackupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken) return;
    setError('');
    setIs2FALoading(true);

    try {
      const data = await authApi.verifyBackup(backupCode, tempToken);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      showToast.success('Connexion réussie !');
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Code de récupération invalide');
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleBack = () => {
    setStep('credentials');
    setTempToken(null);
    setTotpCode('');
    setBackupCode('');
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Theme toggle in corner */}
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold text-primary">XCH</CardTitle>
          <CardDescription className="text-muted-foreground">
            {step === 'credentials' && 'Gestion IT Sites'}
            {step === 'totp' && 'Vérification en deux étapes'}
            {step === 'backup' && 'Code de récupération'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Credentials */}
          {step === 'credentials' && (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
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

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Mot de passe
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium press-effect"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </Button>
              </form>

              {ssoEnabled && ssoChecked && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Ou</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full h-11"
                    onClick={() => (window.location.href = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/oidc`)}
                  >
                    <Key className="mr-2 h-4 w-4" />
                    Se connecter avec SSO
                  </Button>
                </>
              )}
            </>
          )}

          {/* Step 2: TOTP Code */}
          {step === 'totp' && (
            <form onSubmit={handleTotpSubmit} className="space-y-4">
              <div className="flex items-center justify-center mb-2">
                <ShieldCheck className="h-12 w-12 text-primary" />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Entrez le code à 6 chiffres depuis votre application d'authentification.
              </p>

              <div className="space-y-2">
                <Input
                  ref={totpInputRef}
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  disabled={is2FALoading}
                  className="h-14 text-center text-2xl tracking-[0.5em] font-mono"
                  autoComplete="one-time-code"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium"
                disabled={is2FALoading || totpCode.length !== 6}
              >
                {is2FALoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  'Vérifier'
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Retour
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('backup'); setError(''); }}
                  className="text-primary hover:underline"
                >
                  Code de récupération
                </button>
              </div>
            </form>
          )}

          {/* Step 2b: Backup Code */}
          {step === 'backup' && (
            <form onSubmit={handleBackupSubmit} className="space-y-4">
              <div className="flex items-center justify-center mb-2">
                <Key className="h-12 w-12 text-primary" />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Entrez un de vos codes de récupération.
              </p>

              <div className="space-y-2">
                <Input
                  id="backup-code"
                  type="text"
                  placeholder="XXXXXXXX"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                  required
                  disabled={is2FALoading}
                  className="h-14 text-center text-xl tracking-widest font-mono uppercase"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium"
                disabled={is2FALoading || !backupCode.trim()}
              >
                {is2FALoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  'Vérifier'
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Retour
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('totp'); setError(''); }}
                  className="text-primary hover:underline"
                >
                  Utiliser le code TOTP
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
