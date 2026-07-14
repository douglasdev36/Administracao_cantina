import { 
  Home, 
  Coffee, 
  Package, 
  Calendar, 
  Users, 
  Settings, 
  LogOut,
  ChefHat 
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { clearSession } from "@/integrations/localAuth";

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Liberação de Lanche", url: "/liberacao-lanche", icon: Coffee },
  { title: "Almoxarifado", url: "/almoxarifado", icon: Package },
  { title: "Cardápio", url: "/cardapio", icon: ChefHat },
  { title: "Cadastro de Alunos", url: "/alunos", icon: Users },
];

const adminItems = [
  { title: "Administração", url: "/admin", icon: Settings, requireSuperAdmin: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";
  const { role, isAdmin, isSuperAdmin } = useUserRole();

  const isActive = (path: string) => currentPath === path;
  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-primary text-primary-foreground hover:bg-primary-hover" 
      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  // Filtrar itens do menu baseado nas permissões
  const getVisibleMenuItems = () => {
    if (role === 'user') {
      // Usuário comum: Dashboard, Liberação de lanche e Alunos (leitura)
      return menuItems.filter(item => 
        item.url === '/' || 
        item.url === '/liberacao-lanche' || 
        item.url === '/alunos'
      );
    }
    // Admin Normal e Super Admin: todos os itens do menu principal
    if (role === 'admin_normal' || role === 'super_admin') {
      return menuItems;
    }
    // Fallback: Dashboard, Liberação e Alunos
    return menuItems.filter(item => 
      item.url === '/' || 
      item.url === '/liberacao-lanche' || 
      item.url === '/alunos'
    );
  };

  const visibleMenuItems = getVisibleMenuItems();

  const handleLogout = async () => {
    clearSession();
    navigate('/');
  };

  return (
    <Sidebar className={isCollapsed ? "w-16" : "w-64"} collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
            <Coffee className="h-4 w-4 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="text-lg font-semibold text-sidebar-foreground">
                Cantina Fácil
              </h2>
              <p className="text-xs text-sidebar-foreground/60">
                Sistema de Administração
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClass}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavClass}>
                        <item.icon className="h-4 w-4" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleLogout}
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
