// @ts-nocheck - Temporary fix for Radix UI + React 19 type incompatibility
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usersApi } from '@/lib/api/users';
import { apiClient } from '@/lib/api-client';
import { showToast } from '@/lib/toast';
import { ArrowLeft, Info, UserPlus, Send, Copy, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import type { UserRole } from '@/types';

const userRoleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  TECHNICIEN: 'Technicien',
  VIEWER: 'Observateur',
};

// Schema for direct creation
const directSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  role: z.enum(['ADMIN', 'MANAGER', 'TECHNICIEN', 'VIEWER']),
  phone: z.string().optional(),
});

// Schema for invitation
const inviteSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  role: z.enum(['ADMIN', 'MANAGER', 'TECHNICIEN', 'VIEWER']),
});

type DirectFormData = z.infer<typeof directSchema>;
type InviteFormData = z.infer<typeof inviteSchema>;

export default function NewUserPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'direct' | 'invite'>('direct');
  const [inviteResult, setInviteResult] = useState<{ token?: string; link?: string } | null>(null);

  // Direct creation form
  const directForm = useForm<DirectFormData>({
    resolver: zodResolver(directSchema),
    defaultValues: { role: 'VIEWER' },
  });

  // Invite form
  const inviteForm = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'VIEWER' },
  });

  const createMutation = useMutation({
    mutationFn: (data: DirectFormData) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast.success('Utilisateur créé avec succès');
      router.push('/dashboard/users');
    },
    onError: (err: any) => {
      showToast.error(err.message || 'Erreur lors de la création');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteFormData) =>
      apiClient.post<{ user: any; inviteToken?: string }>('/api/auth/invite', data),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast.success('Invitation envoyée !');
      // If SMTP failed, the token may be returned for manual sharing
      if (result.inviteToken) {
        const link = `${window.location.origin}/invite?token=${result.inviteToken}`;
        setInviteResult({ token: result.inviteToken, link });
      } else {
        router.push('/dashboard/users');
      }
    },
    onError: (err: any) => {
      showToast.error(err.message || 'Erreur lors de l\'invitation');
    },
  });

  const onDirectSubmit = (data: DirectFormData) => createMutation.mutate(data);
  const onInviteSubmit = (data: InviteFormData) => inviteMutation.mutate(data);

  const copyLink = () => {
    if (inviteResult?.link) {
      navigator.clipboard.writeText(inviteResult.link);
      showToast.success('Lien copié !');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/users"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-3xl font-bold">Nouvel utilisateur</h1>
      </div>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as any); setInviteResult(null); }}>
        <TabsList>
          <TabsTrigger value="direct" className="gap-2">
            <UserPlus className="h-4 w-4" /> Création directe
          </TabsTrigger>
          <TabsTrigger value="invite" className="gap-2">
            <Send className="h-4 w-4" /> Invitation par email
          </TabsTrigger>
        </TabsList>

        {/* ─── Direct Creation ─── */}
        <TabsContent value="direct" className="mt-6">
          <form onSubmit={directForm.handleSubmit(onDirectSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-5 w-5" /> Création directe
                </CardTitle>
                <CardDescription>
                  Créer un compte avec un mot de passe défini manuellement. Pas besoin d&apos;email fonctionnel.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="d-name">Nom complet <span className="text-red-500">*</span></Label>
                    <Input id="d-name" {...directForm.register('name')} placeholder="Jean Dupont" />
                    {directForm.formState.errors.name && <p className="text-sm text-red-600">{directForm.formState.errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d-email">Email <span className="text-red-500">*</span></Label>
                    <Input id="d-email" type="email" {...directForm.register('email')} placeholder="jean.dupont@example.com" />
                    {directForm.formState.errors.email && <p className="text-sm text-red-600">{directForm.formState.errors.email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d-password">Mot de passe <span className="text-red-500">*</span></Label>
                    <Input id="d-password" type="password" {...directForm.register('password')} placeholder="Minimum 8 caractères" />
                    {directForm.formState.errors.password && <p className="text-sm text-red-600">{directForm.formState.errors.password.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d-role">Rôle <span className="text-red-500">*</span></Label>
                    <Select value={directForm.watch('role')} onValueChange={(v) => directForm.setValue('role', v as UserRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(userRoleLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d-phone">Téléphone</Label>
                    <Input id="d-phone" type="tel" {...directForm.register('phone')} placeholder="+33 6 12 34 56 78" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Info className="h-4 w-4" /> Le compte sera actif immédiatement
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => router.push('/dashboard/users')}>Annuler</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Création...' : 'Créer l\'utilisateur'}
                </Button>
              </div>
            </div>
          </form>
        </TabsContent>

        {/* ─── Invitation ─── */}
        <TabsContent value="invite" className="mt-6">
          {inviteResult ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" /> Invitation créée
                </CardTitle>
                <CardDescription>
                  L&apos;email d&apos;invitation n&apos;a pas pu être envoyé (SMTP non configuré). Partagez le lien ci-dessous manuellement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Lien d&apos;invitation</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={inviteResult.link} readOnly className="font-mono text-sm" />
                    <Button variant="outline" onClick={copyLink}>
                      <Copy className="h-4 w-4 mr-2" /> Copier
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Ce lien est valable 72 heures.</p>
                </div>
                <Button onClick={() => router.push('/dashboard/users')}>Retour aux utilisateurs</Button>
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Send className="h-5 w-5" /> Invitation par email
                  </CardTitle>
                  <CardDescription>
                    Un email sera envoyé avec un lien pour définir le mot de passe. Si le SMTP n&apos;est pas configuré, le lien sera affiché ici.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="i-name">Nom complet <span className="text-red-500">*</span></Label>
                      <Input id="i-name" {...inviteForm.register('name')} placeholder="Jean Dupont" />
                      {inviteForm.formState.errors.name && <p className="text-sm text-red-600">{inviteForm.formState.errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="i-email">Email <span className="text-red-500">*</span></Label>
                      <Input id="i-email" type="email" {...inviteForm.register('email')} placeholder="jean.dupont@example.com" />
                      {inviteForm.formState.errors.email && <p className="text-sm text-red-600">{inviteForm.formState.errors.email.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="i-role">Rôle <span className="text-red-500">*</span></Label>
                      <Select value={inviteForm.watch('role')} onValueChange={(v) => inviteForm.setValue('role', v as UserRole)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(userRoleLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Info className="h-4 w-4" /> Le compte sera inactif jusqu&apos;à acceptation
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push('/dashboard/users')}>Annuler</Button>
                  <Button type="submit" disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending ? 'Envoi...' : 'Envoyer l\'invitation'}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
