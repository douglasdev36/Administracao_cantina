import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, TrendingUp, TrendingDown, Calendar, Plus, Filter, X, ArrowUp, ArrowDown, FileText, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { api } from "@/integrations/api/client";
import { RelatoriosEstoqueModal } from "@/components/RelatoriosEstoqueModal";
import { formatISODate, ensureDateInputValue, toISODate } from "@/lib/date";

interface Produto {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidade_estoque: number;
  quantidade_minima: number;
  data_validade?: string;
  created_at: string;
  updated_at: string;
}

export default function Almoxarifado() {
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);

  const [categorias, setCategorias] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novaUnidade, setNovaUnidade] = useState("");
  const [dialogCategoria, setDialogCategoria] = useState(false);
  const [dialogUnidade, setDialogUnidade] = useState(false);

  const [novoProduto, setNovoProduto] = useState({
    nome: "",
    categoria: "",
    unidade: "",
    quantidade_estoque: "",
    quantidade_minima: "",
    data_validade: ""
  });
  const [dialogAberto, setDialogAberto] = useState(false);
  const [movimentacaoDialog, setMovimentacaoDialog] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [quantidadeMovimento, setQuantidadeMovimento] = useState("");
  const [tipoMovimento, setTipoMovimento] = useState<'entrada' | 'saida'>('entrada');
  const [observacaoMovimento, setObservacaoMovimento] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("Todas");
  const [relatorioDialog, setRelatorioDialog] = useState(false);
  const [dataValidadeMovimento, setDataValidadeMovimento] = useState("");

  

  const fetchCategorias = useCallback(async () => {
    try {
      const { data, error } = await api
        .from('categorias_produtos')
        .select('nome')
        .order('nome');

      if (error) throw error;
      setCategorias(data?.map(c => c.nome) || []);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar categorias",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchUnidades = useCallback(async () => {
    try {
      const { data, error } = await api
        .from('unidades_medida')
        .select('nome')
        .order('nome');

      if (error) throw error;
      setUnidades(data?.map(u => u.nome) || []);
    } catch (error) {
      console.error('Erro ao buscar unidades:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar unidades",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchProdutos = useCallback(async () => {
    try {
      const { data, error } = await api
        .from('produtos')
        .select('*')
        .order('nome');

      if (error) throw error;
      setProdutos(data || []);
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar produtos",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchProdutos();
    fetchCategorias();
    fetchUnidades();
  }, [fetchProdutos, fetchCategorias, fetchUnidades]);

  const adicionarCategoria = async () => {
    if (!novaCategoria.trim()) {
      toast({
        title: "Erro",
        description: "Digite o nome da categoria",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await api
        .from('categorias_produtos')
        .insert([{ nome: novaCategoria }]);

      if (error) throw error;

      await fetchCategorias();
      setNovaCategoria("");
      setDialogCategoria(false);
      toast({
        title: "Sucesso",
        description: "Categoria adicionada com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao adicionar categoria:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar categoria",
        variant: "destructive",
      });
    }
  };

  const adicionarUnidade = async () => {
    if (!novaUnidade.trim()) {
      toast({
        title: "Erro",
        description: "Digite o nome da unidade",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await api
        .from('unidades_medida')
        .insert([{ nome: novaUnidade }]);

      if (error) throw error;

      await fetchUnidades();
      setNovaUnidade("");
      setDialogUnidade(false);
      toast({
        title: "Sucesso",
        description: "Unidade adicionada com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao adicionar unidade:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar unidade",
        variant: "destructive",
      });
    }
  };

  // Função para filtrar produtos por categoria
  const filtrarPorCategoria = (lista: Produto[]) => {
    if (filtroCategoria === "Todas") return lista;
    return lista.filter(produto => produto.categoria === filtroCategoria);
  };

  const produtosFiltrados = filtrarPorCategoria(produtos);

  const adicionarProduto = async () => {
    if (!novoProduto.nome || !novoProduto.categoria || !novoProduto.unidade || !novoProduto.quantidade_estoque) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await api
        .from('produtos')
        .insert([{
          nome: novoProduto.nome,
          categoria: novoProduto.categoria,
          unidade: novoProduto.unidade,
          quantidade_estoque: parseInt(novoProduto.quantidade_estoque),
          quantidade_minima: parseInt(novoProduto.quantidade_minima) || 0,
          data_validade: toISODate(novoProduto.data_validade) || null
        }]);

      if (error) throw error;

      setNovoProduto({
        nome: "",
        categoria: "",
        unidade: "",
        quantidade_estoque: "",
        quantidade_minima: "",
        data_validade: ""
      });
      setDialogAberto(false);
      fetchProdutos();
      
      toast({
        title: "Sucesso",
        description: "Produto adicionado com sucesso!",
      });
    } catch (error: unknown) {
      console.error('Erro ao adicionar produto:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao adicionar produto",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const registrarMovimentacao = async () => {
    if (!produtoSelecionado || !quantidadeMovimento) {
      toast({
        title: "Erro",
        description: "Produto e quantidade são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (tipoMovimento === 'entrada' && !dataValidadeMovimento) {
      toast({
        title: "Erro",
        description: "Data de validade é obrigatória para entradas",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await api.auth.getUser();
      
      // Atualizar estoque e registrar movimentação via RPC (evita duplicidade)
      const { error: updateError } = await api
        .rpc('update_produto_estoque', {
          produto_id: produtoSelecionado.id,
          nova_quantidade: parseInt(quantidadeMovimento),
          tipo_movimentacao: tipoMovimento,
          observacao: observacaoMovimento || null,
          usuario_id: user?.id
        });

      if (updateError) throw updateError;

      // Atualizar a data de validade quando informado na entrada
      if (tipoMovimento === 'entrada' && dataValidadeMovimento) {
        await api
          .from('produtos')
          .eq('id', produtoSelecionado.id)
          .update({ data_validade: toISODate(dataValidadeMovimento) });
      }

      // Limpar form
      setQuantidadeMovimento("");
      setObservacaoMovimento("");
      setDataValidadeMovimento("");
      setMovimentacaoDialog(false);
      setProdutoSelecionado(null);
      
      fetchProdutos();
      
      toast({
        title: "Sucesso",
        description: `${tipoMovimento === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso!`,
      });
    } catch (error: unknown) {
      console.error('Erro ao registrar movimentação:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao registrar movimentação",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const formatarData = (dataString: string) => {
    return formatISODate(dataString);
  };

  const excluirProduto = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    setLoading(true);
    try {
      const { error } = await api
        .from('produtos')
        .eq('id', id)
        .delete();

      if (error) throw error;

      fetchProdutos();
      
      toast({
        title: "Sucesso",
        description: "Produto excluído com sucesso!",
      });
    } catch (error: unknown) {
      console.error('Erro ao excluir produto:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao excluir produto",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const renderTabelaProdutos = (produtosList: Produto[], titulo: string) => (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {produtosList.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum produto encontrado
              </p>
            ) : (
              produtosList.map((produto) => (
                <div key={produto.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-primary" />
                     <div>
                      <p className="font-medium text-foreground">{produto.nome}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <Badge variant="outline">{produto.categoria}</Badge>
                        {produto.data_validade && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Validade: {formatarData(produto.data_validade)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {produto.quantidade_estoque} {produto.unidade}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={produto.quantidade_estoque > produto.quantidade_minima ? 'default' : 'destructive'}
                          className={produto.quantidade_estoque > produto.quantidade_minima ? 'bg-success-muted text-success' : 'bg-destructive-muted text-destructive'}
                        >
                          {produto.quantidade_estoque > produto.quantidade_minima ? 'Disponível' : 'Estoque Baixo'}
                        </Badge>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setProdutoSelecionado(produto);
                                setTipoMovimento('entrada');
                                setMovimentacaoDialog(true);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <ArrowUp className="h-3 w-3 text-success" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setProdutoSelecionado(produto);
                                setTipoMovimento('saida');
                                setMovimentacaoDialog(true);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <ArrowDown className="h-3 w-3 text-destructive" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => excluirProduto(produto.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const produtosDisponveis = produtosFiltrados.filter(p => p.quantidade_estoque > 0);
  const produtosEstoqueBaixo = produtosFiltrados.filter(p => p.quantidade_estoque <= p.quantidade_minima);

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
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Almoxarifado</h2>
          <p className="text-muted-foreground">
            Controle de produtos do estoque
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative w-[180px]">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="Todas">Todas as Categorias</option>
                {categorias.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>
            {filtroCategoria !== "Todas" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltroCategoria("Todas")}
                className="h-9 px-2"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {isAdmin && (
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setRelatorioDialog(true)}
              >
                <FileText className="h-4 w-4" />
                Relatórios
              </Button>
            <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Produto</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do produto para adicionar ao estoque.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="nome">Nome do Produto</Label>
                    <Input
                      id="nome"
                      value={novoProduto.nome}
                      onChange={(e) => setNovoProduto({...novoProduto, nome: e.target.value})}
                      placeholder="Ex: Pão Francês"
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="categoria">Categoria</Label>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setDialogCategoria(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Nova
                      </Button>
                    </div>
                    <select
                      id="categoria"
                      value={novoProduto.categoria}
                      onChange={(e) => setNovoProduto({ ...novoProduto, categoria: e.target.value })}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecione uma categoria</option>
                      {categorias.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="quantidade_estoque">Quantidade Inicial</Label>
                      <Input
                        id="quantidade_estoque"
                        type="number"
                        value={novoProduto.quantidade_estoque}
                        onChange={(e) => setNovoProduto({...novoProduto, quantidade_estoque: e.target.value})}
                        placeholder="0"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="quantidade_minima">Estoque Mínimo</Label>
                      <Input
                        id="quantidade_minima"
                        type="number"
                        value={novoProduto.quantidade_minima}
                        onChange={(e) => setNovoProduto({...novoProduto, quantidade_minima: e.target.value})}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="unidade">Unidade</Label>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setDialogUnidade(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Nova
                      </Button>
                    </div>
                    <select
                      id="unidade"
                      value={novoProduto.unidade}
                      onChange={(e) => setNovoProduto({ ...novoProduto, unidade: e.target.value })}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Unidade</option>
                      {unidades.map((unidade) => (
                        <option key={unidade} value={unidade}>
                          {unidade}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="data_validade">Data de Validade</Label>
                    <Input
                      id="data_validade"
                      type="date"
                      value={ensureDateInputValue(novoProduto.data_validade)}
                      onChange={(e) => setNovoProduto({...novoProduto, data_validade: e.target.value})}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" onClick={adicionarProduto} disabled={loading}>
                    {loading ? "Adicionando..." : "Adicionar Produto"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Produtos
            </CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{produtosFiltrados.length}</div>
            <p className="text-xs text-muted-foreground">
              Produtos cadastrados
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Disponíveis
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{produtosDisponveis.length}</div>
            <p className="text-xs text-muted-foreground">
              Com estoque
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estoque Baixo
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{produtosEstoqueBaixo.length}</div>
            <p className="text-xs text-muted-foreground">
              Precisam reposição
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="todos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="todos">Todos os Produtos</TabsTrigger>
          <TabsTrigger value="disponiveis">Disponíveis</TabsTrigger>
          <TabsTrigger value="estoque-baixo">Estoque Baixo</TabsTrigger>
        </TabsList>

        <TabsContent value="todos">
          {renderTabelaProdutos(produtosFiltrados, "Todos os Produtos")}
        </TabsContent>

        <TabsContent value="disponiveis">
          {renderTabelaProdutos(produtosDisponveis, "Produtos Disponíveis")}
        </TabsContent>

        <TabsContent value="estoque-baixo">
          {renderTabelaProdutos(produtosEstoqueBaixo, "Produtos com Estoque Baixo")}
        </TabsContent>
      </Tabs>

      {/* Dialog para movimentação de estoque */}
      <Dialog open={movimentacaoDialog} onOpenChange={setMovimentacaoDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {tipoMovimento === 'entrada' ? (
                <ArrowUp className="h-5 w-5 text-success" />
              ) : (
                <ArrowDown className="h-5 w-5 text-destructive" />
              )}
              {tipoMovimento === 'entrada' ? 'Entrada' : 'Saída'} de Estoque
            </DialogTitle>
            <DialogDescription>
              {produtoSelecionado?.nome} - Estoque atual: {produtoSelecionado?.quantidade_estoque} {produtoSelecionado?.unidade}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input
                id="quantidade"
                type="number"
                value={quantidadeMovimento}
                onChange={(e) => setQuantidadeMovimento(e.target.value)}
                placeholder="0"
                min="1"
              />
            </div>
            {tipoMovimento === 'entrada' && (
              <div className="grid gap-2">
                <Label htmlFor="data_validade_mov">Data de Validade *</Label>
                <Input
                  id="data_validade_mov"
                  type="date"
                  value={ensureDateInputValue(dataValidadeMovimento)}
                  onChange={(e) => setDataValidadeMovimento(e.target.value)}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Input
                id="observacao"
                value={observacaoMovimento}
                onChange={(e) => setObservacaoMovimento(e.target.value)}
                placeholder="Motivo da movimentação..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={registrarMovimentacao} 
              disabled={loading || !quantidadeMovimento}
              className={tipoMovimento === 'entrada' ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'}
            >
              {loading ? "Processando..." : `Confirmar ${tipoMovimento === 'entrada' ? 'Entrada' : 'Saída'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Relatórios */}
      <RelatoriosEstoqueModal 
        open={relatorioDialog}
        onOpenChange={setRelatorioDialog}
      />

      {/* Dialog para adicionar categoria */}
      <Dialog open={dialogCategoria} onOpenChange={setDialogCategoria}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
            <DialogDescription>
              Adicione uma nova categoria de produto
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nova_categoria">Nome da Categoria</Label>
              <Input
                id="nova_categoria"
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                placeholder="Ex: Frutas"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={adicionarCategoria}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para adicionar unidade */}
      <Dialog open={dialogUnidade} onOpenChange={setDialogUnidade}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Nova Unidade</DialogTitle>
            <DialogDescription>
              Adicione uma nova unidade de medida
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nova_unidade">Nome da Unidade</Label>
              <Input
                id="nova_unidade"
                value={novaUnidade}
                onChange={(e) => setNovaUnidade(e.target.value)}
                placeholder="Ex: Caixas"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={adicionarUnidade}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
