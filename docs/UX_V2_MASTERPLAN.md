# XCH UX V2 - Master Plan

**Date :** 2026-01-25
**Auteur :** Claude (Orchestrateur)
**Statut :** PLAN - En attente validation

---

## 📊 AUDIT UX ACTUEL (V1)

### Score Global : 7.5/10

| Domaine | Score | Notes |
|---------|-------|-------|
| Composants UI | 8/10 | shadcn/ui complet |
| Design System | 8/10 | Cohérent mais neutre |
| Navigation | 9/10 | Mobile-first ✅ |
| Responsivité | 9/10 | Grilles adaptées |
| Accessibilité | 5/10 | ARIA incomplet |
| Dark Mode | 4/10 | Variables OK, toggle absent |
| Loading States | 4/10 | Texte simple, pas skeleton |
| Interactions | 9/10 | Drag-drop fluide |
| Performance | 8/10 | Optimisations OK |

### Points Forts V1
- ✅ Architecture solide (Next.js 15 + React 19)
- ✅ Composants shadcn/ui cohérents
- ✅ Navigation mobile-first
- ✅ Visualisations Konva (racks, plans) fluides
- ✅ Carte Leaflet interactive
- ✅ Kanban drag-drop natif

### Points Faibles V1
- ❌ Design trop "neutre" / corporate
- ❌ Pas de toggle dark mode
- ❌ Loading states basiques
- ❌ Pas de feedback visuel animations
- ❌ Accessibilité ARIA incomplète
- ❌ Pas de branding personnalisable

---

## 🎯 VISION UX V2

### Objectifs Clés

1. **Design Moderne & Sexy** - Sortir du "corporate gris"
2. **Branding Configurable** - Logo, couleurs, thème par tenant
3. **Dark Mode Complet** - Toggle + préférence système
4. **Micro-interactions** - Feedback visuel constant
5. **Accessibilité A11y** - WCAG 2.1 AA compliance
6. **Performance Perçue** - Skeleton loading, optimistic UI

### Inspiration Design

```
Modern SaaS Tools:
- Linear (clean, minimalist, micro-animations)
- Notion (flexible, polished, dark mode parfait)
- Vercel Dashboard (sharp, professional, performant)
- Figma (collaborative feel, smooth interactions)
- Tailwind UI Pro (composants premium)
```

---

## 🎨 NOUVEAU THÈME V2

### 1. Palette de Couleurs

```css
/* Light Mode */
--primary: 222.2 84% 56%;        /* Bleu vif (plus saturé) */
--primary-hover: 222.2 84% 48%;  /* Bleu foncé hover */
--accent: 142 76% 36%;           /* Vert succès */
--accent-2: 38 92% 50%;          /* Orange attention */
--accent-3: 0 84% 60%;           /* Rouge danger */

/* Surfaces */
--background: 0 0% 100%;         /* Blanc pur */
--surface: 210 20% 98%;          /* Gris très clair */
--surface-raised: 0 0% 100%;     /* Cartes blanches */
--border: 214 32% 91%;           /* Bordures subtiles */

/* Text */
--foreground: 222 47% 11%;       /* Texte principal (quasi noir) */
--muted: 215 16% 47%;            /* Texte secondaire */

/* Dark Mode */
--background-dark: 222 47% 8%;   /* Noir profond bleuté */
--surface-dark: 222 40% 12%;     /* Surface cartes */
--surface-raised-dark: 222 35% 16%;
--foreground-dark: 210 40% 98%;  /* Texte clair */
--border-dark: 217 33% 20%;      /* Bordures sombres */
```

### 2. Typographie

```css
/* Font Stack Premium */
--font-sans: 'Inter Variable', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;

/* Sizes (Type Scale) */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 3. Spacing System

```css
/* 8pt Grid System */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### 4. Border Radius

```css
--radius-sm: 0.375rem;  /* 6px - badges, pills */
--radius-md: 0.5rem;    /* 8px - cards, inputs */
--radius-lg: 0.75rem;   /* 12px - modals, popovers */
--radius-xl: 1rem;      /* 16px - large cards */
--radius-full: 9999px;  /* Full round - avatars, buttons */
```

### 5. Shadows

```css
/* Elevation System */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);

/* Colored Shadows (pour cartes interactive) */
--shadow-primary: 0 4px 14px 0 rgb(59 130 246 / 0.25);
--shadow-success: 0 4px 14px 0 rgb(34 197 94 / 0.25);
--shadow-warning: 0 4px 14px 0 rgb(245 158 11 / 0.25);
--shadow-danger: 0 4px 14px 0 rgb(239 68 68 / 0.25);
```

---

## 🖼️ BRANDING CONFIGURABLE

### Configuration Tenant

```typescript
interface TenantBranding {
  // Logo
  logo: {
    light: string;     // URL logo light mode
    dark: string;      // URL logo dark mode
    icon: string;      // Favicon / app icon
  };

  // Colors
  colors: {
    primary: string;   // Couleur principale (hex)
    accent: string;    // Couleur accent (hex)
  };

  // Typography
  typography: {
    fontFamily?: string;  // Override font
  };

  // Meta
  appName: string;        // "XCH - Délégation Paris"
  tagline?: string;       // "Gestion IT Chantiers"
}
```

### Points de Personnalisation

| Élément | Emplacement | Type |
|---------|-------------|------|
| Logo Principal | Header sidebar | Image |
| Favicon | Browser tab | Icon |
| Couleur Primaire | Buttons, links, accents | Color |
| Nom Application | Header, page title | Text |
| Exports PDF | Entête documents | Logo + Color |
| QR Codes Labels | Étiquettes | Logo |
| Emails | Templates | Logo + Color |

### Stockage

```typescript
// Backend: Prisma model
model Tenant {
  id          String @id @default(uuid())
  name        String
  branding    Json?  // TenantBranding serialized
  // ...
}

// Frontend: Zustand store
const useBrandingStore = create((set) => ({
  branding: null,
  setBranding: (branding) => set({ branding }),
}));
```

---

## 🌙 DARK MODE COMPLET

### Implémentation

```typescript
// next-themes integration
import { ThemeProvider } from 'next-themes';

// app/layout.tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  {children}
</ThemeProvider>

// Theme Toggle Component
const ThemeToggle = () => {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" /> Clair
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" /> Sombre
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" /> Système
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

### Variables CSS Dark

```css
.dark {
  --background: 222 47% 8%;
  --foreground: 210 40% 98%;
  --card: 222 40% 12%;
  --card-foreground: 210 40% 98%;
  --popover: 222 40% 12%;
  --popover-foreground: 210 40% 98%;
  --primary: 217 91% 60%;
  --primary-foreground: 222 47% 11%;
  --secondary: 217 33% 17%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --accent: 217 33% 17%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62% 54%;
  --destructive-foreground: 210 40% 98%;
  --border: 217 33% 20%;
  --input: 217 33% 20%;
  --ring: 224 76% 48%;
}
```

---

## ✨ MICRO-INTERACTIONS & ANIMATIONS

### 1. Transitions Globales

```css
/* Base transitions */
.transition-base {
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.transition-smooth {
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover effects */
.hover-lift {
  transition: transform 200ms ease, box-shadow 200ms ease;
}
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Press effect */
.press-effect:active {
  transform: scale(0.98);
}
```

### 2. Loading States

```typescript
// Skeleton Component
const Skeleton = ({ className, ...props }) => (
  <div
    className={cn(
      "animate-pulse rounded-md bg-muted",
      className
    )}
    {...props}
  />
);

// Card Skeleton
const CardSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-4 w-[250px]" />
      <Skeleton className="h-4 w-[200px]" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-[125px] w-full rounded-xl" />
    </CardContent>
  </Card>
);

// Table Skeleton
const TableSkeleton = ({ rows = 5 }) => (
  <div className="space-y-3">
    {[...Array(rows)].map((_, i) => (
      <Skeleton key={i} className="h-12 w-full" />
    ))}
  </div>
);
```

### 3. Page Transitions

```typescript
// Framer Motion integration
import { motion, AnimatePresence } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const PageWrapper = ({ children }) => (
  <motion.div
    initial="initial"
    animate="animate"
    exit="exit"
    variants={pageVariants}
    transition={{ duration: 0.3, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);
```

### 4. Toast Notifications Améliorées

```typescript
// sonner (meilleur que react-hot-toast)
import { toast } from 'sonner';

// Success avec action
toast.success('Site créé avec succès', {
  description: 'Paris La Défense a été ajouté',
  action: {
    label: 'Voir',
    onClick: () => router.push('/sites/123')
  }
});

// Error avec détails
toast.error('Erreur de connexion', {
  description: 'Impossible de joindre le serveur',
  action: {
    label: 'Réessayer',
    onClick: () => retry()
  }
});

// Promise toast (loading → success/error)
toast.promise(createSite(data), {
  loading: 'Création en cours...',
  success: 'Site créé !',
  error: 'Erreur lors de la création'
});
```

### 5. Button States

```css
/* Button with loading spinner */
.btn-loading {
  position: relative;
  color: transparent;
}
.btn-loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* Success state */
.btn-success {
  background: var(--accent);
  animation: pulse 0.3s ease;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

---

## 📱 AMÉLIORATIONS MOBILE

### 1. Bottom Navigation (Mobile)

```typescript
const MobileNav = () => (
  <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
    <div className="flex justify-around py-2">
      <NavItem icon={Home} label="Accueil" href="/dashboard" />
      <NavItem icon={MapPin} label="Sites" href="/dashboard/sites" />
      <NavItem icon={Package} label="Assets" href="/dashboard/assets" />
      <NavItem icon={CheckSquare} label="Tâches" href="/dashboard/tasks" />
      <NavItem icon={Menu} label="Plus" onClick={openMenu} />
    </div>
  </nav>
);
```

### 2. Pull-to-Refresh

```typescript
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';

const SitesList = () => {
  const { isRefreshing, pullProps } = usePullToRefresh({
    onRefresh: () => refetchSites()
  });

  return (
    <div {...pullProps}>
      {isRefreshing && <RefreshIndicator />}
      {/* Content */}
    </div>
  );
};
```

### 3. Gestures (Swipe Actions)

```typescript
// Swipe to reveal actions
const TaskCard = ({ task }) => (
  <SwipeableRow
    leftActions={[
      { label: 'Done', color: 'green', onPress: () => markDone(task.id) }
    ]}
    rightActions={[
      { label: 'Delete', color: 'red', onPress: () => deleteTask(task.id) }
    ]}
  >
    <TaskContent task={task} />
  </SwipeableRow>
);
```

### 4. Optimized Touch Targets

```css
/* Minimum 44px touch targets */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Larger padding on mobile */
@media (max-width: 768px) {
  .btn {
    padding: 12px 20px;
  }
  .input {
    padding: 14px 16px;
    font-size: 16px; /* Prevents zoom on iOS */
  }
}
```

---

## ♿ ACCESSIBILITÉ (A11y)

### 1. ARIA Labels

```typescript
// Button avec aria-label
<Button aria-label="Créer un nouveau site">
  <Plus className="h-4 w-4" />
</Button>

// Dialog avec aria-describedby
<Dialog>
  <DialogContent aria-describedby="dialog-description">
    <DialogHeader>
      <DialogTitle>Confirmer la suppression</DialogTitle>
      <DialogDescription id="dialog-description">
        Cette action est irréversible. Le site sera définitivement supprimé.
      </DialogDescription>
    </DialogHeader>
  </DialogContent>
</Dialog>
```

### 2. Keyboard Navigation

```typescript
// Focus trap pour modals
import { FocusTrap } from '@headlessui/react';

<FocusTrap>
  <Dialog.Panel>
    {/* Premier élément focusable recevra le focus */}
  </Dialog.Panel>
</FocusTrap>

// Skip links
const SkipLinks = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-white"
  >
    Aller au contenu principal
  </a>
);
```

### 3. Announce Changes

```typescript
// Live regions pour screen readers
import { useAnnounce } from '@/hooks/use-announce';

const TaskList = () => {
  const announce = useAnnounce();

  const handleComplete = async (taskId) => {
    await completeTask(taskId);
    announce('Tâche marquée comme terminée');
  };
};
```

### 4. Color Contrast

```css
/* WCAG AA minimum contrast ratios */
/* Text: 4.5:1 (small), 3:1 (large) */
/* UI components: 3:1 */

/* Safe colors - contrast verified */
--text-primary: hsl(222 47% 11%);    /* #1e293b on white = 12.6:1 ✅ */
--text-secondary: hsl(215 16% 47%);  /* #64748b on white = 4.5:1 ✅ */
--text-muted: hsl(215 20% 65%);      /* #94a3b8 on white = 3.0:1 ⚠️ (large only) */

/* Error states with patterns, not just color */
.input-error {
  border-color: var(--destructive);
  background-image: url("data:image/svg+xml,..."); /* Warning icon */
}
```

---

## 📋 NOUVELLES FEATURES UX

### 1. Recherche Globale (Command Palette)

```typescript
// Ctrl+K / Cmd+K
const CommandPalette = () => {
  const [open, setOpen] = useState(false);

  useHotkeys('mod+k', () => setOpen(true));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Rechercher..." />
      <CommandList>
        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => navigate('/dashboard')}>
            <Home className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Sites récents">
          {recentSites.map(site => (
            <CommandItem key={site.id} onSelect={() => navigate(`/sites/${site.id}`)}>
              <MapPin className="mr-2 h-4 w-4" />
              {site.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => openCreateSite()}>
            <Plus className="mr-2 h-4 w-4" />
            Créer un site
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
```

### 2. Breadcrumbs Contextuels

```typescript
const Breadcrumbs = () => {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm">
      <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
        <Home className="h-4 w-4" />
      </Link>
      {segments.map((segment, i) => (
        <Fragment key={segment}>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Link
            href={`/${segments.slice(0, i + 1).join('/')}`}
            className={cn(
              "capitalize",
              i === segments.length - 1
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {formatSegment(segment)}
          </Link>
        </Fragment>
      ))}
    </nav>
  );
};
```

### 3. Data Tables Avancées

```typescript
// TanStack Table v8 integration
import { useReactTable, getCoreRowModel, getPaginationRowModel, getSortedRowModel } from '@tanstack/react-table';

const DataTable = ({ columns, data }) => {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className="cursor-pointer select-none"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() && (
                    header.column.getIsSorted() === 'asc'
                      ? <ChevronUp className="ml-2 h-4 w-4" />
                      : <ChevronDown className="ml-2 h-4 w-4" />
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <DataTablePagination table={table} />
    </div>
  );
};
```

### 4. Filtres Avancés

```typescript
const FiltersPanel = ({ filters, onChange }) => (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="outline">
        <Filter className="mr-2 h-4 w-4" />
        Filtres
        {activeFiltersCount > 0 && (
          <Badge className="ml-2">{activeFiltersCount}</Badge>
        )}
      </Button>
    </SheetTrigger>
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Filtres avancés</SheetTitle>
      </SheetHeader>
      <div className="space-y-6 py-6">
        {/* Status multi-select */}
        <div className="space-y-2">
          <Label>Statut</Label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map(status => (
              <Badge
                key={status.value}
                variant={filters.status.includes(status.value) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleFilter('status', status.value)}
              >
                {status.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="space-y-2">
          <Label>Période</Label>
          <DateRangePicker
            value={filters.dateRange}
            onChange={(range) => onChange({ ...filters, dateRange: range })}
          />
        </div>

        {/* Save filter */}
        <Button variant="outline" className="w-full">
          <Save className="mr-2 h-4 w-4" />
          Sauvegarder ce filtre
        </Button>
      </div>
    </SheetContent>
  </Sheet>
);
```

### 5. Statistiques Dashboard Enrichies

```typescript
const StatsCard = ({ title, value, change, trend, icon: Icon }) => (
  <Card className="hover-lift">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {change && (
        <p className={cn(
          "text-xs flex items-center mt-1",
          trend === 'up' ? "text-green-600" : "text-red-600"
        )}>
          {trend === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
          {change}% vs mois précédent
        </p>
      )}
    </CardContent>
  </Card>
);

// Sparkline mini-charts
const SparklineCard = ({ data, ...props }) => (
  <StatsCard {...props}>
    <Sparkline data={data} className="mt-4 h-8" />
  </StatsCard>
);
```

### 6. Notifications Center

```typescript
const NotificationsCenter = () => {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">Notifications</h4>
          <Button variant="ghost" size="sm" onClick={markAllAsRead}>
            Tout marquer lu
          </Button>
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={() => markAsRead(notification.id)}
            />
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
```

---

## 📊 FEATURES CAHIER DES CHARGES NON IMPLÉMENTÉES

### MVP Obligatoire (Manquant)

| Feature | CDC Section | Statut V1 | Priorité V2 |
|---------|-------------|-----------|-------------|
| Export PDF rapport chantier | §11.2 | ❌ | 🔴 Haute |
| Export Excel/CSV assets | §11.2 | ❌ | 🔴 Haute |
| Schéma baie PDF | §8.5 | ❌ | 🔴 Haute |
| Étiquettes QR imprimables | §4.2 | Partiel | 🟡 Moyenne |
| Checklist % completion | §5.1 | ❌ | 🟡 Moyenne |
| Recherche sauvegardée | §12.2 | ❌ | 🟢 Basse |
| Notifications échéances | §5.4 | ❌ | 🟡 Moyenne |
| Historique modifications | §14.1 | Backend OK | 🟡 Moyenne |
| Click-to-call contacts | §7.1 | ❌ | 🟢 Basse |

### Hors MVP (Optionnel mais cool)

| Feature | CDC Section | Valeur UX | Effort |
|---------|-------------|-----------|--------|
| Mode offline (PWA) | §15.1 | ⭐⭐⭐⭐⭐ | Élevé |
| Notifications push | §15.1 | ⭐⭐⭐⭐ | Moyen |
| SSO Microsoft 365 | §16.1 | ⭐⭐⭐ | Moyen |
| 2FA (TOTP) | §16.1 | ⭐⭐⭐ | Moyen |
| Multilingue FR/EN | §17 | ⭐⭐ | Élevé |
| Analytics BI | §17.2 | ⭐⭐ | Élevé |
| Planification auto | §17 | ⭐⭐⭐ | Élevé |

---

## 🗓️ ROADMAP UX V2

### Phase 1 : Foundation (Semaine 1-2)
- [ ] Nouveau thème couleurs + variables CSS
- [ ] Dark mode toggle + next-themes
- [ ] Skeleton loading components
- [ ] Composants shadcn manquants (Pagination, DataTable)
- [ ] Framer Motion page transitions

### Phase 2 : Polish (Semaine 3-4)
- [ ] Command palette (Ctrl+K)
- [ ] Breadcrumbs contextuels
- [ ] Toast notifications (sonner)
- [ ] Mobile bottom navigation
- [ ] Pull-to-refresh

### Phase 3 : Features (Semaine 5-6)
- [ ] Export PDF rapports chantiers
- [ ] Export Excel assets
- [ ] Schéma baie PDF
- [ ] Filtres avancés avec sauvegarde
- [ ] Notifications center

### Phase 4 : Advanced (Semaine 7-8)
- [ ] Branding configurable tenant
- [ ] Accessibilité WCAG 2.1 AA
- [ ] Optimistic UI mutations
- [ ] Virtual scrolling grandes listes
- [ ] PWA mode offline basique

---

## 📦 DÉPENDANCES À AJOUTER

```json
{
  "dependencies": {
    "next-themes": "^0.4.4",           // Dark mode
    "framer-motion": "^11.15.0",        // Animations
    "sonner": "^1.7.1",                 // Toast notifications
    "@tanstack/react-table": "^8.20.6", // Data tables
    "cmdk": "^1.0.4",                   // Command palette
    "recharts": "^2.15.0",              // Charts/sparklines
    "date-fns": "^4.1.0",               // Date formatting
    "jspdf": "^2.5.2",                  // PDF generation
    "xlsx": "^0.18.5"                   // Excel export
  }
}
```

---

## ✅ CHECKLIST VALIDATION V2

### Design System
- [ ] Palette couleurs définie
- [ ] Typography scale appliquée
- [ ] Spacing system 8pt
- [ ] Border radius cohérent
- [ ] Shadows elevation system

### Composants
- [ ] Dark mode sur tous composants
- [ ] Skeleton loading states
- [ ] Button loading states
- [ ] Error states visuels
- [ ] Empty states illustrés

### Navigation
- [ ] Mobile bottom nav
- [ ] Command palette
- [ ] Breadcrumbs
- [ ] Skip links accessibilité

### Performance
- [ ] Lighthouse score > 90
- [ ] FCP < 1.5s
- [ ] TTI < 3.5s
- [ ] CLS < 0.1

### Accessibilité
- [ ] ARIA labels complets
- [ ] Keyboard navigation
- [ ] Focus visible
- [ ] Color contrast AA
- [ ] Screen reader tested

---

**Document préparé par Claude - Orchestrateur XCH**
**En attente de validation pour démarrer l'implémentation UX V2**
