import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import ChatPage from "@/pages/ChatPage";
import ReviewAppealsPage from "@/pages/ReviewAppealsPage";
import AuthCallback from "@/pages/AuthCallback";

const queryClient = new QueryClient({
  queryFn: async ({ queryKey }) => {
    // Global error handling for 401
    const context = queryClient.defaultQueryOptions();
    return context.queryFn?.( { queryKey } as any);
  },
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 401 errors
        if (error?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/';
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/';
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/chat/:id" component={ChatPage} />
      <Route path="/review" component={ReviewAppealsPage} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
