# Roadmap Améliorations UI/UX - Application XCH

**Date:** 2026-01-29
**Contexte:** Backend + Frontend fonctionnels (tests E2E ~72%+)
**Objectif:** Améliorer expérience utilisateur et design visuel

---

## 🎨 Vue d'Ensemble

### État Actuel
✅ **Application complète et fonctionnelle**
- Backend: 100% (10 modules, ~100 endpoints, RBAC 63 policies)
- Frontend: 100% (7 modules, 18 pages, 46 data-testid)
- Tests E2E: ~72%+ (110/152 tests estimés)

### Objectif UI/UX
🎯 **Expérience utilisateur professionnelle et moderne**
- Design cohérent et élégant
- Animations fluides
- Performance optimale
- Accessibilité WCAG 2.1 AA

---

## 🚀 Phase 1: Design System (Priorité Haute)

**Durée estimée:** 3-4 jours

### 1.1 Palette de Couleurs Professionnelle

**Objectif:** Remplacer couleurs par défaut par système cohérent

**Actions:**
```typescript
// frontend/src/styles/colors.ts (nouveau)
export const colors = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',  // Bleu principal
    600: '#2563eb',
    700: '#1d4ed8',
  },
  secondary: {
    500: '#8b5cf6',  // Violet
    600: '#7c3aed',
  },
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    500: '#6b7280',
    900: '#111827',
  },
}
```

**Fichiers à modifier:**
- `tailwind.config.ts` - Étendre theme.colors
- Remplacer hardcodés (`bg-blue-500` → `bg-primary-500`)

**Résultat attendu:**
- Cohérence visuelle toutes pages
- Thème personnalisé XCH

---

### 1.2 Typographie Améliorée

**Objectif:** Hiérarchie visuelle claire et lisibilité optimale

**Actions:**
```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.1', fontWeight: '700' }],
        'h1': ['2.5rem', { lineHeight: '1.2', fontWeight: '600' }],
        'h2': ['2rem', { lineHeight: '1.3', fontWeight: '600' }],
        'h3': ['1.5rem', { lineHeight: '1.4', fontWeight: '500' }],
        'body': ['1rem', { lineHeight: '1.6' }],
        'small': ['0.875rem', { lineHeight: '1.5' }],
      }
    }
  }
}
```

**Installer fonts:**
```bash
cd frontend
npm install @fontsource/inter @fontsource/jetbrains-mono
```

**Importer dans layout:**
```typescript
// src/app/layout.tsx
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
```

---

### 1.3 Espacements Cohérents

**Objectif:** Grid system uniforme (8px base)

**Actions:**
```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      spacing: {
        '18': '4.5rem',   // 72px
        '88': '22rem',    // 352px
        '128': '32rem',   // 512px
      }
    }
  }
}
```

**Pattern spacing recommandé:**
- Cards padding: `p-6` (24px)
- Sections margin: `mb-8` (32px)
- Grid gaps: `gap-6` (24px)
- Boutons padding: `px-4 py-2` (16px/8px)

---

### 1.4 Ombres et Élévations

**Objectif:** Profondeur visuelle avec ombres cohérentes

**Actions:**
```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'modal': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }
    }
  }
}
```

**Appliquer sur cards:**
```tsx
// Avant
<div className="border rounded-lg p-4">

// Après
<div className="shadow-card hover:shadow-card-hover transition-shadow rounded-lg p-6">
```

---

## 🎬 Phase 2: Animations & Transitions (Priorité Haute)

**Durée estimée:** 2-3 jours

### 2.1 Installer Framer Motion

```bash
cd frontend
npm install framer-motion
```

### 2.2 Animations Page Transitions

**Créer composant wrapper:**
```tsx
// src/components/PageTransition.tsx
import { motion } from 'framer-motion'

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}
```

**Appliquer sur toutes pages:**
```tsx
// src/app/dashboard/sites/page.tsx
export default function SitesPage() {
  return (
    <PageTransition>
      {/* Contenu existant */}
    </PageTransition>
  )
}
```

---

### 2.3 Animations Cards au Hover

```tsx
// src/components/SiteCard.tsx
import { motion } from 'framer-motion'

export function SiteCard({ site }: Props) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="card"
    >
      {/* Contenu card */}
    </motion.div>
  )
}
```

---

### 2.4 Animations Boutons

```tsx
// src/components/ui/button.tsx
import { motion } from 'framer-motion'

export function Button({ children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      {...props}
    >
      {children}
    </motion.button>
  )
}
```

---

### 2.5 Transitions Modales/Dialogs

```tsx
// src/components/Modal.tsx
import { motion, AnimatePresence } from 'framer-motion'

export function Modal({ isOpen, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="modal"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

---

## ⚡ Phase 3: Performance Optimization (Priorité Moyenne)

**Durée estimée:** 2-3 jours

### 3.1 React.memo sur Composants Lourds

**Identifier composants à optimiser:**
- `RackViewer.tsx` (Konva canvas)
- `FloorPlanViewer.tsx` (Konva canvas)
- `KanbanBoard.tsx` (drag & drop)
- `SiteCard.tsx` (répété 100+ fois)

**Exemple optimisation:**
```tsx
// Avant
export function SiteCard({ site }: Props) { ... }

// Après
export const SiteCard = React.memo(function SiteCard({ site }: Props) {
  return (...)
}, (prevProps, nextProps) => {
  return prevProps.site.id === nextProps.site.id &&
         prevProps.site.updatedAt === nextProps.site.updatedAt
})
```

---

### 3.2 Lazy Loading Modules

```tsx
// src/app/dashboard/racks/[id]/page.tsx
import dynamic from 'next/dynamic'

const RackViewer = dynamic(() => import('@/components/RackViewer'), {
  loading: () => <Skeleton className="h-96" />,
  ssr: false,
})

export default function RackDetailPage() {
  return (
    <div>
      <RackViewer rackId={id} />
    </div>
  )
}
```

---

### 3.3 Debounce Recherches

```tsx
// src/hooks/useDebounce.ts
import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
```

**Utilisation:**
```tsx
// src/app/dashboard/sites/page.tsx
const [searchQuery, setSearchQuery] = useState('')
const debouncedSearch = useDebounce(searchQuery, 300)

const { data: sites } = useQuery({
  queryKey: ['sites', debouncedSearch],
  queryFn: () => sitesApi.getAll({ search: debouncedSearch })
})
```

---

### 3.4 Optimisation Images

```tsx
// Avant
<img src={site.image} alt={site.name} />

// Après
import Image from 'next/image'

<Image
  src={site.image}
  alt={site.name}
  width={400}
  height={300}
  quality={85}
  placeholder="blur"
  blurDataURL="data:image/..."
/>
```

---

## 📱 Phase 4: Responsive Mobile Avancé (Priorité Moyenne)

**Durée estimée:** 3-4 jours

### 4.1 Breakpoints Mobile-First

```tsx
// Ordre prioritaire (mobile-first)
className="
  grid grid-cols-1          /* Mobile: 1 colonne */
  sm:grid-cols-2            /* Tablet: 2 colonnes */
  lg:grid-cols-3            /* Desktop: 3 colonnes */
  xl:grid-cols-4            /* Large: 4 colonnes */
"
```

### 4.2 Navigation Mobile Drawer

**Créer composant MobileNav:**
```tsx
// src/components/MobileNav.tsx
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger className="lg:hidden">
        <Menu className="h-6 w-6" />
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        {/* Menu navigation */}
      </SheetContent>
    </Sheet>
  )
}
```

---

### 4.3 Tables Responsive

```tsx
// Avant: Table fixe (overflow-x scroll sur mobile)
<table>...</table>

// Après: Cards sur mobile, table sur desktop
<div className="hidden lg:block">
  <table>...</table>
</div>
<div className="lg:hidden space-y-4">
  {items.map(item => <ItemCard key={item.id} item={item} />)}
</div>
```

---

## 🌓 Phase 5: Dark Mode (Priorité Basse)

**Durée estimée:** 2 jours

### 5.1 Configuration Tailwind

```typescript
// tailwind.config.ts
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // ...
      }
    }
  }
}
```

### 5.2 Provider Theme

```tsx
// src/providers/ThemeProvider.tsx
'use client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: Props) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light">
      {children}
    </NextThemesProvider>
  )
}
```

---

## 📊 Métriques de Succès UI/UX

### Performance
- [ ] Lighthouse Score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1

### Accessibilité
- [ ] WCAG 2.1 AA compliant
- [ ] Contraste couleurs > 4.5:1
- [ ] Navigation clavier complète
- [ ] Screen reader compatible

### UX
- [ ] Animations fluides (60fps)
- [ ] Feedback visuel immédiat (< 100ms)
- [ ] États loading/error/empty cohérents
- [ ] Mobile touch-friendly (targets > 44px)

---

## 🎯 Plan d'Exécution Recommandé

### Semaine 1: Design System + Animations
- Jour 1-2: Couleurs + Typographie + Espacements
- Jour 3-4: Framer Motion + Page transitions
- Jour 5: Animations cards + boutons + modales

### Semaine 2: Performance + Responsive
- Jour 1-2: React.memo + Lazy loading + Debounce
- Jour 3-4: Responsive mobile (navigation, tables)
- Jour 5: Optimisation images + fonts

### Semaine 3: Polish + Dark Mode
- Jour 1-2: Dark mode setup + variables CSS
- Jour 3-4: Tests accessibilité + corrections
- Jour 5: Tests utilisateurs + ajustements

---

## 📚 Ressources

**Design Inspiration:**
- https://ui.shadcn.com - Composants UI modernes
- https://tailwindui.com - Templates Tailwind
- https://dribbble.com/tags/dashboard - Designs dashboard

**Documentation:**
- https://www.framer.com/motion - Framer Motion
- https://nextjs.org/docs/app/building-your-application/optimizing - Next.js Optimizations
- https://www.w3.org/WAI/WCAG21/quickref - WCAG 2.1 Guidelines

---

**Prêt à démarrer les améliorations UI/UX !** 🎨
