import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { clearSession } from "@/integrations/localAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { ThemeToggle } from "@/components/ThemeToggle";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isSuperAdmin } = useUserRole();

  const handleLogout = async () => {
    try {
      clearSession();
      navigate('/');
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao fazer logout",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-gradient-soft">
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4">
              <div className="flex-1">
                <h1 className="text-sm font-medium text-foreground/60">
                  Sistema de Administração de Cantina Escolar
                </h1>
              </div>
              <nav className="flex items-center gap-1">
                <NavLink 
                  to="/" 
                  className={({ isActive }) => 
                    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink 
                  to="/liberacao-lanche" 
                  className={({ isActive }) => 
                    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`
                  }
                >
                  Liberação
                </NavLink>
                <NavLink 
                  to="/almoxarifado" 
                  className={({ isActive }) => 
                    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`
                  }
                >
                  Almoxarifado
                </NavLink>
                <NavLink 
                  to="/cardapio" 
                  className={({ isActive }) => 
                    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`
                  }
                >
                  Cardápio
                </NavLink>
                <NavLink 
                  to="/alunos" 
                  className={({ isActive }) => 
                    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`
                  }
                >
                  Alunos
                </NavLink>
                {isSuperAdmin && (
                  <NavLink 
                    to="/admin" 
                    className={({ isActive }) => 
                      `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-accent hover:text-accent-foreground'
                      }`
                    }
                  >
                    Admin
                  </NavLink>
                )}
                <ThemeToggle />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout}
                  className="ml-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-destructive hover:text-destructive-foreground"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Sair
                </Button>
              </nav>
            </div>
          </header>
          
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
    </div>
  );
}
