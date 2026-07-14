import { useState, useEffect } from 'react';
import { getUser as getLocalUser, AUTH_EVENT } from '@/integrations/localAuth';

export type UserRole = 'user' | 'admin_normal' | 'super_admin';

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUserRole = async () => {
      try {
        const localUser = getLocalUser();
        if (localUser?.role) {
          setRole(localUser.role);
        } else if (localUser) {
          setRole('user');
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error('Erro ao verificar role:', error);
      } finally {
        setLoading(false);
      }
    };

    getUserRole();

    const handler = () => getUserRole();
    window.addEventListener(AUTH_EVENT, handler);
    return () => window.removeEventListener(AUTH_EVENT, handler);
  }, []);

  const isAdmin = role === 'admin_normal' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';

  return {
    role,
    loading,
    isAdmin,
    isSuperAdmin
  };
}
