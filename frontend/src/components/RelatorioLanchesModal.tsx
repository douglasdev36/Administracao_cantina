import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileDown, Coffee } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/integrations/api/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatISODate } from "@/lib/date";

interface RelatorioLanchesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RelatorioCardapio {
  cardapio_nome: string;
  tipo_refeicao: string;
  quantidade: number;
}

export default function RelatorioLanchesModal({ open, onOpenChange }: RelatorioLanchesModalProps) {
  const [loading, setLoading] = useState(false);
  const [totalLanches, setTotalLanches] = useState(0);
  const [porCardapio, setPorCardapio] = useState<RelatorioCardapio[]>([]);

  useEffect(() => {
    if (open) {
      fetchRelatorio();
    }
  }, [open]);

  const fetchRelatorio = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      // Total de lanches do dia
      const { count } = await api
        .from('liberacoes_lanche')
        .select('*', { count: 'exact', head: true })
        .gte('data_liberacao', hoje.toISOString())
        .lt('data_liberacao', amanha.toISOString());

      setTotalLanches(count || 0);

      // Buscar detalhamento por cardápio e tipo de refeição
      const { data: liberacoes } = await api
        .from('liberacoes_lanche')
        .select('cardapio_nome, cardapio_id')
        .gte('data_liberacao', hoje.toISOString())
        .lt('data_liberacao', amanha.toISOString());

      // Buscar informações dos cardápios
      const cardapioIds = [...new Set(liberacoes?.map(l => l.cardapio_id).filter(Boolean))];
      const { data: cardapios } = await api
        .from('cardapios')
        .select('id, tipo_refeicao')
        .in('id', cardapioIds);

      const cardapioMap = new Map(cardapios?.map(c => [c.id, c.tipo_refeicao]) || []);

      // Agrupar por cardápio
      const agrupado: Record<string, { quantidade: number; tipo_refeicao: string }> = {};
      liberacoes?.forEach(lib => {
        const nome = lib.cardapio_nome || 'Sem cardápio definido';
        const tipo = lib.cardapio_id ? cardapioMap.get(lib.cardapio_id) || 'lanche' : 'lanche';
        if (!agrupado[nome]) {
          agrupado[nome] = { quantidade: 0, tipo_refeicao: tipo };
        }
        agrupado[nome].quantidade += 1;
      });

      const resultado = Object.entries(agrupado).map(([cardapio_nome, data]) => ({
        cardapio_nome,
        tipo_refeicao: data.tipo_refeicao === 'almoco' ? 'Almoço' : 'Lanche',
        quantidade: data.quantidade
      }));

      setPorCardapio(resultado);
    } catch (error) {
      console.error('Erro ao buscar relatório:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    const hoje = new Date();
    const dataFormatada = formatISODate(hoje);
    
    // Cabeçalho
    doc.setFontSize(18);
    doc.text('Relatório da Cantina Escolar', 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Data: ${dataFormatada}`, 14, 30);
    doc.text(`Total de Lanches Distribuídos: ${totalLanches}`, 14, 38);
    
    // Tabela com detalhamento por cardápio
    if (porCardapio.length > 0) {
      doc.setFontSize(14);
      doc.text('Distribuição por Cardápio:', 14, 50);
      
      const tableData = porCardapio.map(item => [
        item.cardapio_nome,
        item.tipo_refeicao,
        item.quantidade.toString()
      ]);

      autoTable(doc, {
        head: [['Cardápio', 'Tipo', 'Quantidade']],
        body: tableData,
        startY: 55,
        theme: 'grid',
        headStyles: {
          fillColor: [99, 102, 241],
          textColor: 255,
          fontSize: 11,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 10,
          cellPadding: 5
        }
      });
    }

    // Salvar PDF
    const nomeArquivo = `relatorio_cantina_${dataFormatada.replace(/\//g, '-')}.pdf`;
    doc.save(nomeArquivo);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5" />
            Relatório de Lanches do Dia
          </DialogTitle>
          <DialogDescription>
            Visualize e exporte o relatório de distribuição de lanches
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <p className="text-sm text-muted-foreground mb-2">Total de Lanches Distribuídos</p>
                  <p className="text-4xl font-bold text-primary">{totalLanches}</p>
                </div>

                {porCardapio.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Detalhamento por Cardápio:</p>
                    {porCardapio.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                        <div>
                          <span className="font-medium">{item.cardapio_nome}</span>
                          <span className="text-xs text-muted-foreground ml-2">({item.tipo_refeicao})</span>
                        </div>
                        <span className="text-lg font-bold text-primary">{item.quantidade} refeições</span>
                      </div>
                    ))}
                  </div>
                )}

                {porCardapio.length === 0 && totalLanches === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum lanche foi distribuído hoje
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button onClick={exportarPDF} disabled={totalLanches === 0}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
