import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Download, FileText, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { api } from "@/integrations/api/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface RelatoriosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LancheDistribuido {
  id: string;
  aluno: string;
  matricula: string;
  data: Date;
  turma: string;
  lanche: string;
}

type TipoRelatorio = "diario" | "semanal" | "mensal" | "trimestral" | "semestral" | "anual" | "personalizado";

export default function RelatoriosModal({ open, onOpenChange }: RelatoriosModalProps) {
  const { toast } = useToast();
  const { isSuperAdmin } = useUserRole();
  const [tipoRelatorio, setTipoRelatorio] = useState<TipoRelatorio>("diario");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const maskDateInput = (s: string) => {
    const d = s.replace(/\D/g, '').slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  };
  type Agrupamento = Record<string, unknown>;
  type RelatorioGerado = {
    tipo: TipoRelatorio;
    periodo: string;
    dados: LancheDistribuido[];
    agrupamento: Agrupamento;
    total: number;
  };
  const [relatorioGerado, setRelatorioGerado] = useState<RelatorioGerado | null>(null);
  const [loading, setLoading] = useState(false);

  const formatarData = (data: Date) => {
    return data.toLocaleDateString('pt-BR');
  };

  const obterPeriodoTexto = (tipo: TipoRelatorio) => {
    const hoje = new Date();
    const inicioTrimestre = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
    const inicioSemestre = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
    const opcoes = {
      diario: `Dia ${formatarData(hoje)}`,
      semanal: `Semana de ${formatarData(new Date(hoje.getTime() - 6 * 86400000))} a ${formatarData(hoje)}`,
      mensal: `Mês de ${hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
      trimestral: `Trimestre - ${formatarData(inicioTrimestre)} a ${formatarData(hoje)}`,
      semestral: `Semestre - ${formatarData(inicioSemestre)} a ${formatarData(hoje)}`,
      anual: `Ano ${hoje.getFullYear()}`,
      personalizado: dataInicio && dataFim ? `${formatarData(new Date(dataInicio))} a ${formatarData(new Date(dataFim))}` : "Período personalizado"
    };
    return opcoes[tipo];
  };

  const buscarLanchesDistribuidos = async (dataInicioFiltro: Date, dataFimFiltro: Date): Promise<LancheDistribuido[]> => {
    try {
      const { data, error } = await api
        .from("liberacoes_lanche")
        .select(`
          id,
          data_liberacao,
          cardapio_nome,
          tipo_refeicao,
          turma_nome,
          alunos (
            nome,
            matricula,
            numero_pasta
          )
        `)
        .gte("data_liberacao", dataInicioFiltro.toISOString())
        .lte("data_liberacao", dataFimFiltro.toISOString())
        .order("data_liberacao", { ascending: false });

      if (error) {
        console.error("Erro ao buscar liberações:", error);
        return [];
      }

      type LiberacaoRow = {
        id: string;
        data_liberacao: string;
        cardapio_nome?: string | null;
        tipo_refeicao?: string | null;
        turma_nome?: string | null;
        alunos?: { nome?: string | null; matricula?: string | null; numero_pasta?: string | null };
      };
      return (data || []).map((item: LiberacaoRow) => ({
        id: item.id,
        aluno: item.alunos?.nome || "Aluno sem cadastro",
        matricula: item.alunos?.matricula || item.alunos?.numero_pasta || "Sem matrícula",
        data: new Date(item.data_liberacao),
        turma: item.turma_nome || "Sem turma",
        lanche: `${item.cardapio_nome || "Sem cardápio"} (${item.tipo_refeicao === 'almoco' ? 'Almoço' : 'Lanche'})`
      }));
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      return [];
    }
  };

  const obterPeriodoFiltro = (tipo: TipoRelatorio): { dataInicio: Date; dataFim: Date } | null => {
    const hoje = new Date();
    let dataInicioFiltro: Date;
    let dataFimFiltro: Date = new Date(hoje);

    switch (tipo) {
      case "diario":
        dataInicioFiltro = new Date(hoje);
        dataInicioFiltro.setHours(0, 0, 0, 0);
        dataFimFiltro.setHours(23, 59, 59, 999);
        break;
      case "semanal":
        dataInicioFiltro = new Date(hoje.getTime() - 6 * 86400000);
        dataInicioFiltro.setHours(0, 0, 0, 0);
        dataFimFiltro.setHours(23, 59, 59, 999);
        break;
      case "mensal":
        dataInicioFiltro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataInicioFiltro.setHours(0, 0, 0, 0);
        dataFimFiltro.setHours(23, 59, 59, 999);
        break;
      case "trimestral":
        // Últimos 3 meses incluindo o atual
        dataInicioFiltro = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
        dataInicioFiltro.setHours(0, 0, 0, 0);
        dataFimFiltro.setHours(23, 59, 59, 999);
        break;
      case "semestral":
        // Últimos 6 meses incluindo o atual
        dataInicioFiltro = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
        dataInicioFiltro.setHours(0, 0, 0, 0);
        dataFimFiltro.setHours(23, 59, 59, 999);
        break;
      case "anual":
        dataInicioFiltro = new Date(hoje.getFullYear(), 0, 1);
        dataInicioFiltro.setHours(0, 0, 0, 0);
        dataFimFiltro.setHours(23, 59, 59, 999);
        break;
      case "personalizado":
        if (!dataInicio || !dataFim) return null;
        {
          const parseDateInput = (s: string) => {
            if (!s) return new Date(NaN);
            if (s.includes('/')) {
              const [d, m, y] = s.split('/').map((v) => Number(v));
              return new Date(y, (m || 1) - 1, d || 1);
            }
            if (s.includes('-')) {
              const [y, m, d] = s.split('-').map((v) => Number(v));
              return new Date(y, (m || 1) - 1, d || 1);
            }
            return new Date(s);
          };
          dataInicioFiltro = parseDateInput(dataInicio);
          dataInicioFiltro.setHours(0, 0, 0, 0);
          dataFimFiltro = parseDateInput(dataFim);
          dataFimFiltro.setHours(23, 59, 59, 999);
        }
        break;
      default:
        return null;
    }

    return { dataInicio: dataInicioFiltro, dataFim: dataFimFiltro };
  };

  const gerarRelatorio = async () => {
    if (tipoRelatorio === "personalizado" && (!dataInicio || !dataFim)) {
      toast({
        title: "Erro",
        description: "Por favor, selecione as datas de início e fim para o relatório personalizado.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const periodo = obterPeriodoFiltro(tipoRelatorio);
    if (!periodo) {
      setLoading(false);
      return;
    }

    const dadosFiltrados = await buscarLanchesDistribuidos(periodo.dataInicio, periodo.dataFim);
    
    // Agrupar dados por diferentes critérios baseado no tipo
    let agrupamento: Agrupamento = {};
    
    if (tipoRelatorio === "diario") {
      agrupamento = {
        total: dadosFiltrados.length,
        porTurma: dadosFiltrados.reduce((acc, lanche) => {
          acc[lanche.turma] = (acc[lanche.turma] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        porLanche: dadosFiltrados.reduce((acc, lanche) => {
          acc[lanche.lanche] = (acc[lanche.lanche] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
    } else if (tipoRelatorio === "semanal" || tipoRelatorio === "mensal") {
      // Agrupar por dia
      agrupamento = dadosFiltrados.reduce((acc, lanche) => {
        const dia = formatarData(lanche.data);
        if (!acc[dia]) acc[dia] = [];
        acc[dia].push(lanche);
        return acc;
      }, {} as Record<string, LancheDistribuido[]>);
    } else {
      // Para trimestral, semestral, anual - agrupar por mês
      agrupamento = dadosFiltrados.reduce((acc, lanche) => {
        const mes = lanche.data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const tipoRefeicao = lanche.lanche.includes('Almoço') ? 'almoco' : 'lanche';
        
        if (!acc[mes]) {
          acc[mes] = { lanche: 0, almoco: 0 };
        }
        acc[mes][tipoRefeicao]++;
        
        return acc;
      }, {} as Record<string, { lanche: number; almoco: number }>);
    }

    setRelatorioGerado({
      tipo: tipoRelatorio,
      periodo: obterPeriodoTexto(tipoRelatorio),
      dados: dadosFiltrados,
      agrupamento,
      total: dadosFiltrados.length
    });

    setLoading(false);

    if (dadosFiltrados.length === 0) {
      toast({
        title: "Nenhum dado encontrado",
        description: "Nenhum dado encontrado para o período selecionado.",
        variant: "default",
      });
    } else {
      toast({
        title: "Relatório gerado",
        description: `Relatório ${tipoRelatorio} gerado com sucesso! ${dadosFiltrados.length} registros encontrados.`,
      });
    }
  };

  const exportarRelatorio = () => {
    if (!relatorioGerado) return;

    const doc = new jsPDF();
    const dataAtual = new Date().toLocaleDateString("pt-BR");

    // Título
    doc.setFontSize(16);
    doc.text(`Relatório - ${relatorioGerado.periodo}`, 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Total de ${relatorioGerado.total} lanches distribuídos`, 14, 28);
    doc.text(`Gerado em: ${dataAtual}`, 14, 34);

    let yPosition = 45;

    // Resumo
    doc.setFontSize(12);
    doc.text("Resumo Geral", 14, yPosition);
    yPosition += 8;

    const resumoData = [
      ["Total de Lanches", relatorioGerado.total],
      [
        tipoRelatorio === "diario" ? "Turmas Atendidas" : "Períodos com Distribuição",
        Object.keys(relatorioGerado.agrupamento).length
      ],
      [
        "Média por Período",
        Math.round(relatorioGerado.total / Math.max(Object.keys(relatorioGerado.agrupamento).length, 1))
      ]
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [["Métrica", "Valor"]],
      body: resumoData,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
    });

    {
      const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPosition;
      yPosition = lastY + 10;
    }

    // Detalhamento
    doc.setFontSize(12);
    doc.text(`Detalhamento por ${tipoRelatorio === "diario" ? "Turma" : "Período"}`, 14, yPosition);
    yPosition += 8;

    const detalhamentoData = Object.entries(relatorioGerado.agrupamento).map(([chave, valor]) => [
      chave,
      Array.isArray(valor) ? valor.length : String(valor)
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [[tipoRelatorio === "diario" ? "Turma/Cardápio" : "Período", "Quantidade"]],
      body: detalhamentoData,
      theme: "striped",
      headStyles: { fillColor: [52, 152, 219] },
    });

    {
      const lastY2 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPosition;
      yPosition = lastY2 + 10;
    }

    // Distribuições Registradas
    if (relatorioGerado.dados.length > 0) {
      doc.setFontSize(12);
      doc.text("Distribuições Registradas", 14, yPosition);
      yPosition += 8;

      const distribuicoesData = relatorioGerado.dados.map((lanche: LancheDistribuido) => [
        lanche.aluno,
        `${lanche.turma} • ${lanche.matricula}`,
        lanche.lanche,
        formatarData(lanche.data)
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [["Aluno", "Turma/Matrícula", "Cardápio", "Data"]],
        body: distribuicoesData,
        theme: "grid",
        headStyles: { fillColor: [46, 204, 113] },
        styles: { fontSize: 8 },
      });
    }

    // Salvar PDF
    const nomeArquivo = `relatorio_cantina_${dataAtual.replace(/\//g, "-")}.pdf`;
    doc.save(nomeArquivo);

    toast({
      title: "Relatório exportado",
      description: `O relatório foi exportado como ${nomeArquivo}`,
    });
  };

  // Remover verificação - admin_normal também pode acessar

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Relatórios de Distribuição de Lanches
          </DialogTitle>
          <DialogDescription>
            Gere relatórios detalhados sobre a distribuição de lanches por diferentes períodos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Configuração do Relatório */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configurar Relatório</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de Relatório</Label>
                  <select
                    id="tipo"
                    value={tipoRelatorio}
                    onChange={(e) => setTipoRelatorio(e.target.value as TipoRelatorio)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="diario">Diário</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                    <option value="personalizado">Período Personalizado</option>
                  </select>
                </div>
                
                {tipoRelatorio === "personalizado" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="dataInicio">Data de Início</Label>
                      <Input
                        id="dataInicio"
                        type="text"
                        inputMode="numeric"
                        placeholder="dd/mm/yyyy"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(maskDateInput(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dataFim">Data de Fim</Label>
                      <Input
                        id="dataFim"
                        type="text"
                        inputMode="numeric"
                        placeholder="dd/mm/yyyy"
                        value={dataFim}
                        onChange={(e) => setDataFim(maskDateInput(e.target.value))}
                      />
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button onClick={gerarRelatorio} className="gap-2" disabled={loading}>
                  <TrendingUp className="h-4 w-4" />
                  {loading ? "Gerando..." : "Gerar Relatório"}
                </Button>
                {relatorioGerado && (
                  <Button variant="outline" onClick={exportarRelatorio} className="gap-2">
                    <Download className="h-4 w-4" />
                    Exportar PDF
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resultado do Relatório */}
          {relatorioGerado && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Relatório - {relatorioGerado.periodo}
                </CardTitle>
                <CardDescription>
                  {relatorioGerado.total > 0 
                    ? `Total de ${relatorioGerado.total} lanches distribuídos` 
                    : "Nenhum dado encontrado para o período selecionado"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {relatorioGerado.total === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum dado encontrado para o período selecionado.</p>
                  </div>
                ) : (
                  <>
                {/* Resumo Geral */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="bg-primary-muted">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-foreground">{relatorioGerado.total}</div>
                      <p className="text-sm text-muted-foreground">Total de Lanches</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-success-muted">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-foreground">
                        {tipoRelatorio === "diario"
                          ? Object.keys(((relatorioGerado.agrupamento as Record<string, unknown>).porTurma as Record<string, number>) || {}).length
                          : Object.keys(relatorioGerado.agrupamento).length}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {tipoRelatorio === "diario" ? "Turmas Atendidas" : "Períodos com Distribuição"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-warning-muted">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-foreground">
                        {Math.round(
                          relatorioGerado.total /
                          Math.max(
                            tipoRelatorio === "diario"
                              ? Object.keys(((relatorioGerado.agrupamento as Record<string, unknown>).porTurma as Record<string, number>) || {}).length
                              : Object.keys(relatorioGerado.agrupamento).length,
                            1
                          )
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Média por Período</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Detalhamento */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Detalhamento por {tipoRelatorio === "diario" ? "Turma" : "Período"}</h4>
                  <div className="grid gap-2">
                    {tipoRelatorio === "diario" ? (
                      <>
                        <div className="font-medium text-foreground">Por Turma</div>
                        {Object.entries(((relatorioGerado.agrupamento as Record<string, unknown>).porTurma as Record<string, number>) || {}).map(([turma, qtd]) => (
                          <div key={`turma-${turma}`} className="flex items-center justify-between p-3 rounded-lg border border-border">
                            <span className="font-medium text-foreground">{turma}</span>
                            <Badge variant="outline">{qtd} lanches</Badge>
                          </div>
                        ))}
                        <div className="font-medium text-foreground mt-4">Por Cardápio</div>
                        {Object.entries(((relatorioGerado.agrupamento as Record<string, unknown>).porLanche as Record<string, number>) || {}).map(([lanche, qtd]) => (
                          <div key={`lanche-${lanche}`} className="flex items-center justify-between p-3 rounded-lg border border-border">
                            <span className="font-medium text-foreground">{lanche}</span>
                            <Badge variant="outline">{qtd}</Badge>
                          </div>
                        ))}
                      </>
                    ) : (
                      Object.entries(relatorioGerado.agrupamento).map(([chave, valor]) => {
                        // Para trimestral/semestral/anual, valor é um objeto com lanche e almoco
                        if (typeof valor === 'object' && !Array.isArray(valor) && valor !== null && 'lanche' in (valor as Record<string, unknown>)) {
                          const totais = valor as { lanche: number; almoco: number };
                          return (
                            <div key={chave} className="p-3 rounded-lg bg-muted space-y-2">
                              <div className="font-medium text-foreground capitalize">{chave}</div>
                              <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">Lanches:</span>
                                  <Badge variant="secondary">{totais.lanche}</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">Almoços:</span>
                                  <Badge variant="secondary">{totais.almoco}</Badge>
                                </div>
                                <div className="flex items-center gap-2 ml-auto">
                                  <span className="text-sm text-muted-foreground">Total:</span>
                                  <Badge>{totais.lanche + totais.almoco}</Badge>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        // Semanal/Mensal: valor é array de LancheDistribuido
                        return (
                          <div key={chave} className="flex items-center justify-between p-3 rounded-lg border border-border">
                            <span className="font-medium text-foreground">{chave}</span>
                            <Badge variant="outline">{Array.isArray(valor) ? valor.length : String(valor)} lanches</Badge>
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  {/* Totais Gerais para trimestral/semestral/anual */}
                  {(tipoRelatorio === "trimestral" || tipoRelatorio === "semestral" || tipoRelatorio === "anual") && (
                    <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="font-semibold text-foreground mb-2">Total Geral do Período</div>
                      <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Total Lanches:</span>
                          <Badge variant="secondary" className="text-base">
                            {Object.values(relatorioGerado.agrupamento).reduce((sum: number, val: unknown) => {
                              if (typeof val === 'object' && val !== null && 'lanche' in (val as Record<string, unknown>)) {
                                const v = val as { lanche?: number };
                                return sum + (v.lanche || 0);
                              }
                              return sum;
                            }, 0)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Total Almoços:</span>
                          <Badge variant="secondary" className="text-base">
                            {Object.values(relatorioGerado.agrupamento).reduce((sum: number, val: unknown) => {
                              if (typeof val === 'object' && val !== null && 'almoco' in (val as Record<string, unknown>)) {
                                const v = val as { almoco?: number };
                                return sum + (v.almoco || 0);
                              }
                              return sum;
                            }, 0)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-sm font-medium">Total Geral:</span>
                          <Badge className="text-base">{relatorioGerado.total}</Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lista de Distribuições */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Distribuições Registradas</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {relatorioGerado.dados.map((lanche: LancheDistribuido) => (
                      <div key={lanche.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                        <div>
                          <p className="font-medium text-foreground">{lanche.aluno}</p>
                          <p className="text-sm text-muted-foreground">
                            {lanche.turma} • Matrícula: {lanche.matricula}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-foreground">{lanche.lanche}</p>
                          <p className="text-sm text-muted-foreground">{formatarData(lanche.data)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
