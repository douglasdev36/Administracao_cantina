import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coffee, Users, Package, TrendingUp, TrendingDown, FileText } from "lucide-react";
import RelatoriosModal from "@/components/RelatoriosModal";
import RelatorioLanchesModal from "@/components/RelatorioLanchesModal";
import { api } from "@/integrations/api/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime } from "@/lib/date";
import { useUserRole } from "@/hooks/useUserRole";

export default function Dashboard() {
  const { isAdmin, isSuperAdmin } = useUserRole();
  const [relatoriosModalAberto, setRelatoriosModalAberto] = useState(false);
  const [relatorioLanchesAberto, setRelatorioLanchesAberto] = useState(false);
  const [stats, setStats] = useState({
    liberacoesHoje: 0,
    alunosCadastrados: 0,
    itensEstoque: 0,
    cardapiosAtivos: 0
  });
  const [movimentacoes, setMovimentacoes] = useState({
    entradas: 0,
    saidas: 0
  });
  type MovimentacaoComProduto = { produto_id: string; tipo: string; quantidade: number; created_at: string; produtos?: { nome?: string; unidade?: string } };
  type LiberacaoComAluno = { id: string; data_liberacao: string; alunos?: { nome?: string } | null; observacao?: string | null; cardapio_nome?: string | null };
  type LanchesPorDiaItem = { dia: string; total: number };
  const [ultimasMovimentacoes, setUltimasMovimentacoes] = useState<MovimentacaoComProduto[]>([]);
  const [lanchesPorDia, setLanchesPorDia] = useState<LanchesPorDiaItem[]>([]);
  const [ultimasLiberacoes, setUltimasLiberacoes] = useState<LiberacaoComAluno[]>([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const { count: liberacoesCount } = await api
        .from('liberacoes_lanche')
        .select('*', { count: 'exact', head: true })
        .gte('data_liberacao', hoje.toISOString());

      const { count: alunosCount } = await api
        .from('alunos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo');

      const { count: produtosCount } = await api
        .from('produtos')
        .select('*', { count: 'exact', head: true });

      const { count: cardapiosCount } = await api
        .from('cardapios')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);

      const inicioSemana = new Date();
      inicioSemana.setDate(inicioSemana.getDate() - 7);
      const { data: movimentacoesData } = await api
        .from('movimentacoes_estoque')
        .select('tipo, quantidade')
        .gte('created_at', inicioSemana.toISOString());

      const entradas = movimentacoesData?.filter(m => m.tipo === 'entrada').length || 0;
      const saidas = movimentacoesData?.filter(m => m.tipo === 'saida').length || 0;

      const { data: ultimasMovs } = await api
        .from('movimentacoes_estoque')
        .select('*, produtos(nome, unidade)')
        .order('created_at', { ascending: false })
        .limit(10);

      const inicioSemanaGrafico = new Date();
      inicioSemanaGrafico.setDate(inicioSemanaGrafico.getDate() - 6);
      inicioSemanaGrafico.setHours(0, 0, 0, 0);
      const { data: liberacoesDataRaw } = await api
        .from('liberacoes_lanche')
        .select('data_liberacao')
        .gte('data_liberacao', inicioSemanaGrafico.toISOString());
      const liberacoesData = (liberacoesDataRaw || []) as Array<{ data_liberacao: string }>;

      const lanchesPorDiaMap: Record<string, { total: number; data: Date }> = {};
      liberacoesData?.forEach((lib) => {
        const dia = new Date(lib.data_liberacao);
        const diaFormatado = dia.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
        if (!lanchesPorDiaMap[diaFormatado]) {
          lanchesPorDiaMap[diaFormatado] = { total: 0, data: dia };
        }
        lanchesPorDiaMap[diaFormatado].total++;
      });

      const dadosGrafico: LanchesPorDiaItem[] = [];
      for (let i = 6; i >= 0; i--) {
        const dia = new Date();
        dia.setDate(dia.getDate() - i);
        const diaSemana = dia.getDay();
        const diaFormatado = dia.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
        if (diaSemana === 0) continue;
        const total = lanchesPorDiaMap[diaFormatado]?.total || 0;
        if (diaSemana === 6 && total === 0) continue;
        dadosGrafico.push({ dia: diaFormatado, total });
      }

      const { data: ultimasLibs } = await api
        .from('liberacoes_lanche')
        .select('*, alunos(nome)')
        .order('data_liberacao', { ascending: false })
        .limit(5);

      setStats({
        liberacoesHoje: liberacoesCount || 0,
        alunosCadastrados: alunosCount || 0,
        itensEstoque: produtosCount || 0,
        cardapiosAtivos: cardapiosCount || 0,
      });
      setMovimentacoes({ entradas, saidas });
      const list = (ultimasMovs || []) as MovimentacaoComProduto[];
      const seen = new Set<string>();
      const dedup = list.filter((m) => {
        const key = `${m.produto_id}|${m.tipo}|${m.quantidade}|${m.created_at}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setUltimasMovimentacoes(dedup);
      setLanchesPorDia(dadosGrafico);
      setUltimasLiberacoes(ultimasLibs || []);
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);


  const statsDisplay = [
    {
      title: "Lanches Distribuídos Hoje",
      value: stats.liberacoesHoje.toString(),
      description: "Liberações de hoje",
      icon: Coffee,
      color: "text-primary"
    },
    {
      title: "Alunos Cadastrados",
      value: stats.alunosCadastrados.toString(),
      description: "Total de alunos ativos",
      icon: Users,
      color: "text-success"
    },
    {
      title: "Itens no Estoque",
      value: stats.itensEstoque.toString(),
      description: "Produtos disponíveis",
      icon: Package,
      color: "text-warning"
    },
    {
      title: "Cardápios Ativos",
      value: stats.cardapiosAtivos.toString(),
      description: "Cardápios ativos no momento",
      icon: TrendingUp,
      color: "text-primary"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
          <p className="text-muted-foreground">
            Visão geral da cantina escolar
          </p>
        </div>
        {(isAdmin || isSuperAdmin) && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRelatorioLanchesAberto(true)} className="gap-2">
              <Coffee className="h-4 w-4" />
              Relatório do Dia
            </Button>
            <Button onClick={() => setRelatoriosModalAberto(true)} className="gap-2">
              <FileText className="h-4 w-4" />
              Outros Relatórios
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsDisplay.map((stat, index) => (
          <Card key={index} className="shadow-soft hover:shadow-medium transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-soft">
          <CardHeader>
            <CardTitle>Distribuição de Lanches - Última Semana</CardTitle>
            <CardDescription>
              Total de lanches distribuídos por dia
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {lanchesPorDia.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={lanchesPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-3 shadow-soft">
          <CardHeader>
            <CardTitle>Últimas Liberações</CardTitle>
            <CardDescription>
              Registros recentes de distribuição
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ultimasLiberacoes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma liberação recente
                </p>
              ) : (
                ultimasLiberacoes.map((lib) => (
                  <div key={lib.id} className="flex items-center justify-between py-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <Coffee className="h-4 w-4 text-primary" />
                      <div>
                        <span className="text-sm font-medium">{lib.alunos?.nome || 'Aluno'}</span>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(lib.data_liberacao)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Nova seção - Movimento do Almoxarifado */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Movimento do Almoxarifado - Esta Semana
          </CardTitle>
          <CardDescription>
            Resumo das movimentações de entrada e saída de produtos nos últimos 7 dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card className="bg-success/10 border-success/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-success">{movimentacoes.entradas}</div>
                    <p className="text-xs text-muted-foreground mt-1">Entradas</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-success opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Movimentações de entrada no estoque
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-destructive">{movimentacoes.saidas}</div>
                    <p className="text-xs text-muted-foreground mt-1">Saídas</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-destructive opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Movimentações de saída do estoque
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {movimentacoes.entradas - movimentacoes.saidas > 0 ? '+' : ''}
                      {movimentacoes.entradas - movimentacoes.saidas}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Saldo</p>
                  </div>
                  <Package className="h-8 w-8 text-primary opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Diferença entre entradas e saídas
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <span>Últimas Movimentações de Produtos</span>
              <span className="text-xs text-muted-foreground font-normal">
                (Mostrando até 10 registros)
              </span>
            </h4>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {ultimasMovimentacoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma movimentação registrada esta semana
                  </p>
                ) : (
                  ultimasMovimentacoes.map((mov) => (
                    <div 
                      key={mov.id} 
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {mov.tipo === 'entrada' ? (
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-success/20">
                            <TrendingUp className="h-4 w-4 text-success" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-destructive/20">
                            <TrendingDown className="h-4 w-4 text-destructive" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {mov.produtos?.nome || 'Produto'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {mov.tipo === 'entrada' ? 'Entrada no estoque' : 'Saída do estoque'} • {formatDateTime(mov.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <span className={`text-sm font-bold ${mov.tipo === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                          {mov.tipo === 'entrada' ? '+' : '-'}{mov.quantidade}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {mov.produtos?.unidade || 'un'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <RelatoriosModal 
        open={relatoriosModalAberto} 
        onOpenChange={setRelatoriosModalAberto} 
      />
      
      <RelatorioLanchesModal
        open={relatorioLanchesAberto}
        onOpenChange={setRelatorioLanchesAberto}
      />
    </div>
  );
}
