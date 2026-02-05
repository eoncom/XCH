'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Activity,
  Wifi,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Bell,
  Settings,
  ExternalLink,
  Info,
} from 'lucide-react';

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/integrations">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Monitoring</h1>
          <p className="text-muted-foreground">
            Surveillance des liens Internet et SDWAN par chantier
          </p>
        </div>
      </div>

      {/* Coming Soon Badge */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Bientot disponible</p>
              <p className="text-sm text-muted-foreground">
                Cette fonctionnalite est en cours de developpement et sera disponible prochainement.
              </p>
            </div>
            <Badge variant="secondary">Phase 5</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Concept Explanation */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900">
                <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle>Vue d'ensemble</CardTitle>
                <CardDescription>Concept du module Monitoring</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Le module Monitoring permet de visualiser l'etat des liens Internet et SDWAN
              pour chaque chantier. Les donnees proviennent de vos outils de monitoring existants.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Statut en temps reel</p>
                  <p className="text-xs text-muted-foreground">
                    Visualisez l'etat UP/DOWN de chaque lien directement sur le tableau de bord
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Alertes integrees</p>
                  <p className="text-xs text-muted-foreground">
                    Recevez les alertes de vos outils de monitoring dans l'interface XCH
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Vue par chantier</p>
                  <p className="text-xs text-muted-foreground">
                    Associez les moniteurs a chaque site pour une vue contextuelle
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compatible Solutions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Solutions compatibles</CardTitle>
                <CardDescription>Outils de monitoring supportes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              XCH s'integre avec plusieurs solutions de monitoring populaires en mode lecture seule.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Uptime Kuma</p>
                    <p className="text-xs text-muted-foreground">Self-hosted monitoring</p>
                  </div>
                </div>
                <Badge variant="outline">Recommande</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="font-medium">CheckMK</p>
                    <p className="text-xs text-muted-foreground">Enterprise monitoring</p>
                  </div>
                </div>
                <Badge variant="secondary">Bientot</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Wifi className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium">Webhooks</p>
                    <p className="text-xs text-muted-foreground">Integration generique</p>
                  </div>
                </div>
                <Badge variant="secondary">Bientot</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Mockup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Apercu de l'interface
          </CardTitle>
          <CardDescription>
            Voici a quoi ressemblera le tableau de bord monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed p-6 bg-muted/30">
            {/* Mock Dashboard */}
            <div className="space-y-4">
              {/* Mock Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Statut des liens</h3>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">12 UP</Badge>
                  <Badge variant="destructive">2 DOWN</Badge>
                </div>
              </div>

              {/* Mock Table */}
              <div className="rounded-lg border bg-card">
                <div className="grid grid-cols-4 gap-4 p-3 border-b bg-muted/50 text-sm font-medium">
                  <span>Chantier</span>
                  <span>Lien principal</span>
                  <span>Lien backup</span>
                  <span>Derniere verification</span>
                </div>

                {/* Mock rows */}
                {[
                  { site: 'PARIS-001', primary: 'up', backup: 'up', time: 'Il y a 2 min' },
                  { site: 'LYON-042', primary: 'up', backup: 'down', time: 'Il y a 1 min' },
                  { site: 'MARSEILLE-018', primary: 'down', backup: 'up', time: 'Il y a 30 sec' },
                ].map((row, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-4 gap-4 p-3 border-b last:border-b-0 text-sm items-center"
                  >
                    <span className="font-medium">{row.site}</span>
                    <span>
                      {row.primary === 'up' ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          UP
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          DOWN
                        </Badge>
                      )}
                    </span>
                    <span>
                      {row.backup === 'up' ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          UP
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          DOWN
                        </Badge>
                      )}
                    </span>
                    <span className="text-muted-foreground">{row.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Link */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Documentation</p>
                <p className="text-sm text-muted-foreground">
                  Consultez la documentation pour preparer l'integration de votre solution de monitoring
                </p>
              </div>
            </div>
            <Button variant="outline" disabled>
              <ExternalLink className="mr-2 h-4 w-4" />
              Documentation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
