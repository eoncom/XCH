// @ts-nocheck - Temporary fix for Radix UI + React 19 type incompatibility
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usersApi } from '@/lib/api/users';
import { siteAccessApi, type UserSiteAccess } from '@/lib/api/site-access';
import { ArrowLeft, MapPin, Lock, Unlock, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { User, UserRole } from '@/types';

const userRoleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  TECHNICIEN: 'Technicien',
  VIEWER: 'Observateur',
};

const userSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'MANAGER', 'TECHNICIEN', 'VIEWER']),
  phone: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = params.id as string;

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getById(userId),
  });

  const { data: userSiteAccess = [] } = useQuery<UserSiteAccess[]>({
    queryKey: ['site-access-user', userId],
    queryFn: () => siteAccessApi.listByUser(userId),
    enabled: !!userId,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    values: user
      ? {
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone || '',
          password: '',
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<UserFormData>) => usersApi.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      router.push('/dashboard/users');
    },
  });

  const onSubmit = (data: UserFormData) => {
    const updateData: Partial<UserFormData> = { ...data };
    if (!updateData.password) {
      delete updateData.password;
    }
    updateMutation.mutate(updateData);
  };

  const role = watch('role');

  // Force sync role when user data loads (fixes Select not showing current value)
  useEffect(() => {
    if (user?.role) {
      setValue('role', user.role);
    }
  }, [user, setValue]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/users">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Modifier l'utilisateur</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Compte (obligatoire) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Compte
              <span className="text-xs font-normal text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded">Obligatoire</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet <span className="text-red-500">*</span></Label>
                <Input id="name" {...register('name')} placeholder="Jean Dupont" />
                {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <Input id="email" type="email" {...register('email')} placeholder="jean.dupont@example.com" />
                {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input id="password" type="password" {...register('password')} placeholder="Laisser vide pour ne pas changer" />
                {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
                <p className="text-xs text-muted-foreground">Laisser vide pour conserver le mot de passe actuel</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rôle <span className="text-red-500">*</span></Label>
                <Select value={role || ''} onValueChange={(value) => setValue('role', value as UserRole, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
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

        {/* Section 2: Contact (optionnel) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Contact
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" type="tel" {...register('phone')} placeholder="+33 6 12 34 56 78" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Info className="h-4 w-4" />
            Les champs marqués <span className="text-red-500">*</span> sont obligatoires
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/users')}>Annuler</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </form>

      {/* Site Access Section (outside form) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Chantiers accessibles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user?.role === 'ADMIN' || user?.role === 'MANAGER' ? (
            <p className="text-sm text-muted-foreground">
              Les {userRoleLabels[user?.role || 'ADMIN'].toLowerCase()}s ont accès à tous les chantiers par défaut.
            </p>
          ) : userSiteAccess.length > 0 ? (
            <div className="space-y-2">
              {userSiteAccess.map((access) => (
                <div key={access.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Link
                      href={`/dashboard/sites/${access.siteId}`}
                      className="text-sm font-medium hover:underline text-primary"
                    >
                      {access.site?.code} - {access.site?.name}
                    </Link>
                  </div>
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    {access.accessLevel === 'WRITE' ? (
                      <><Unlock className="h-3 w-3" /> Écriture</>
                    ) : (
                      <><Lock className="h-3 w-3" /> Lecture</>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun accès spécifique configuré. Allez sur la page d'un chantier pour accorder l'accès.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
