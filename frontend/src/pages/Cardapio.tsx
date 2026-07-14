import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChefHat, Plus, Calendar, Clock, Check, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { api } from "@/integrations/api/client";
import { Switch } from "@/components/ui/switch";
import { formatISODate, ensureDateInputValue, toISODate } from "@/lib/date";

interface Cardapio {
  id: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export default function Cardapio() {
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [cardapios, setCardapios] = useState<Cardapio[]>([]);
  const [loading, setLoading] = useState(false);

  const [novoCardapio, setNovoCardapio] = useState({
    nome: "",
    data_inicio: "",
    data_fim: "",
    descricao: "",
    ativo: false,
    tipo_refeicao: "lanche" as "lanche" | "almoco"
  });
  const [dialogAberto, setDialogAberto] = useState(false);
  const [cardapioEditando, setCardapioEditando] = useState<Cardapio | null>(null);

  

  const fetchCardapios = useCallback(async () => {
    try {
      const { data, error } = await api
        .from('cardapios')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCardapios(data || []);
    } catch (error) {
      console.error('Erro ao buscar cardápios:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar cardápios",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchCardapios();
  }, [fetchCardapios]);

  const adicionarCardapio = async () => {
    if (!novoCardapio.nome || !novoCardapio.data_inicio || !novoCardapio.data_fim) {
      toast({
        title: "Erro",
        description: "Nome, data início e data fim são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await api
        .from('cardapios')
        .insert([{
          nome: novoCardapio.nome,
          data_inicio: toISODate(novoCardapio.data_inicio),
          data_fim: toISODate(novoCardapio.data_fim),
          descricao: novoCardapio.descricao || null,
          ativo: novoCardapio.ativo,
          tipo_refeicao: novoCardapio.tipo_refeicao
        }]);

      if (error) throw error;

      setNovoCardapio({
        nome: "",
        data_inicio: "",
        data_fim: "",
        descricao: "",
        ativo: false,
        tipo_refeicao: "lanche"
      });
      setDialogAberto(false);
      fetchCardapios();
      
      toast({
        title: "Sucesso",
        description: "Cardápio cadastrado com sucesso!",
      });
    } catch (error: any) {
      console.error('Erro ao adicionar cardápio:', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao cadastrar cardápio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleAtivo = async (cardapio: Cardapio) => {
    try {
      const { error } = await api
        .from('cardapios')
        .eq('id', cardapio.id)
        .update({ ativo: !cardapio.ativo });

      if (error) throw error;

      fetchCardapios();
      
      toast({
        title: "Sucesso",
        description: `Cardápio ${!cardapio.ativo ? 'ativado' : 'desativado'} com sucesso!`,
      });
    } catch (error) {
      console.error('Erro ao atualizar cardápio:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar cardápio",
        variant: "destructive",
      });
    }
  };

  const editarCardapio = async () => {
    if (!cardapioEditando) return;
    
    if (!novoCardapio.nome || !novoCardapio.data_inicio || !novoCardapio.data_fim) {
      toast({
        title: "Erro",
        description: "Nome, data início e data fim são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await api
        .from('cardapios')
        .eq('id', cardapioEditando.id)
        .update({
          nome: novoCardapio.nome,
          data_inicio: toISODate(novoCardapio.data_inicio),
          data_fim: toISODate(novoCardapio.data_fim),
          descricao: novoCardapio.descricao || null,
          ativo: novoCardapio.ativo,
          tipo_refeicao: novoCardapio.tipo_refeicao
        });

      if (error) throw error;

      setNovoCardapio({
        nome: "",
        data_inicio: "",
        data_fim: "",
        descricao: "",
        ativo: false,
        tipo_refeicao: "lanche"
      });
      setCardapioEditando(null);
      setDialogAberto(false);
      fetchCardapios();
      
      toast({
        title: "Sucesso",
        description: "Cardápio atualizado com sucesso!",
      });
    } catch (error: any) {
      console.error('Erro ao atualizar cardápio:', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao atualizar cardápio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const excluirCardapio = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cardápio?")) return;

    setLoading(true);
    try {
      const { error } = await api
        .from('cardapios')
        .eq('id', id)
        .delete();

      if (error) throw error;

      fetchCardapios();
      
      toast({
        title: "Sucesso",
        description: "Cardápio excluído com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao excluir cardápio:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir cardápio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const abrirDialogEdicao = (cardapio: Cardapio) => {
    setCardapioEditando(cardapio);
    setNovoCardapio({
      nome: cardapio.nome,
      data_inicio: ensureDateInputValue(cardapio.data_inicio),
      data_fim: ensureDateInputValue(cardapio.data_fim),
      descricao: cardapio.descricao || "",
      ativo: cardapio.ativo,
      tipo_refeicao: "lanche" // tipo_refeicao não existe no interface, então vou usar lanche como padrão
    });
    setDialogAberto(true);
  };

  const formatarData = (dataString: string) => {
    return formatISODate(dataString);
  };

  const cardapiosAtivos = cardapios.filter(c => c.ativo);
  const cardapiosInativos = cardapios.filter(c => !c.ativo);

  // Verificar permissão de acesso
  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Cardápio</h2>
          <p className="text-muted-foreground">
            Gerenciamento de cardápios diários e semanais
          </p>
        </div>
        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Cardápio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{cardapioEditando ? 'Editar Cardápio' : 'Cadastrar Cardápio'}</DialogTitle>
              <DialogDescription>
                {cardapioEditando ? 'Atualize os dados do cardápio.' : 'Adicione um novo cardápio com período de validade.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome do Cardápio</Label>
                <Input
                  id="nome"
                  value={novoCardapio.nome}
                  onChange={(e) => setNovoCardapio({...novoCardapio, nome: e.target.value})}
                  placeholder="Ex: Cardápio da Semana"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="data_inicio">Data Início</Label>
                  <Input
                    id="data_inicio"
                    type="date"
                    value={ensureDateInputValue(novoCardapio.data_inicio)}
                    onChange={(e) => setNovoCardapio({...novoCardapio, data_inicio: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="data_fim">Data Fim</Label>
                  <Input
                    id="data_fim"
                    type="date"
                    value={ensureDateInputValue(novoCardapio.data_fim)}
                    onChange={(e) => setNovoCardapio({...novoCardapio, data_fim: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="descricao">Descrição (opcional)</Label>
                <Textarea
                  id="descricao"
                  value={novoCardapio.descricao}
                  onChange={(e) => setNovoCardapio({...novoCardapio, descricao: e.target.value})}
                  placeholder="Ex: Pão com manteiga, leite com chocolate, banana"
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tipo_refeicao">Tipo de Refeição</Label>
                <select
                  id="tipo_refeicao"
                  value={novoCardapio.tipo_refeicao}
                  onChange={(e) => setNovoCardapio({...novoCardapio, tipo_refeicao: e.target.value as "lanche" | "almoco"})}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="lanche">Lanche</option>
                  <option value="almoco">Almoço</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={novoCardapio.ativo}
                  onCheckedChange={(checked) => setNovoCardapio({...novoCardapio, ativo: checked})}
                />
                <Label htmlFor="ativo">Marcar como ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                onClick={cardapioEditando ? editarCardapio : adicionarCardapio} 
                disabled={loading}
              >
                {loading ? (cardapioEditando ? "Atualizando..." : "Cadastrando...") : (cardapioEditando ? "Atualizar Cardápio" : "Cadastrar Cardápio")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Cardápios
            </CardTitle>
            <ChefHat className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{cardapios.length}</div>
            <p className="text-xs text-muted-foreground">
              Cardápios cadastrados
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cardápios Ativos
            </CardTitle>
            <Calendar className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{cardapiosAtivos.length}</div>
            <p className="text-xs text-muted-foreground">
              Em uso no momento
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inativos
            </CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{cardapiosInativos.length}</div>
            <p className="text-xs text-muted-foreground">
              Arquivados
            </p>
          </CardContent>
        </Card>
      </div>

      {cardapiosAtivos.length > 0 && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-success" />
              Cardápios Ativos
            </CardTitle>
            <CardDescription>
              Cardápios que estão sendo utilizados no momento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cardapiosAtivos.map((cardapio) => (
                <div key={cardapio.id} className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{cardapio.nome}</h3>
                        <Badge variant="default" className="bg-success text-success-foreground">
                          Ativo
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>De {formatarData(cardapio.data_inicio)} até {formatarData(cardapio.data_fim)}</span>
                      </div>
                      {cardapio.descricao && (
                        <p className="text-sm text-muted-foreground">
                          {cardapio.descricao}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirDialogEdicao(cardapio)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => excluirCardapio(cardapio.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <Switch
                        checked={cardapio.ativo}
                        onCheckedChange={() => toggleAtivo(cardapio)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            Todos os Cardápios
          </CardTitle>
          <CardDescription>
            Lista completa de cardápios cadastrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {cardapios.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum cardápio cadastrado ainda
                </p>
              ) : (
                cardapios.map((cardapio) => (
                  <div key={cardapio.id} className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">{cardapio.nome}</h3>
                          {cardapio.ativo ? (
                            <Badge variant="default" className="bg-success text-success-foreground">
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>De {formatarData(cardapio.data_inicio)} até {formatarData(cardapio.data_fim)}</span>
                        </div>
                        {cardapio.descricao && (
                          <p className="text-sm text-muted-foreground">
                            {cardapio.descricao}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirDialogEdicao(cardapio)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => excluirCardapio(cardapio.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <Switch
                            checked={cardapio.ativo}
                            onCheckedChange={() => toggleAtivo(cardapio)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
