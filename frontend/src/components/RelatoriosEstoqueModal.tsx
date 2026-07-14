import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar, ArrowUp, ArrowDown, Package, Download } from "lucide-react";
import { api } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateTime, formatISODate } from "@/lib/date";

interface RelatoriosEstoqueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Movimentacao {
  id: string;
  produto_id: string;
  tipo: string;
  quantidade: number;
  observacao: string | null;
  created_at: string;
  produtos: {
    nome: string;
    unidade: string;
    categoria: string;
  };
}

type TipoRelatorio = "dia" | "semana" | "mes" | "personalizado";

export function RelatoriosEstoqueModal({ open, onOpenChange }: RelatoriosEstoqueModalProps) {
  const { toast } = useToast();
  const [tipoRelatorio, setTipoRelatorio] = useState<TipoRelatorio>("mes");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(false);
  const maskDateInput = (s: string) => {
    const d = s.replace(/\D/g, '').slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  };
  const [relatorioGerado, setRelatorioGerado] = useState(false);

  const formatarData = (dataString: string) => {
    return formatDateTime(dataString);
  };

  const obterPeriodoTexto = () => {
    const hoje = new Date();
    switch (tipoRelatorio) {
      case "dia":
        return `Hoje - ${formatISODate(hoje)}`;
      case "semana": {
        const inicioSemana = new Date(hoje.setDate(hoje.getDate() - hoje.getDay()));
        return `Esta semana - ${formatISODate(inicioSemana)} até hoje`;
      }
      case "mes":
        return `Este mês - ${formatISODate(new Date(hoje.getFullYear(), hoje.getMonth(), 1))} até hoje`;
      case "personalizado":
        if (dataInicio && dataFim) {
          return `${formatISODate(dataInicio)} até ${formatISODate(dataFim)}`;
        }
        return "Selecione as datas";
      default:
        return "";
    }
  };

  const gerarRelatorio = async () => {
    setLoading(true);
    try {
      let dataInicioFiltro = new Date();
      let dataFimFiltro = new Date();

      switch (tipoRelatorio) {
        case "dia":
          dataInicioFiltro.setHours(0, 0, 0, 0);
          break;
        case "semana":
          dataInicioFiltro.setDate(dataInicioFiltro.getDate() - dataInicioFiltro.getDay());
          dataInicioFiltro.setHours(0, 0, 0, 0);
          break;
        case "mes":
          dataInicioFiltro = new Date(dataInicioFiltro.getFullYear(), dataInicioFiltro.getMonth(), 1);
          break;
        case "personalizado":
          if (!dataInicio || !dataFim) {
            toast({
              title: "Erro",
              description: "Selecione as datas de início e fim",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
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
            dataFimFiltro = parseDateInput(dataFim);
            dataFimFiltro.setHours(23, 59, 59, 999);
          }
          break;
      }

      const { data, error } = await api
        .from('movimentacoes_estoque')
        .select(`
          *,
          produtos (
            nome,
            unidade,
            categoria
          )
        `)
        .gte('created_at', dataInicioFiltro.toISOString())
        .lte('created_at', dataFimFiltro.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const list = (data || []) as Movimentacao[];
      const seen = new Set<string>();
      const dedup = list.filter((m) => {
        const key = `${m.produto_id}|${m.tipo}|${m.quantidade}|${m.created_at}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setMovimentacoes(dedup);
      setRelatorioGerado(true);
      
      toast({
        title: "Sucesso",
        description: "Relatório gerado com sucesso!",
      });
    } catch (error: unknown) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao gerar relatório",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const totalEntradas = movimentacoes
    .filter(m => m.tipo === 'entrada')
    .reduce((sum, m) => sum + m.quantidade, 0);

  const totalSaidas = movimentacoes
    .filter(m => m.tipo === 'saida')
    .reduce((sum, m) => sum + m.quantidade, 0);

  const exportarRelatorio = () => {
    if (movimentacoes.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum dado para exportar",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    const dataAtual = new Date().toLocaleDateString("pt-BR");

    // Título
    doc.setFontSize(16);
    doc.text("Relatório de Movimentações de Estoque", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Período: ${obterPeriodoTexto()}`, 14, 28);
    doc.text(`Gerado em: ${dataAtual}`, 14, 34);

    let yPosition = 45;

    // Resumo
    doc.setFontSize(12);
    doc.text("Resumo Geral", 14, yPosition);
    yPosition += 8;

    const resumoData = [
      ["Total de Movimentações", movimentacoes.length],
      ["Total de Entradas", totalEntradas],
      ["Total de Saídas", totalSaidas],
      ["Saldo", totalEntradas - totalSaidas]
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [["Métrica", "Valor"]],
      body: resumoData,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
    });

    const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPosition;
    yPosition = lastY + 10;

    // Detalhamento das Movimentações
    doc.setFontSize(12);
    doc.text("Detalhamento das Movimentações", 14, yPosition);
    yPosition += 8;

    const movimentacoesData = movimentacoes.map((mov) => [
      mov.produtos.nome,
      mov.produtos.categoria,
      mov.tipo === 'entrada' ? 'Entrada' : 'Saída',
      `${mov.tipo === 'entrada' ? '+' : '-'}${mov.quantidade} ${mov.produtos.unidade}`,
      formatarData(mov.created_at),
      mov.observacao || '-'
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Produto", "Categoria", "Tipo", "Quantidade", "Data", "Observação"]],
      body: movimentacoesData,
      theme: "striped",
      headStyles: { fillColor: [52, 152, 219] },
      styles: { fontSize: 8 },
    });

    // Salvar PDF
    const nomeArquivo = `relatorio_estoque_${dataAtual.replace(/\//g, "-")}.pdf`;
    doc.save(nomeArquivo);

    toast({
      title: "Relatório exportado",
      description: `O relatório foi exportado como ${nomeArquivo}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Relatórios de Movimentação de Estoque
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Configuração do Relatório */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configurar Relatório</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Período</Label>
                  <select
                    value={tipoRelatorio}
                    onChange={(e) => setTipoRelatorio(e.target.value as TipoRelatorio)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="dia">Hoje</option>
                    <option value="semana">Esta Semana</option>
                    <option value="mes">Este Mês</option>
                    <option value="personalizado">Período Personalizado</option>
                  </select>
                </div>

                {tipoRelatorio === "personalizado" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Data Início</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/yyyy"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(maskDateInput(e.target.value))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Data Fim</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/yyyy"
                      value={dataFim}
                      onChange={(e) => setDataFim(maskDateInput(e.target.value))}
                    />
                  </div>
                </div>
                )}

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {obterPeriodoTexto()}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={gerarRelatorio} disabled={loading} className="flex-1">
                  {loading ? "Gerando..." : "Gerar Relatório"}
                </Button>
                {relatorioGerado && movimentacoes.length > 0 && (
                  <Button variant="outline" onClick={exportarRelatorio} className="gap-2">
                    <Download className="h-4 w-4" />
                    Exportar PDF
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resultados */}
          {relatorioGerado && (
            <>
              {/* Resumo */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Movimentações</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{movimentacoes.length}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Entradas</CardTitle>
                    <ArrowUp className="h-4 w-4 text-success" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-success">{totalEntradas}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Saídas</CardTitle>
                    <ArrowDown className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{totalSaidas}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Detalhamento */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detalhamento das Movimentações</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {movimentacoes.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        Nenhuma movimentação encontrada neste período
                      </p>
                    ) : (
                      movimentacoes.map((mov) => (
                        <div key={mov.id} className="flex items-start justify-between p-3 rounded-lg border">
                          <div className="flex items-start gap-3">
                            {mov.tipo === 'entrada' ? (
                              <ArrowUp className="h-4 w-4 text-success mt-1" />
                            ) : (
                              <ArrowDown className="h-4 w-4 text-destructive mt-1" />
                            )}
                            <div>
                              <p className="font-medium">{mov.produtos.nome}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="outline">{mov.produtos.categoria}</Badge>
                                <span>{formatarData(mov.created_at)}</span>
                              </div>
                              {mov.observacao && (
                                <p className="text-sm text-muted-foreground mt-1">{mov.observacao}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {mov.tipo === 'entrada' ? '+' : '-'}{mov.quantidade} {mov.produtos.unidade}
                            </p>
                            <Badge variant={mov.tipo === 'entrada' ? 'default' : 'destructive'}>
                              {mov.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
