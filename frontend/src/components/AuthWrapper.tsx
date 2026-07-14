import React, { useState, useEffect } from 'react';
import { getUser as getLocalUser, meLocal, AUTH_EVENT } from "@/integrations/localAuth";
import Login from "@/pages/Login";

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper = ({ children }: AuthWrapperProps) => {
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLocalSession = async () => {
      const localUser = getLocalUser();
      if (!localUser) {
        setHasSession(false);
        setLoading(false);
        return;
      }

      setHasSession(true);
      setLoading(false);

      const verified = await meLocal();
      if (!verified) {
        setHasSession(false);
      }
    };

    checkLocalSession();

    const handler = () => { checkLocalSession(); };
    window.addEventListener(AUTH_EVENT, handler);
    return () => {
      window.removeEventListener(AUTH_EVENT, handler);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasSession) {
    return <Login />;
  }

  return <>{children}</>;
};

export default AuthWrapper;
