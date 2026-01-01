'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Building2, Plug, Save } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = () => {
    setIsSaving(true);
    // Simulate save
    setTimeout(() => {
      setIsSaving(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">
          Gérez votre profil et les paramètres de l'application
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="tenant">
            <Building2 className="mr-2 h-4 w-4" />
            Organisation
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Plug className="mr-2 h-4 w-4" />
            Intégrations
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet</Label>
                  <Input id="name" defaultValue={user?.name} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={user?.email}
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    defaultValue={user?.phone}
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                  <Input id="role" defaultValue={user?.role} disabled />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle>Modifier le mot de passe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                <Input id="currentPassword" type="password" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <Input id="newPassword" type="password" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirmer le mot de passe
                </Label>
                <Input id="confirmPassword" type="password" />
              </div>

              <div className="flex justify-end">
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  Mettre à jour le mot de passe
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tenant Tab */}
        <TabsContent value="tenant" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations de l'organisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Nom de l'organisation</Label>
                  <Input
                    id="orgName"
                    defaultValue="XCH Organisation"
                    disabled={user?.role !== 'ADMIN'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="domain">Domaine</Label>
                  <Input
                    id="domain"
                    defaultValue="xch.local"
                    disabled={user?.role !== 'ADMIN'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuseau horaire</Label>
                  <Input
                    id="timezone"
                    defaultValue="Europe/Paris"
                    disabled={user?.role !== 'ADMIN'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Langue</Label>
                  <Input
                    id="language"
                    defaultValue="Français"
                    disabled={user?.role !== 'ADMIN'}
                  />
                </div>
              </div>

              {user?.role === 'ADMIN' && (
                <div className="flex justify-end">
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {user?.role === 'ADMIN' && (
            <Card>
              <CardHeader>
                <CardTitle>Gestion des utilisateurs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Gérez les utilisateurs de votre organisation
                </p>
                <Button>
                  <User className="mr-2 h-4 w-4" />
                  Gérer les utilisateurs
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>NetBox</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="netboxUrl">URL NetBox</Label>
                  <Input
                    id="netboxUrl"
                    placeholder="https://netbox.example.com"
                    disabled={user?.role !== 'ADMIN'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="netboxToken">Token API</Label>
                  <Input
                    id="netboxToken"
                    type="password"
                    placeholder="••••••••••••"
                    disabled={user?.role !== 'ADMIN'}
                  />
                </div>
              </div>

              {user?.role === 'ADMIN' && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline">Tester la connexion</Button>
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Uptime Kuma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kumaUrl">URL Uptime Kuma</Label>
                  <Input
                    id="kumaUrl"
                    placeholder="https://uptime.example.com"
                    disabled={user?.role !== 'ADMIN'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kumaToken">Token API</Label>
                  <Input
                    id="kumaToken"
                    type="password"
                    placeholder="••••••••••••"
                    disabled={user?.role !== 'ADMIN'}
                  />
                </div>
              </div>

              {user?.role === 'ADMIN' && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline">Tester la connexion</Button>
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
