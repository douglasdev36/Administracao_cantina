import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Coffee, Search, Clock, User, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/date";
import { api } from "@/integrations/api/client";

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  numero_pasta?: string;
  turma_nome?: string;
  e_bolsista?: boolean;
}

interface LiberacaoLanche {
  id: string;
  aluno_id: string;
  matricula: string;
  numero_pasta?: string;
  nome_aluno: string;
  turma_nome?: string;
  cardapio_nome?: string;
  data_liberacao: string;
  usuario_responsavel: string;
}

type LibHistItem = {
  id: string;
  aluno?: { nome?: string; matricula?: string; numero_pasta?: string };
  turma_nome?: string;
  cardapio_nome?: string;
  data_liberacao: string;
  observacao?: string;
};

type LiberacoesHistoryResponse = { liberacoes: LibHistItem[] };
type BuscarAlunoResponse = { aluno?: { id: string; nome: string; matricula: string; numero_pasta?: string; turma_nome?: string; e_bolsista?: boolean } };

export default function LiberacaoLanche() {
  const [matricula, setMatricula] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [showRecentLunchAlert, setShowRecentLunchAlert] = useState(false);
  const [showNonScholarshipAlert, setShowNonScholarshipAlert] = useState(false);
  const [alunoEncontrado, setAlunoEncontrado] = useState<Aluno | null>(null);
  const [liberacoes, setLiberacoes] = useState<LiberacaoLanche[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingScanTimer = useRef<number | null>(null);
  
  const { toast } = useToast();
  const isBlocked = showAlert || showRecentLunchAlert || showNonScholarshipAlert;

  useEffect(() => {
    fetchLiberacoes();
    return () => {
      if (pendingScanTimer.current) {
        clearTimeout(pendingScanTimer.current);
        pendingScanTimer.current = null;
      }
    };
  }, []);

  const fetchLiberacoes = async () => {
    try {
      const { data, error } = await api.functions.invoke('liberacoes_history', {
        body: { limit: 10 }
      });

      if (error) {
        console.error('Erro ao carregar liberações:', error);
        return;
      }

      const lista = (data as LiberacoesHistoryResponse)?.liberacoes ?? [];
      const liberacoesFormatadas = lista.map((lib) => ({
        id: lib.id as string,
        aluno_id: '',
        matricula: lib.aluno?.matricula ?? '',
        numero_pasta: lib.aluno?.numero_pasta ?? '',
        nome_aluno: lib.aluno?.nome ?? lib.observacao ?? 'Aluno sem cadastro',
        turma_nome: lib.turma_nome ?? '-',
        cardapio_nome: lib.cardapio_nome ?? '-',
        data_liberacao: lib.data_liberacao as string,
        usuario_responsavel: 'Sistema'
      }));

      setLiberacoes(liberacoesFormatadas);
    } catch (error) {
      console.error('Erro ao buscar liberações:', error);
    }
  };

  const buscarAluno = async (codigoInput: string) => {
    try {
      const normalized = String(codigoInput || '').trim().replace(/\D/g, '');
      if (!normalized) return null;
      if (normalized.length !== 12 && normalized.length > 4) return null;
      const codigo = normalized.length === 12 ? normalized : normalized.padStart(4, '0');

      const { data, error } = await api.functions.invoke('buscar_aluno', {
        body: { codigo }
      });

      if (error) {
        console.error('Erro ao buscar aluno:', error);
      } else {
        const aluno = (data as BuscarAlunoResponse)?.aluno;
        if (aluno) {
          return {
            id: aluno.id as string,
            nome: aluno.nome as string,
            matricula: aluno.matricula as string,
            numero_pasta: aluno.numero_pasta ?? undefined,
            turma_nome: aluno.turma_nome ?? 'Sem turma',
            e_bolsista: aluno.e_bolsista ?? false
          } as Aluno;
        }
      }

      if (normalized.length === 12) {
        const { data: alunoRow, error: alunoError } = await api
          .from('alunos')
          .select('id, nome, matricula, numero_pasta, e_bolsista, turmas(nome)')
          .eq('matricula', normalized)
          .limit(1)
          .maybeSingle();

        if (alunoError) {
          console.error('Erro ao buscar aluno por tabela:', alunoError);
          return null;
        }
        if (!alunoRow) return null;
        const turmaNome = (alunoRow as any)?.turmas?.nome ?? 'Sem turma';
        return {
          id: (alunoRow as any).id as string,
          nome: (alunoRow as any).nome as string,
          matricula: (alunoRow as any).matricula as string,
          numero_pasta: (alunoRow as any).numero_pasta ?? undefined,
          turma_nome: turmaNome,
          e_bolsista: Boolean((alunoRow as any).e_bolsista),
        } as Aluno;
      }

      const candidates = Array.from(
        new Set(
          [
            normalized,
            normalized.padStart(4, '0'),
            normalized.replace(/^0+/, ''),
          ].filter((v) => v && v.length > 0 && v.length <= 4)
        )
      );
      const { data: alunoRow, error: alunoError } = await api
        .from('alunos')
        .select('id, nome, matricula, numero_pasta, e_bolsista, turmas(nome)')
        .in('numero_pasta', candidates)
        .limit(1)
        .maybeSingle();

      if (alunoError) {
        console.error('Erro ao buscar aluno por tabela:', alunoError);
        return null;
      }
      if (!alunoRow) return null;
      const turmaNome = (alunoRow as any)?.turmas?.nome ?? 'Sem turma';
      return {
        id: (alunoRow as any).id as string,
        nome: (alunoRow as any).nome as string,
        matricula: (alunoRow as any).matricula as string,
        numero_pasta: (alunoRow as any).numero_pasta ?? undefined,
        turma_nome: turmaNome,
        e_bolsista: Boolean((alunoRow as any).e_bolsista),
      } as Aluno;
    } catch (error) {
      console.error('Erro ao buscar aluno:', error);
      return null;
    }
  };

  const handleLiberarLanche = async (codigoInput: string) => {
    if (showAlert || showRecentLunchAlert || showNonScholarshipAlert) {
      return;
    }
    const normalized = String(codigoInput || '').trim().replace(/\D/g, '');
    if (!normalized) return;
    if (normalized.length !== 12 && normalized.length > 4) return;

    setLoading(true);
    const aluno = await buscarAluno(normalized);
    
    if (aluno) {
      // Aluno encontrado - verificar se já lanchou
      const lanchouRecentemente = await verificarLancheRecente(aluno.id);
      if (lanchouRecentemente) {
        setAlunoEncontrado(aluno);
        setShowRecentLunchAlert(true);
        setLoading(false);
        return;
      }
      
      // Verificar se cardápio ativo é almoço e se aluno não é bolsista
      const { data: cardapioAtivo } = await api
        .from('cardapios')
        .select('id, nome, tipo_refeicao')
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (cardapioAtivo?.tipo_refeicao === 'almoco' && !aluno.e_bolsista) {
        setAlunoEncontrado(aluno);
        setShowNonScholarshipAlert(true);
        setLoading(false);
        return;
      }
      
      // Liberar automaticamente
      await liberarLanche(aluno);
      setMatricula("");
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Aluno não encontrado - mostrar alerta
      setAlunoEncontrado(null);
      setShowAlert(true);
    }
    setLoading(false);
  };

  const verificarLancheRecente = async (alunoId: string): Promise<boolean> => {
    try {
      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data, error } = await api
        .from('liberacoes_lanche')
        .select('id, data_liberacao')
        .eq('aluno_id', alunoId)
        .gte('data_liberacao', umaHoraAtras)
        .order('data_liberacao', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Erro ao verificar lanche recente:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Erro ao verificar lanche recente:', error);
      return false;
    }
  };

  const liberarLanche = async (aluno?: Aluno | null, forcarLiberacao: boolean = false) => {
    try {
      // Pula verificação se está forçando
      if (aluno && !forcarLiberacao) {
        const lanchouRecentemente = await verificarLancheRecente(aluno.id);
        if (lanchouRecentemente) {
          setAlunoEncontrado(aluno);
          setShowRecentLunchAlert(true);
          return;
        }
      }

      // Buscar cardápio ativo
      const { data: cardapioAtivo } = await api
        .from('cardapios')
        .select('nome, tipo_refeicao')
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: { user } } = await api.auth.getUser();
      
      const { error } = await api
        .from('liberacoes_lanche')
        .insert({
          aluno_id: aluno?.id,
          usuario_id: user?.id,
          turma_nome: aluno?.turma_nome,
          cardapio_id: cardapioAtivo?.id,
          cardapio_nome: cardapioAtivo?.nome,
          tipo_refeicao: cardapioAtivo?.tipo_refeicao || 'lanche',
          observacao: aluno ? null : `Código não cadastrado: ${matricula}`
        });

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao registrar liberação de lanche",
          variant: "destructive"
        });
        return;
      }

      setMatricula("");
      setShowAlert(false);
      fetchLiberacoes();

      // Retornar foco ao campo de entrada
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      toast({
        title: "Lanche Liberado!",
        description: aluno 
          ? `Lanche liberado para ${aluno.nome}` 
          : "Lanche liberado para aluno sem cadastro",
        variant: "default"
      });
    } catch (error) {
      console.error('Erro ao liberar lanche:', error);
      toast({
        title: "Erro",
        description: "Erro ao liberar lanche",
        variant: "destructive"
      });
    }
  };

  const formatarDataHora = (data: string | Date) => {
    return formatDateTime(data);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Liberação de Lanche</h2>
        <p className="text-muted-foreground">
          Digite a matrícula do aluno para liberar o lanche
        </p>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-primary" />
            Liberar Lanche
          </CardTitle>
          <CardDescription>
            Informe a matrícula do aluno (12 dígitos)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex gap-4">
            <div className="flex-1">
              <Input
                ref={inputRef}
                placeholder="Matrícula (12 dígitos) ou Nº Pasta (4 dígitos)"
                value={matricula}
                onChange={(e) => {
                  if (isBlocked) return;
                  const newMatricula = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setMatricula(newMatricula);
                  if (pendingScanTimer.current) {
                    clearTimeout(pendingScanTimer.current);
                    pendingScanTimer.current = null;
                  }
                  if (newMatricula.length === 12) {
                    handleLiberarLanche(newMatricula);
                    return;
                  }
                  if (newMatricula.length === 4) {
                    pendingScanTimer.current = window.setTimeout(() => {
                      pendingScanTimer.current = null;
                      handleLiberarLanche(newMatricula);
                    }, 200);
                  }
                }}
                maxLength={12}
                className="text-lg font-mono"
                disabled={loading || isBlocked}
                autoFocus
              />
              <p className="text-sm text-muted-foreground mt-1">
                {matricula.length} dígito(s) - Digite 12 (matrícula) ou 4 (pasta) - Liberação automática
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Histórico de Lanches Liberados
          </CardTitle>
          <CardDescription>
            Últimos 10 registros de liberação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {liberacoes.map((liberacao) => (
                <div key={liberacao.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{liberacao.nome_aluno}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Mat: {liberacao.matricula || liberacao.numero_pasta || 'Sem cadastro'}
                        </span>
                        <span>Turma: {liberacao.turma_nome}</span>
                        <span>{formatarDataHora(liberacao.data_liberacao)}</span>
                        <span>Cardápio: {liberacao.cardapio_nome}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-success-muted text-success">
                    Liberado
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog open={showAlert} onOpenChange={(open) => { if (open) setShowAlert(true); }}>
        <AlertDialogContent 
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          onKeyDown={(e) => e.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Aluno não encontrado no sistema</AlertDialogTitle>
            <AlertDialogDescription>
              O código <strong>{matricula}</strong> não foi encontrado no sistema. 
              Deseja liberar o lanche mesmo assim? O registro será salvo como "Aluno sem cadastro".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowAlert(false);
              setMatricula("");
              setTimeout(() => inputRef.current?.focus(), 100);
            }}>
              Não
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                liberarLanche();
                setMatricula("");
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="bg-primary hover:bg-primary-hover"
            >
              Sim, liberar lanche
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRecentLunchAlert} onOpenChange={(open) => { if (open) setShowRecentLunchAlert(true); }}>
        <AlertDialogContent 
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          onKeyDown={(e) => e.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>O aluno já lanchou na última hora</AlertDialogTitle>
            <AlertDialogDescription>
              O aluno <strong>{alunoEncontrado?.nome}</strong> já recebeu lanche na última hora.
              Deseja liberar o lanche mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowRecentLunchAlert(false);
              setMatricula("");
              setTimeout(() => inputRef.current?.focus(), 100);
            }}>
              Não
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                setShowRecentLunchAlert(false);
                await liberarLanche(alunoEncontrado, true);
                setMatricula("");
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="bg-primary hover:bg-primary-hover"
            >
              Sim, liberar lanche
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showNonScholarshipAlert} onOpenChange={(open) => { if (open) setShowNonScholarshipAlert(true); }}>
        <AlertDialogContent 
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          onKeyDown={(e) => e.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Este aluno não é bolsista</AlertDialogTitle>
            <AlertDialogDescription>
              O aluno <strong>{alunoEncontrado?.nome}</strong> não está marcado como bolsista.
              Deseja liberar o almoço mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowNonScholarshipAlert(false);
              setMatricula("");
              setTimeout(() => inputRef.current?.focus(), 100);
            }}>
              Não
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                setShowNonScholarshipAlert(false);
                await liberarLanche(alunoEncontrado, true);
                setMatricula("");
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="bg-primary hover:bg-primary-hover"
            >
              Sim, liberar almoço
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
