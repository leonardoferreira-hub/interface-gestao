import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ListTodo, CalendarCheck, BarChart3, Menu, LogOut, Layers, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from './theme-toggle';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/hooks/useCurrentUser';

const navItems = [
  { path: '/', label: 'Minhas Pendências', icon: ListTodo, restricted: false },
  { path: '/rotinas', label: 'Rotinas', icon: CalendarCheck, restricted: false },
  { path: '/kpis', label: 'KPIs', icon: BarChart3, restricted: 'kpi' as const },
  { path: '/equipe', label: 'Equipe', icon: Users, restricted: 'equipe' as const },
];

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || 'https://interface-travessia.vercel.app';

export function Navigation() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const { isAdmin, isCoordGestao, isCoordRH } = usePermissions();
  const canSeeKpis = isAdmin || isCoordGestao || isCoordRH;
  const canSeeEquipe = isAdmin || isCoordGestao || isCoordRH;
  const visibleItems = navItems.filter(item => {
    if (item.restricted === 'kpi') return canSeeKpis;
    if (item.restricted === 'equipe') return canSeeEquipe;
    return true;
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="h-0.5 bg-gradient-to-r from-primary/0 via-primary to-primary/0" aria-hidden="true" />
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block">Gestão</span>
          </Link>
        </div>

        {/* Desktop */}
        <nav className="hidden sm:flex items-center space-x-6 text-sm font-medium flex-1">
          {visibleItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-1.5 transition-colors hover:text-foreground/80',
                location.pathname === item.path ? 'text-foreground' : 'text-foreground/60'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex gap-1.5 text-muted-foreground hover:text-foreground">
            <a href={PORTAL_URL}>
              <Layers className="h-4 w-4" /> Portal
            </a>
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={signOut} className="hidden sm:flex">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="sm:hidden ml-2">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <div className="flex flex-col gap-4 mt-8">
              {visibleItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-2 py-2 rounded-md transition-colors',
                    location.pathname === item.path ? 'bg-muted font-medium' : 'hover:bg-muted/50'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
              <a href={PORTAL_URL} className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground hover:text-foreground">
                <Layers className="h-4 w-4" /> Portal Travessia
              </a>
              <button onClick={signOut} className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
