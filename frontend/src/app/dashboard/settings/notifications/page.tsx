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
import { Separator } from '@/components/ui/separator';
import { notificationsApi, type NotificationConfigData, type ChannelConfig, type EventConfig } from '@/lib/api/notifications';
import { organizationApi } from '@/lib/api/organization';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/auth-store';
import {
  Bell, Mail, MessageSquare, Settings, Save, TestTube, ArrowLeft,
  Check, X, ChevronRight, Info, RotateCcw, History, Loader2,
} from 'lucide-react';
import Link from 'next/link';

const SCOPE_LABELS: Record<string, string> = {
  GLOBAL: 'Global',
  DELEGATION: 'Par délégation',
};

const CATEGORY_LABELS: Record<string, string> = {
  tasks: 'Tâches',
  sites: 'Sites',
  assets: 'Équipements',
  monitoring: 'Monitoring',
  auth: 'Authentification',
};

export default function NotificationsSettingsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const tenantId = user?.tenantId || '';
  const isAdmin = user?.role === 'ADMIN';

  // Scope selection: global (null) or per-delegation
  const [scopeMode, setScopeMode] = useState<string>('GLOBAL');
  const [delegationId, setDelegationId] = useState<string | null>(null);

  // Local edited state
  const [editedChannels, setEditedChannels] = useState<Record<string, ChannelConfig>>({});
  const [editedEvents, setEditedEvents] = useState<Record<string, EventConfig>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Email recipients input
  const [newRecipient, setNewRecipient] = useState('');

  // Fetch metadata
  const { data: meta } = useQuery({
    queryKey: ['notification-meta'],
    queryFn: notificationsApi.getMeta,
  });

  // Fetch delegations for scope selection
  const { data: delegations } = useQuery({
    queryKey: ['delegations'],
    queryFn: () => organizationApi.getDelegations(),
    enabled: isAdmin,
  });

  // Fetch config for selected scope
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['notification-config', delegationId],
    queryFn: () => notificationsApi.getConfig(delegationId),
    enabled: scopeMode === 'GLOBAL' || !!delegationId,
  });

  // Fetch logs
  const { data: logsResponse } = useQuery({
    queryKey: ['notification-logs'],
    queryFn: () => notificationsApi.getLogs({ page: 1, pageSize: 20 }),
    enabled: isAdmin,
  });
  const logs = logsResponse?.data || [];

  // Initialize edited state from fetched config
  useEffect(() => {
    if (config) {
      setEditedChannels(config.channels || {});
      setEditedEvents(config.events || {});
      setIsDirty(false);
    }
  }, [config]);

  // Reset delegationId when scope mode changes
  useEffect(() => {
    if (scopeMode === 'GLOBAL') {
      setDelegationId(null);
    } else {
      setDelegationId('');
    }
  }, [scopeMode]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      notificationsApi.saveConfig({
        delegationId,
        channels: editedChannels,
        events: editedEvents,
      }),
    onSuccess: () => {
      showToast.success('Configuration sauvegardée');
      queryClient.invalidateQueries({ queryKey: ['notification-config'] });
      setIsDirty(false);
    },
    onError: (err: any) => {
      showToast.error(err.message || 'Erreur lors de la sauvegarde');
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: (params: { channel: string; config: any }) =>
      notificationsApi.testChannel(params.channel, params.config),
    onSuccess: (result) => {
      if (result.success) {
        showToast.success('Test envoyé avec succès !');
      } else {
        showToast.error(`Échec du test : ${result.error}`);
      }
    },
    onError: (err: any) => {
      showToast.error(err.message || 'Erreur lors du test');
    },
  });

  // Reset to inheritance
  const resetMutation = useMutation({
    mutationFn: () => notificationsApi.deleteConfig(delegationId),
    onSuccess: () => {
      showToast.success('Configuration réinitialisée (héritage parent)');
      queryClient.invalidateQueries({ queryKey: ['notification-config'] });
    },
  });

  // ── Channel handlers ──
  const updateChannel = (name: string, updates: Partial<ChannelConfig>) => {
    setEditedChannels((prev) => ({
      ...prev,
      [name]: { ...prev[name], ...updates },
    }));
    setIsDirty(true);
  };

  const addRecipient = (channelName: string) => {
    if (!newRecipient || !newRecipient.includes('@')) return;
    const current = editedChannels[channelName]?.recipients || [];
    if (!current.includes(newRecipient)) {
      updateChannel(channelName, { recipients: [...current, newRecipient] });
    }
    setNewRecipient('');
  };

  const removeRecipient = (channelName: string, email: string) => {
    const current = editedChannels[channelName]?.recipients || [];
    updateChannel(channelName, { recipients: current.filter((r) => r !== email) });
  };

  // ── Event handlers ──
  const updateEvent = (eventKey: string, updates: Partial<EventConfig>) => {
    setEditedEvents((prev) => ({
      ...prev,
      [eventKey]: { ...prev[eventKey], ...updates },
    }));
    setIsDirty(true);
  };

  const toggleEventChannel = (eventKey: string, channel: string) => {
    const current = editedEvents[eventKey]?.channels || [];
    const newChannels = current.includes(channel)
      ? current.filter((c) => c !== channel)
      : [...current, channel];
    updateEvent(eventKey, { channels: newChannels });
  };

  // Group events by category
  const eventsByCategory = useMemo(() => {
    if (!meta?.events) return {};
    const grouped: Record<string, { key: string; meta: any; config: EventConfig }[]> = {};
    for (const [key, eventMeta] of Object.entries(meta.events)) {
      const cat = eventMeta.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({
        key,
        meta: eventMeta,
        config: editedEvents[key] || { inherit: true, enabled: false, channels: [] },
      });
    }
    return grouped;
  }, [meta, editedEvents]);

  if (!isAdmin && user?.role !== 'MANAGER') {
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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6" /> Notifications
            </h1>
            <p className="text-sm text-muted-foreground">Configuration des alertes Email et MS Teams</p>
          </div>
        </div>
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
          <CardDescription>Les configurations par délégation héritent de la configuration globale</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="w-48">
              <Label>Niveau</Label>
              <Select value={scopeMode} onValueChange={setScopeMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GLOBAL">Global</SelectItem>
                  {isAdmin && <SelectItem value="DELEGATION">Par délégation</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {scopeMode === 'DELEGATION' && delegations && (
              <div className="w-64">
                <Label>Délégation</Label>
                <Select value={delegationId || ''} onValueChange={setDelegationId}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {delegations.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {config?.isDefault && scopeMode !== 'GLOBAL' && (
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                <Info className="h-3 w-3 mr-1" /> Hérite du global
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {configLoading ? (
        <Card><CardContent className="p-10 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></CardContent></Card>
      ) : (
        <Tabs defaultValue="channels">
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
                  <div className="flex items-center gap-3">
                    {scopeMode !== 'GLOBAL' && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Hériter</Label>
                        <Switch
                          checked={editedChannels.email?.inherit || false}
                          onCheckedChange={(v) => updateChannel('email', { inherit: v })}
                        />
                      </div>
                    )}
                    <Switch
                      checked={editedChannels.email?.enabled || false}
                      onCheckedChange={(v) => updateChannel('email', { enabled: v, inherit: false })}
                      disabled={editedChannels.email?.inherit}
                    />
                  </div>
                </div>
              </CardHeader>
              {!editedChannels.email?.inherit && editedChannels.email?.enabled && (
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm">Destinataires</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={newRecipient}
                        onChange={(e) => setNewRecipient(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient('email'))}
                        className="max-w-sm"
                      />
                      <Button variant="outline" size="sm" onClick={() => addRecipient('email')}>Ajouter</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(editedChannels.email?.recipients || []).map((r) => (
                        <Badge key={r} variant="secondary" className="gap-1">
                          {r}
                          <button onClick={() => removeRecipient('email', r)} className="ml-1 hover:text-red-500">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testMutation.mutate({ channel: 'email', config: editedChannels.email })}
                    disabled={testMutation.isPending || !(editedChannels.email?.recipients?.length)}
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
                  <div className="flex items-center gap-3">
                    {scopeMode !== 'GLOBAL' && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Hériter</Label>
                        <Switch
                          checked={editedChannels.teams?.inherit || false}
                          onCheckedChange={(v) => updateChannel('teams', { inherit: v })}
                        />
                      </div>
                    )}
                    <Switch
                      checked={editedChannels.teams?.enabled || false}
                      onCheckedChange={(v) => updateChannel('teams', { enabled: v, inherit: false })}
                      disabled={editedChannels.teams?.inherit}
                    />
                  </div>
                </div>
              </CardHeader>
              {!editedChannels.teams?.inherit && editedChannels.teams?.enabled && (
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm">Webhook URL</Label>
                    <Input
                      placeholder="https://outlook.office.com/webhook/..."
                      value={editedChannels.teams?.webhookUrl || ''}
                      onChange={(e) => updateChannel('teams', { webhookUrl: e.target.value })}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Créez un Incoming Webhook dans votre canal Teams, puis collez l&apos;URL ici.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testMutation.mutate({ channel: 'teams', config: editedChannels.teams })}
                    disabled={testMutation.isPending || !editedChannels.teams?.webhookUrl}
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
                    {events.map(({ key, meta: eventMeta, config: eventCfg }) => (
                      <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{eventMeta.label}</span>
                            {scopeMode !== 'GLOBAL' && eventCfg.inherit && (
                              <Badge variant="outline" className="text-xs text-blue-500 border-blue-200">hérité</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{eventMeta.description}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Channel toggles */}
                          <div className="flex gap-2">
                            {['email', 'teams'].map((ch) => (
                              <Button
                                key={ch}
                                variant={eventCfg.channels?.includes(ch) ? 'default' : 'outline'}
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  updateEvent(key, { inherit: false });
                                  toggleEventChannel(key, ch);
                                }}
                                disabled={eventCfg.inherit}
                              >
                                {ch === 'email' ? <Mail className="h-3 w-3 mr-1" /> : <MessageSquare className="h-3 w-3 mr-1" />}
                                {ch === 'email' ? 'Email' : 'Teams'}
                              </Button>
                            ))}
                          </div>
                          {/* Enable/disable */}
                          <Switch
                            checked={eventCfg.enabled}
                            onCheckedChange={(v) => updateEvent(key, { enabled: v, inherit: false })}
                            disabled={eventCfg.inherit}
                          />
                          {/* Inherit toggle */}
                          {scopeMode !== 'GLOBAL' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => updateEvent(key, { inherit: !eventCfg.inherit })}
                            >
                              {eventCfg.inherit ? 'Surcharger' : 'Hériter'}
                            </Button>
                          )}
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
                                {meta?.events?.[log.eventType]?.label || log.eventType}
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
