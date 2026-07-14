import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import AuthWrapper from "@/components/AuthWrapper";
import Dashboard from "./pages/Dashboard";
import LiberacaoLanche from "./pages/LiberacaoLanche";
import Almoxarifado from "./pages/Almoxarifado";
import Cardapio from "./pages/Cardapio";
import Alunos from "./pages/Alunos";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthWrapper>
          <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/liberacao-lanche" element={<LiberacaoLanche />} />
            <Route path="/almoxarifado" element={<Almoxarifado />} />
            <Route path="/cardapio" element={<Cardapio />} />
            <Route path="/alunos" element={<Alunos />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/auth" element={<Login />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </AuthWrapper>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
