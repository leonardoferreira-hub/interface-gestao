import { Suspense, lazy, type ComponentType } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme-provider";
import ErrorBoundary from "@/components/ErrorBoundary";

function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string
) {
  return lazy(async () => {
    const storageKey = `lazy-retry-${key}`;
    try {
      const mod = await importer();
      sessionStorage.setItem(storageKey, '0');
      return mod;
    } catch (error: any) {
      const msg = String(error?.message || '');
      const isChunkError = msg.includes('Failed to fetch dynamically imported module') || msg.includes('Loading chunk');
      const alreadyRetried = sessionStorage.getItem(storageKey) === '1';
      if (isChunkError && !alreadyRetried) {
        sessionStorage.setItem(storageKey, '1');
        window.location.reload();
      }
      throw error;
    }
  });
}

const MinhasPendencias = lazyWithRetry(() => import("./pages/MinhasPendencias"), 'pendencias');
const Rotinas = lazyWithRetry(() => import("./pages/Rotinas"), 'rotinas');
const KPIs = lazyWithRetry(() => import("./pages/KPIs"), 'kpis');
const Equipe = lazyWithRetry(() => import("./pages/Equipe"), 'equipe');
const Login = lazyWithRetry(() => import("./pages/Login"), 'login');

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="space-y-4 w-full max-w-md px-4">
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
);

function AppRoutes() {
  const { session, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!session) return <Login />;
  return (
    <Routes>
      <Route path="/" element={<MinhasPendencias />} />
      <Route path="/rotinas" element={<Rotinas />} />
      <Route path="/kpis" element={<KPIs />} />
      <Route path="/equipe" element={<Equipe />} />
      <Route path="*" element={<MinhasPendencias />} />
    </Routes>
  );
}

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="gestao-theme">
        <AuthProvider>
          <TooltipProvider>
            <Sonner />
            <BrowserRouter>
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <AppRoutes />
                </Suspense>
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
