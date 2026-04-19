// @ts-nocheck - Temporary fix for Radix UI + React 19 type incompatibility
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { userDelegationsApi } from '@/lib/api/site-access';
import { organizationApi, type Delegation } from '@/lib/api/organization';
import { showToast } from '@/lib/toast';
import { ArrowLeft, Info, UserPlus, Send, Copy, CheckCircle2, Shield, Network } from 'lucide-react';
import Link from 'next/link';
import type { DelegationRight } from '@/types';

// Schema for direct creation — no role field (User.role removed)
// The real right comes from the delegation assignment below.
const directSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
      'Doit contenir au moins 1 minuscule, 1 majuscule et 1 chiffre',
    ),
  phone: z.string().optional(),
});

// Schema for invitation — same, no right field in the user form
const inviteSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
});

type DirectFormData = z.infer<typeof directSchema>;
type InviteFormData = z.infer<typeof inviteSchema>;

const DELEGATION_RIGHT_LABELS: Record<string, string> = {
  MANAGE: 'Administrateur',
  WRITE: 'Éditeur',
  READ: 'Lecteur',
};

export default function NewUserPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'direct' | 'invite'>('direct');
  const [inviteResult, setInviteResult] = useState<{ token?: string; link?: string } | null>(null);

  // Delegation state (mandatory)
  const [selectedDelegationId, setSelectedDelegationId] = useState('');
  const [delegationRight, setDelegationRight] = useState<string>('READ');

  // Org data for delegation selector
  const { data: delegations } = useQuery({
    queryKey: ['delegations'],
    queryFn: () => organizationApi.getDelegations(),
  });

  const isDelegationValid = !!selectedDelegationId;

  // Direct creation form
  const directForm = useForm<DirectFormData>({
    resolver: zodResolver(directSchema),
  });

  // Invite form
  const inviteForm = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: DirectFormData) => {
      // 1. Create user
      const newUser = await usersApi.create(data);
      // 2. Assign mandatory delegation with the selected right
      await userDelegationsApi.create({
        userId: newUser.id,
        delegationId: selectedDelegationId,
        right: delegationRight as DelegationRight,
      });
      return newUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast.success('Utilisateur créé avec délégation assignée');
      router.push('/dashboard/users');
    },
    onError: (err: any) => {
      showToast.error(err.message || 'Erreur lors de la création');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      // 1. Create invited user
      const result = await apiClient.post<{ user: any; inviteToken?: string }>('/api/auth/invite', data);
      // 2. Assign mandatory delegation with the selected right
      if (result.user?.id) {
        await userDelegationsApi.create({
          userId: result.user.id,
          delegationId: selectedDelegationId,
          right: delegationRight as DelegationRight,
        });
      }
      return result;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast.success('Invitation envoyée avec délégation assignée !');
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
                    <Label htmlFor="d-phone">Téléphone</Label>
                    <Input id="d-phone" type="tel" {...directForm.register('phone')} placeholder="+33 6 12 34 56 78" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delegation Card (mandatory) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Délégation d&apos;accès
                  <span className="text-xs font-normal text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded">Obligatoire</span>
                </CardTitle>
                <CardDescription>
                  Sans délégation, l&apos;utilisateur n&apos;aura aucun accès. Assignez au minimum une délégation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Délégation <span className="text-red-500">*</span></Label>
                    <Select value={selectedDelegationId} onValueChange={setSelectedDelegationId}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner une délégation..." /></SelectTrigger>
                      <SelectContent>
                        {delegations?.map((del: Delegation) => (
                          <SelectItem key={del.id} value={del.id}>
                            <span className="flex items-center gap-2">
                              {del.groupColor && <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: del.groupColor }} />}
                              {del.groupLabel ? `${del.groupLabel} > ${del.name}` : del.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!selectedDelegationId && (
                      <p className="text-sm text-red-600">Veuillez sélectionner une délégation</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Droit dans la délégation <span className="text-red-500">*</span></Label>
                    <Select value={delegationRight} onValueChange={setDelegationRight}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(DELEGATION_RIGHT_LABELS).map(([value, label]) => (
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
                <Info className="h-4 w-4" /> Le compte sera actif immédiatement
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => router.push('/dashboard/users')}>Annuler</Button>
                <Button type="submit" disabled={createMutation.isPending || !isDelegationValid}>
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
                  </div>
                </CardContent>
              </Card>

              {/* Delegation Card (mandatory) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Délégation d&apos;accès
                    <span className="text-xs font-normal text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded">Obligatoire</span>
                  </CardTitle>
                  <CardDescription>
                    Sans délégation, l&apos;utilisateur n&apos;aura aucun accès. Assignez au minimum une délégation.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Délégation <span className="text-red-500">*</span></Label>
                      <Select value={selectedDelegationId} onValueChange={setSelectedDelegationId}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner une délégation..." /></SelectTrigger>
                        <SelectContent>
                          {delegations?.map((del: Delegation) => (
                            <SelectItem key={del.id} value={del.id}>
                              <span className="flex items-center gap-2">
                                {del.groupColor && <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: del.groupColor }} />}
                                {del.groupLabel ? `${del.groupLabel} > ${del.name}` : del.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!selectedDelegationId && (
                        <p className="text-sm text-red-600">Veuillez sélectionner une délégation</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Droit dans la délégation <span className="text-red-500">*</span></Label>
                      <Select value={delegationRight} onValueChange={setDelegationRight}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(DELEGATION_RIGHT_LABELS).map(([value, label]) => (
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
                  <Button type="submit" disabled={inviteMutation.isPending || !isDelegationValid}>
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
