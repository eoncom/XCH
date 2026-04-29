'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  notificationsApi,
  type NotificationChannelKind,
  type NotificationEventType,
  type NotificationChannelDto,
  type NotificationRuleDto,
} from '@/lib/api/notifications';
import { organizationApi } from '@/lib/api/organization';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/usePermissions';
import { useDelegation } from '@/contexts/DelegationContext';
import {
  Bell, Mail, MessageSquare, Settings, Save, TestTube, ArrowLeft,
  Check, X, Info, RotateCcw, History, Loader2,
} from 'lucide-react';
import Link from 'next/link';

const CATEGORY_LABELS: Record<string, string> = {
  tasks: 'Tâches',
  sites: 'Sites',
  assets: 'Équipements',
  monitoring: 'Monitoring',
  auth: 'Authentification',
};

const CHANNEL_KINDS: NotificationChannelKind[] = ['EMAIL', 'TEAMS'];

/**
 * Notifications settings panel — ADR-020 (post-refacto).
 *
 * Modèle : 2 listes typées (channels par kind, rules par eventType). Plus
 * de flag `inherit` par-row : un override existe (row dans la table) ou
 * il n'existe pas (héritage automatique sur le scope parent global).
 *
 * "Réinitialiser (hériter)" → DELETE de tous les channels + rules au
 * scope courant ; au prochain GET, isDefault=true.
 */
export function NotificationsConfigPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { isAdmin, isManagerOrAbove, isSuperAdmin } = usePermissions();
  const { delegations: userDelegations, currentDelegation } = useDelegation();

  const manageableDelegations = useMemo(
    () => userDelegations.filter((d) => d.right === 'MANAGE'),
    [userDelegations],
  );

  const defaultDelegationId =
    currentDelegation?.delegationId ||
    manageableDelegations[0]?.delegationId ||
    null;

  const [scopeMode, setScopeMode] = useState<'GLOBAL' | 'DELEGATION'>(isSuperAdmin ? 'GLOBAL' : 'DELEGATION');
  const [delegationId, setDelegationId] = useState<string | null>(
    isSuperAdmin ? null : defaultDelegationId,
  );

  const [activeTab, setActiveTab] = useState<string>('channels');

  // Local edited state — channels indexed by kind, rules indexed by event.
  const [channelsByKind, setChannelsByKind] = useState<Record<NotificationChannelKind, NotificationChannelDto>>(() => emptyChannels());
  const [rulesByEvent, setRulesByEvent] = useState<Record<NotificationEventType, NotificationRuleDto>>(() => ({} as any));
  const [isDirty, setIsDirty] = useState(false);
  const [newRecipient, setNewRecipient] = useState('');

  const { data: meta } = useQuery({
    queryKey: ['notification-meta'],
    queryFn: notificationsApi.getMeta,
    staleTime: 5 * 60_000,
  });

  const { data: delegationsFromApi } = useQuery({
    queryKey: ['delegations'],
    queryFn: () => organizationApi.getDelegations(),
    enabled: isSuperAdmin,
    staleTime: 60_000,
  });

  const delegations = isSuperAdmin
    ? delegationsFromApi
    : manageableDelegations.map((ud) => ({ id: ud.delegationId, name: ud.delegation.name }));

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['notification-settings', delegationId],
    queryFn: () => notificationsApi.getSettings(delegationId),
    enabled: (scopeMode === 'GLOBAL' && isSuperAdmin) || !!delegationId,
    staleTime: 30_000,
  });

  const { data: logsResponse } = useQuery({
    queryKey: ['notification-logs'],
    queryFn: () => notificationsApi.getLogs({ page: 1, pageSize: 20 }),
    enabled: isAdmin && activeTab === 'logs',
    staleTime: 30_000,
  });
  const logs = logsResponse?.data || [];

  // Load → indexed state
  useEffect(() => {
    if (settings) {
      const ch: Record<NotificationChannelKind, NotificationChannelDto> = emptyChannels();
      for (const c of settings.channels) ch[c.kind] = c;
      setChannelsByKind(ch);

      const rl: Record<NotificationEventType, NotificationRuleDto> = {} as any;
      for (const r of settings.rules) rl[r.eventType] = r;
      setRulesByEvent(rl);

      setIsDirty(false);
    }
  }, [settings]);

  useEffect(() => {
    if (scopeMode === 'GLOBAL') {
      setDelegationId(null);
    } else if (!delegationId) {
      setDelegationId(defaultDelegationId || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeMode]);

  const saveMutation = useMutation({
    mutationFn: () =>
      notificationsApi.saveSettings({
        delegationId,
        channels: Object.values(channelsByKind).map((c) => ({
          kind: c.kind,
          enabled: c.enabled,
          recipients: c.recipients,
          webhookUrl: c.webhookUrl,
        })),
        rules: Object.values(rulesByEvent).map((r) => ({
          eventType: r.eventType,
          enabled: r.enabled,
          channels: r.channels,
        })),
      }),
    onSuccess: () => {
      showToast.success('Configuration sauvegardée');
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      setIsDirty(false);
    },
    onError: (err: any) => {
      showToast.error(err.message || 'Erreur lors de la sauvegarde');
    },
  });

  const testMutation = useMutation({
    mutationFn: (params: { kind: NotificationChannelKind }) =>
      notificationsApi.testChannel(params.kind, {
        recipients: channelsByKind[params.kind]?.recipients,
        webhookUrl: channelsByKind[params.kind]?.webhookUrl,
      }),
    onSuccess: (result) => {
      if (result.success) showToast.success('Test envoyé avec succès !');
      else showToast.error(`Échec du test : ${result.error}`);
    },
    onError: (err: any) => showToast.error(err.message || 'Erreur lors du test'),
  });

  const resetMutation = useMutation({
    mutationFn: () => notificationsApi.deleteSettings(delegationId),
    onSuccess: () => {
      showToast.success('Réinitialisé — héritage du global rétabli');
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });

  const updateChannel = (kind: NotificationChannelKind, updates: Partial<NotificationChannelDto>) => {
    setChannelsByKind((prev) => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        ...updates,
        kind,
      },
    }));
    setIsDirty(true);
  };

  const addRecipient = (kind: NotificationChannelKind) => {
    if (!newRecipient || !newRecipient.includes('@')) return;
    const current = channelsByKind[kind]?.recipients || [];
    if (!current.includes(newRecipient)) {
      updateChannel(kind, { recipients: [...current, newRecipient] });
    }
    setNewRecipient('');
  };

  const removeRecipient = (kind: NotificationChannelKind, email: string) => {
    const current = channelsByKind[kind]?.recipients || [];
    updateChannel(kind, { recipients: current.filter((r) => r !== email) });
  };

  const updateRule = (eventType: NotificationEventType, updates: Partial<NotificationRuleDto>) => {
    setRulesByEvent((prev) => ({
      ...prev,
      [eventType]: {
        eventType,
        enabled: prev[eventType]?.enabled ?? true,
        channels: prev[eventType]?.channels ?? [],
        ...updates,
      },
    }));
    setIsDirty(true);
  };

  const toggleRuleChannel = (eventType: NotificationEventType, kind: NotificationChannelKind) => {
    const current = rulesByEvent[eventType]?.channels || [];
    const next = current.includes(kind) ? current.filter((c) => c !== kind) : [...current, kind];
    updateRule(eventType, { channels: next });
  };

  const eventsByCategory = useMemo(() => {
    if (!meta?.events) return {};
    const grouped: Record<string, { key: NotificationEventType; meta: any; rule: NotificationRuleDto }[]> = {};
    for (const [key, eventMeta] of Object.entries(meta.events)) {
      const cat = eventMeta.category;
      if (!grouped[cat]) grouped[cat] = [];
      const eventKey = key as NotificationEventType;
      grouped[cat].push({
        key: eventKey,
        meta: eventMeta,
        rule:
          rulesByEvent[eventKey] ||
          { eventType: eventKey, enabled: true, channels: eventMeta.defaultChannels },
      });
    }
    return grouped;
  }, [meta, rulesByEvent]);

  if (!isManagerOrAbove) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Accès réservé aux administrateurs et managers.
          </CardContent>
        </Card>
      </div>
    );
  }

  const emailChannel = channelsByKind.EMAIL;
  const teamsChannel = channelsByKind.TEAMS;

  return (
    <div className={embedded ? 'space-y-6' : 'space-y-6 p-6'}>
      <div className="flex items-center justify-between">
        {embedded ? (
          <div />
        ) : (
          <div className="flex items-center gap-3">
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="icon" aria-label="Retour aux paramètres">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Bell className="h-6 w-6" /> Configuration des notifications
              </h1>
              <p className="text-sm text-muted-foreground">
                Canaux et règles par événement, scope global ou délégation.
              </p>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          {scopeMode !== 'GLOBAL' && delegationId && (
            <Button variant="outline" onClick={() => resetMutation.mutate()} size="sm">
              <RotateCcw className="h-4 w-4 mr-2" /> Réinitialiser (hériter)
            </Button>
          )}
          <Button onClick={() => saveMutation.mutate()} disabled={!isDirty || saveMutation.isPending} size="sm">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* Scope Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Périmètre de configuration</CardTitle>
          <CardDescription>
            Une délégation hérite de la configuration globale tant qu'elle n'a pas son propre override.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            {isSuperAdmin && (
              <div className="w-48">
                <Label>Niveau</Label>
                <Select value={scopeMode} onValueChange={(v) => setScopeMode(v as 'GLOBAL' | 'DELEGATION')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GLOBAL">Global</SelectItem>
                    <SelectItem value="DELEGATION">Par délégation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeMode === 'DELEGATION' && delegations && delegations.length > 0 && (
              <div className="w-64">
                <Label>Délégation</Label>
                {!isSuperAdmin && delegations.length === 1 ? (
                  <div className="h-10 flex items-center px-3 rounded-md border bg-muted/40 text-sm">
                    {delegations[0].name}
                  </div>
                ) : (
                  <Select value={delegationId || ''} onValueChange={setDelegationId}>
                    <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                    <SelectContent>
                      {delegations.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {settings?.isDefault && scopeMode !== 'GLOBAL' && (
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                <Info className="h-3 w-3 mr-1" /> Hérite du global
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {settingsLoading ? (
        <Card><CardContent className="p-10 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="channels"><Settings className="h-4 w-4 mr-2" /> Canaux</TabsTrigger>
            <TabsTrigger value="events"><Bell className="h-4 w-4 mr-2" /> Événements</TabsTrigger>
            {isAdmin && <TabsTrigger value="logs"><History className="h-4 w-4 mr-2" /> Journal</TabsTrigger>}
          </TabsList>

          {/* ─── Channels Tab ─── */}
          <TabsContent value="channels" className="space-y-4 mt-4">
            {/* Email */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-base">Email</CardTitle>
                      <CardDescription>Notifications par email SMTP</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={!!emailChannel?.enabled}
                    onCheckedChange={(v) => updateChannel('EMAIL', { enabled: v, recipients: emailChannel?.recipients ?? [], webhookUrl: null })}
                  />
                </div>
              </CardHeader>
              {emailChannel?.enabled && (
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm">Destinataires</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={newRecipient}
                        onChange={(e) => setNewRecipient(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient('EMAIL'))}
                        className="max-w-sm"
                      />
                      <Button variant="outline" size="sm" onClick={() => addRecipient('EMAIL')}>Ajouter</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(emailChannel?.recipients || []).map((r) => (
                        <Badge key={r} variant="secondary" className="gap-1">
                          {r}
                          <button onClick={() => removeRecipient('EMAIL', r)} className="ml-1 hover:text-red-500">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testMutation.mutate({ kind: 'EMAIL' })}
                    disabled={testMutation.isPending || !(emailChannel?.recipients?.length)}
                  >
                    <TestTube className="h-4 w-4 mr-2" /> Tester l&apos;envoi
                  </Button>
                </CardContent>
              )}
            </Card>

            {/* Teams */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-purple-600" />
                    <div>
                      <CardTitle className="text-base">Microsoft Teams</CardTitle>
                      <CardDescription>Notifications via Incoming Webhook</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={!!teamsChannel?.enabled}
                    onCheckedChange={(v) => updateChannel('TEAMS', { enabled: v, recipients: [], webhookUrl: teamsChannel?.webhookUrl ?? null })}
                  />
                </div>
              </CardHeader>
              {teamsChannel?.enabled && (
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm">Webhook URL</Label>
                    <Input
                      placeholder="https://outlook.office.com/webhook/..."
                      value={teamsChannel?.webhookUrl || ''}
                      onChange={(e) => updateChannel('TEAMS', { webhookUrl: e.target.value })}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Créez un Incoming Webhook dans votre canal Teams, puis collez l&apos;URL ici. Stockée chiffrée (ADR-019).
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testMutation.mutate({ kind: 'TEAMS' })}
                    disabled={testMutation.isPending || !teamsChannel?.webhookUrl}
                  >
                    <TestTube className="h-4 w-4 mr-2" /> Tester le webhook
                  </Button>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* ─── Events Tab ─── */}
          <TabsContent value="events" className="space-y-4 mt-4">
            {Object.entries(eventsByCategory).map(([category, events]) => (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{CATEGORY_LABELS[category] || category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {events.map(({ key, meta: eventMeta, rule }) => (
                      <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{eventMeta.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{eventMeta.description}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex gap-2">
                            {CHANNEL_KINDS.map((kind) => (
                              <Button
                                key={kind}
                                variant={rule.channels?.includes(kind) ? 'default' : 'outline'}
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => toggleRuleChannel(key, kind)}
                              >
                                {kind === 'EMAIL' ? <Mail className="h-3 w-3 mr-1" /> : <MessageSquare className="h-3 w-3 mr-1" />}
                                {kind === 'EMAIL' ? 'Email' : 'Teams'}
                              </Button>
                            ))}
                          </div>
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(v) => updateRule(key, { enabled: v })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ─── Logs Tab ─── */}
          {isAdmin && (
            <TabsContent value="logs" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Journal des notifications</CardTitle>
                  <CardDescription>20 dernières notifications envoyées</CardDescription>
                </CardHeader>
                <CardContent>
                  {logs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Aucune notification envoyée</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Événement</TableHead>
                          <TableHead>Canal</TableHead>
                          <TableHead>Destinataire</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs">
                              {new Date(log.createdAt).toLocaleString('fr-FR')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {meta?.events?.[log.eventType as NotificationEventType]?.label || log.eventType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {log.channel === 'email' ? 'Email' : 'Teams'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{log.recipient}</TableCell>
                            <TableCell>
                              {log.success ? (
                                <Badge className="bg-green-100 text-green-800 text-xs"><Check className="h-3 w-3 mr-1" /> OK</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 text-xs" title={log.errorMessage || ''}>
                                  <X className="h-3 w-3 mr-1" /> Échec
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

function emptyChannels(): Record<NotificationChannelKind, NotificationChannelDto> {
  return {
    EMAIL: { kind: 'EMAIL', enabled: false, recipients: [], webhookUrl: null },
    TEAMS: { kind: 'TEAMS', enabled: false, recipients: [], webhookUrl: null },
  };
}
