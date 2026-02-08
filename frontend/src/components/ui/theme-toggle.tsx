'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Simple theme toggle button (cycles through light -> dark -> system)
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const icon = resolvedTheme === 'dark' ? (
    <Moon className="h-5 w-5" />
  ) : (
    <Sun className="h-5 w-5" />
  );

  const label = theme === 'light' ? 'Clair' : theme === 'dark' ? 'Sombre' : 'Auto';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      title={`Thème : ${label} — Cliquer pour changer`}
      className="relative"
    >
      {icon}
      {theme === 'system' && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[8px] font-bold bg-primary text-primary-foreground rounded-full w-3 h-3 flex items-center justify-center">A</span>
      )}
      <span className="sr-only">Changer le thème ({label})</span>
    </Button>
  );
}

/**
 * Theme selector dropdown (for settings page)
 */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={theme} onValueChange={setTheme}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">
          <div className="flex items-center">
            <Sun className="mr-2 h-4 w-4" />
            Clair
          </div>
        </SelectItem>
        <SelectItem value="dark">
          <div className="flex items-center">
            <Moon className="mr-2 h-4 w-4" />
            Sombre
          </div>
        </SelectItem>
        <SelectItem value="system">
          <div className="flex items-center">
            <Monitor className="mr-2 h-4 w-4" />
            Système
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
