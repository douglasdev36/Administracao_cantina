import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { loginLocal, getUser as getLocalUser, AUTH_EVENT } from "@/integrations/localAuth";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const check = () => {
      const u = getLocalUser();
      if (u) navigate('/');
    };
    check();
    window.addEventListener(AUTH_EVENT, check);
    return () => window.removeEventListener(AUTH_EVENT, check);
  }, [navigate]);

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      await loginLocal(email, password);
      toast({ title: "Login realizado com sucesso!", description: "Redirecionando..." });
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const LoginForm = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const onSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleLogin(email, password);
    };

    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">E-mail</Label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Senha</Label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    );
  };

  return (
    <div className="theme-force-light min-h-screen flex items-center justify-center p-4 relative overflow-hidden" 
         style={{ background: 'linear-gradient(135deg, hsl(151 40% 92%) 0%, hsl(151 30% 95%) 50%, hsl(151 25% 97%) 100%)' }}>
      
      {/* Elementos decorativos de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-20" 
             style={{ background: 'radial-gradient(circle, hsl(151 55% 53% / 0.3) 0%, transparent 70%)' }}></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-15"
             style={{ background: 'radial-gradient(circle, hsl(151 55% 53% / 0.2) 0%, transparent 70%)' }}></div>
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary/30 rounded-full"></div>
        <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-primary/40 rounded-full"></div>
        <div className="absolute top-1/2 right-1/3 w-1.5 h-1.5 bg-primary/20 rounded-full"></div>
      </div>

      <Card className="w-full max-w-md shadow-large relative z-10 backdrop-blur-sm bg-card/95 border-border/50">
        <CardHeader className="space-y-4 text-center pb-6">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, hsl(151 55% 53%), hsl(151 55% 48%))' }}>
            <span className="text-2xl font-bold text-primary-foreground">CF</span>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold text-foreground mb-2">Cantina Fácil</CardTitle>
            <CardDescription className="text-muted-foreground text-base">
              Sistema de gestão escolar
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <LoginForm />
          <div className="text-center text-sm text-muted-foreground">
            Entre em contato com o administrador para obter acesso
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
