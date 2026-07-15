import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { api } from "@/integrations/api/client";
import { Plus, Search, Edit, Trash2, ArrowRightLeft } from "lucide-react";
import { toISODate } from "@/lib/date";

interface Turma {
  id: string;
  nome: string;
}

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  numero_pasta: string | null;
  data_nascimento: string | null;
  email: string | null;
  telefone: string | null;
  observacao: string | null;
  turma_id: string | null;
  status: string;
  turmas?: { nome: string };
  e_bolsista?: boolean;
}

type AlunoMigracao = {
  id: string;
  nome: string;
  matricula: string;
  numero_pasta?: string | null;
};

const Alunos = () => {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTurma, setFiltroTurma] = useState<string>("Todas");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTurmaDialogOpen, setIsTurmaDialogOpen] = useState(false);
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [migrateFromTurma, setMigrateFromTurma] = useState<Turma | null>(null);
  const [migrateToTurmaId, setMigrateToTurmaId] = useState<string>('');
  const [migrateAlunos, setMigrateAlunos] = useState<AlunoMigracao[]>([]);
  const [migrateSelectedIds, setMigrateSelectedIds] = useState<string[]>([]);
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [editingAluno, setEditingAluno] = useState<Aluno | null>(null);
  const { toast } = useToast();
  const { isSuperAdmin, isAdmin, loading: roleLoading } = useUserRole();

  const [formData, setFormData] = useState({
    nome: '',
    matricula: '',
    numero_pasta: '',
    data_nascimento: '',
    email: '',
    telefone: '',
    observacao: '',
    turma_id: '',
    status: 'ativo',
    e_bolsista: false
  });

  const [novaTurma, setNovaTurma] = useState('');

  const normalizeTurmaNome = (s: string) => (
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  );

  const sugerirTurmaDestinoId = (origem: Turma) => {
    const nome = String(origem?.nome || '');
    const candidates: string[] = [];

    const yearMatch = nome.match(/\b([1-8])\s*(º|°)?\s*(ano)?\b/i);
    if (yearMatch) {
      const n = Number(yearMatch[1]);
      const sym = yearMatch[2] || '';
      const hasAno = Boolean(yearMatch[3]);
      const replacement = `${n + 1}${sym}${hasAno ? ' ano' : ''}`;
      candidates.push(nome.replace(yearMatch[0], replacement));
    }

    const tailMatch = nome.match(/\b([1-8])\s*$/);
    if (tailMatch) {
      const n = Number(tailMatch[1]);
      candidates.push(nome.replace(tailMatch[0], String(n + 1)));
    }

    for (const cand of candidates) {
      const candNorm = normalizeTurmaNome(cand);
      const exact = turmas.find((t) => t.id !== origem.id && normalizeTurmaNome(t.nome) === candNorm);
      if (exact) return exact.id;

      const loose = turmas.find((t) => {
        if (t.id === origem.id) return false;
        const tn = normalizeTurmaNome(t.nome);
        return tn.includes(candNorm) || candNorm.includes(tn);
      });
      if (loose) return loose.id;
    }

    return '';
  };


  const fetchAlunos = useCallback(async () => {
    try {
      const { data, error } = await api
        .select(`
          *,
          turmas (
            nome
          )
        `)
        .order('nome');

      if (error) throw error;
      setAlunos(data || []);
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar alunos",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchTurmas = useCallback(async () => {
    try {
      const { data, error } = await api
        .from('turmas')
        .select('*')
        .order('nome');

      if (error) throw error;
      setTurmas(data || []);
    } catch (error) {
      console.error('Erro ao buscar turmas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar turmas",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchAlunos();
    fetchTurmas();
  }, [fetchAlunos, fetchTurmas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingAluno) {
        const { error } = await api
          .from('alunos')
          .eq('id', editingAluno.id)
          .update({
            ...formData,
            data_nascimento: toISODate(formData.data_nascimento) || null,
          });

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Aluno atualizado com sucesso",
        });
      } else {
        const { error } = await api
          .from('alunos')
          .insert([{ 
            ...formData,
            data_nascimento: toISODate(formData.data_nascimento) || null,
          }]);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Aluno cadastrado com sucesso",
        });
      }

      setFormData({
        nome: '',
        matricula: '',
        numero_pasta: '',
        data_nascimento: '',
        email: '',
        telefone: '',
        observacao: '',
        turma_id: '',
        status: 'ativo',
        e_bolsista: false
      });
      setEditingAluno(null);
      setIsDialogOpen(false);
      fetchAlunos();
    } catch (error: unknown) {
      console.error('Erro ao salvar aluno:', error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message)
            : typeof error === 'object' && error && 'error' in error
              ? String((error as { error?: unknown }).error)
              : "Erro ao salvar aluno";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (aluno: Aluno) => {
    setEditingAluno(aluno);
    setFormData({
      nome: aluno.nome,
      matricula: aluno.matricula,
      numero_pasta: aluno.numero_pasta || '',
      data_nascimento: aluno.data_nascimento || '',
      email: aluno.email || '',
      telefone: aluno.telefone || '',
      observacao: aluno.observacao || '',
      turma_id: aluno.turma_id || '',
      status: aluno.status,
      e_bolsista: aluno.e_bolsista || false
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este aluno?')) return;

    try {
      const { error } = await api
        .from('alunos')
        .eq('id', id)
        .delete();

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Aluno excluído com sucesso",
      });
      fetchAlunos();
    } catch (error: unknown) {
      console.error('Erro ao excluir aluno:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir aluno",
        variant: "destructive",
      });
    }
  };

  const handleCreateTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTurma.trim()) return;

    try {
      const { error } = await api
        .from('turmas')
        .insert([{ nome: novaTurma.trim() }]);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Nova turma criada com sucesso",
      });
      setNovaTurma('');
      setIsTurmaDialogOpen(false);
      fetchTurmas();
    } catch (error: unknown) {
      console.error('Erro ao criar turma:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar turma",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTurma = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir a turma "${nome}"?`)) return;
    setLoading(true);
    try {
      const { error } = await api.rpc('delete_turma', { turma_id: id, force: false });
      if (error) {
        const msg = String(error.message || '');
        if (msg.toLowerCase().includes('alunos vinculados')) {
          const ok = confirm(
            `A turma "${nome}" tem alunos vinculados.\n\nDeseja excluir mesmo assim? Os alunos ficarão sem turma.`
          );
          if (!ok) return;
          const { error: forceError } = await api.rpc('delete_turma', { turma_id: id, force: true });
          if (forceError) throw forceError;
        } else {
          throw error;
        }
      }

      if (filtroTurma === nome) setFiltroTurma("Todas");
      if (formData.turma_id === id) setFormData({ ...formData, turma_id: '' });

      toast({
        title: "Sucesso",
        description: "Turma excluída com sucesso",
      });
      fetchTurmas();
    } catch (error: unknown) {
      console.error('Erro ao excluir turma:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao excluir turma",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openMigracaoTurma = async (turma: Turma) => {
    setMigrateFromTurma(turma);
    setMigrateToTurmaId(sugerirTurmaDestinoId(turma));
    setMigrateAlunos([]);
    setMigrateSelectedIds([]);
    setMigrateDialogOpen(true);
    setMigrateLoading(true);
    try {
      const { data, error } = await api.functions.invoke('alunos_por_turma', {
        body: { turma_id: turma.id },
      });
      if (error) throw error;
      const list = (data as { alunos?: AlunoMigracao[] } | null)?.alunos ?? [];
      setMigrateAlunos(list);
    } catch (error: unknown) {
      console.error('Erro ao carregar alunos da turma:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao carregar alunos da turma",
        variant: "destructive",
      });
    } finally {
      setMigrateLoading(false);
    }
  };

  const toggleAlunoMigracao = (id: string) => {
    setMigrateSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const confirmarMigracao = async () => {
    if (!migrateFromTurma) return;
    if (!migrateToTurmaId) {
      toast({ title: "Erro", description: "Selecione a turma de destino", variant: "destructive" });
      return;
    }
    if (migrateSelectedIds.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos um aluno", variant: "destructive" });
      return;
    }
    const destino = turmas.find((t) => t.id === migrateToTurmaId);
    const ok = confirm(
      `Migrar ${migrateSelectedIds.length} aluno(s) da turma "${migrateFromTurma.nome}" para "${destino?.nome || 'turma selecionada'}"?`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const { data, error } = await api.rpc('migrar_alunos_turma', {
        from_turma_id: migrateFromTurma.id,
        to_turma_id: migrateToTurmaId,
        aluno_ids: migrateSelectedIds,
      });
      if (error) throw error;
      const moved = (data as { moved?: number } | null)?.moved ?? migrateSelectedIds.length;
      toast({
        title: "Sucesso",
        description: `${moved} aluno(s) migrado(s) com sucesso`,
      });
      setMigrateDialogOpen(false);
      setMigrateFromTurma(null);
      setMigrateToTurmaId('');
      setMigrateAlunos([]);
      setMigrateSelectedIds([]);
      fetchAlunos();
      fetchTurmas();
    } catch (error: unknown) {
      console.error('Erro ao migrar alunos:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao migrar alunos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAlunos = alunos.filter(aluno => {
    const matchesSearch = aluno.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aluno.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aluno.numero_pasta?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aluno.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTurma = filtroTurma === "Todas" || 
      aluno.turmas?.nome === filtroTurma;
    
    return matchesSearch && matchesTurma;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ativo': return 'default';
      case 'inativo': return 'secondary';
      case 'suspenso': return 'destructive';
      default: return 'outline';
    }
  };

  // Verificar permissão de acesso
  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Usuário normal tem acesso somente leitura
  const isReadOnly = !isAdmin;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        {!isReadOnly && (
          <div className="flex gap-2">
            <Dialog open={isTurmaDialogOpen} onOpenChange={setIsTurmaDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Turma
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Turma</DialogTitle>
                <DialogDescription>
                  Adicione uma nova turma ao sistema
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <form onSubmit={handleCreateTurma} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nova-turma">Nome da Turma</Label>
                  <Input
                    id="nova-turma"
                    value={novaTurma}
                    onChange={(e) => setNovaTurma(e.target.value)}
                    placeholder="Ex: Técnico em Informática - 1º Ano"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Criar Turma
                </Button>
                </form>

                <div className="space-y-2">
                  <Label>Turmas cadastradas</Label>
                  <ScrollArea className="h-48 rounded-md border">
                    <div className="p-2 space-y-1">
                      {turmas.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-2">Nenhuma turma cadastrada</div>
                      ) : (
                        turmas.map((turma) => (
                          <div key={turma.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted">
                            <div className="text-sm">{turma.nome}</div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openMigracaoTurma(turma)}
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTurma(turma.id, turma.nome)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={migrateDialogOpen} onOpenChange={(open) => {
            setMigrateDialogOpen(open);
            if (!open) {
              setMigrateFromTurma(null);
              setMigrateToTurmaId('');
              setMigrateAlunos([]);
              setMigrateSelectedIds([]);
            }
          }}>
            <DialogContent className="w-full sm:max-w-xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Migrar Alunos</DialogTitle>
                <DialogDescription>
                  Selecione a turma de destino e os alunos que deseja migrar
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Turma de origem</Label>
                  <Input value={migrateFromTurma?.nome || ''} disabled />
                </div>

                <div className="space-y-2">
                  <Label>Turma de destino</Label>
                  <select
                    value={migrateToTurmaId}
                    onChange={(e) => setMigrateToTurmaId(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Selecione...</option>
                    {turmas
                      .filter((t) => t.id !== migrateFromTurma?.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Alunos ({migrateSelectedIds.length}/{migrateAlunos.length})</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMigrateSelectedIds(migrateAlunos.map((a) => a.id))}
                      disabled={migrateLoading || migrateAlunos.length === 0}
                    >
                      Selecionar todos
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMigrateSelectedIds([])}
                      disabled={migrateLoading || migrateSelectedIds.length === 0}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-64 rounded-md border">
                  <div className="p-2 space-y-1">
                    {migrateLoading ? (
                      <div className="text-sm text-muted-foreground p-2">Carregando...</div>
                    ) : migrateAlunos.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-2">Nenhum aluno encontrado nesta turma</div>
                    ) : (
                      migrateAlunos.map((a) => (
                        <label key={a.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={migrateSelectedIds.includes(a.id)}
                            onChange={() => toggleAlunoMigracao(a.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{a.nome}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {a.matricula}{a.numero_pasta ? ` • Pasta ${a.numero_pasta}` : ''}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>

                <Button
                  type="button"
                  className="w-full"
                  onClick={confirmarMigracao}
                  disabled={loading || migrateLoading}
                >
                  Migrar selecionados
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingAluno(null);
              setFormData({
                nome: '',
                matricula: '',
                numero_pasta: '',
                data_nascimento: '',
                email: '',
                telefone: '',
                observacao: '',
                turma_id: '',
                status: 'ativo',
                e_bolsista: false
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Aluno
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full sm:max-w-xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingAluno ? 'Editar Aluno' : 'Cadastrar Novo Aluno'}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados do aluno
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="matricula">Matrícula (12 dígitos) *</Label>
                    <Input
                      id="matricula"
                      value={formData.matricula}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                        setFormData({...formData, matricula: value});
                      }}
                      maxLength={12}
                      required
                      placeholder="000000000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero_pasta">Número da Pasta (4 dígitos) *</Label>
                    <Input
                      id="numero_pasta"
                      value={formData.numero_pasta}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setFormData({...formData, numero_pasta: value});
                      }}
                      maxLength={4}
                      required
                      placeholder="0000"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                    <Input
                      id="data_nascimento"
                      type="date"
                      value={formData.data_nascimento}
                      onChange={(e) => setFormData({...formData, data_nascimento: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="turma">Turma</Label>
                    <select
                      id="turma"
                      value={formData.turma_id}
                      onChange={(e) => setFormData({ ...formData, turma_id: e.target.value })}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecione uma turma</option>
                      {turmas.map((turma) => (
                        <option key={turma.id} value={turma.id}>
                          {turma.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                      <option value="suspenso">Suspenso</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e_bolsista">É Bolsista?</Label>
                    <select
                      id="e_bolsista"
                      value={formData.e_bolsista ? "sim" : "nao"}
                      onChange={(e) => setFormData({ ...formData, e_bolsista: e.target.value === "sim" })}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="nao">Não</option>
                      <option value="sim">Sim</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacao">Observação</Label>
                  <Textarea
                    id="observacao"
                    value={formData.observacao}
                    onChange={(e) => setFormData({...formData, observacao: e.target.value})}
                    placeholder="Observações sobre o aluno"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Salvando...' : (editingAluno ? 'Atualizar Aluno' : 'Cadastrar Aluno')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Alunos</CardTitle>
          <CardDescription>
            {alunos.length} aluno(s) cadastrado(s)
          </CardDescription>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, matrícula ou e-mail"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <select
              value={filtroTurma}
              onChange={(e) => setFiltroTurma(e.target.value)}
              className="flex h-10 w-[200px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="Todas">Todas as Turmas</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.nome}>
                  {turma.nome}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Nº Pasta</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlunos.map((aluno) => (
                  <TableRow key={aluno.id}>
                    <TableCell className="font-medium">{aluno.nome}</TableCell>
                    <TableCell>{aluno.matricula}</TableCell>
                    <TableCell className="font-mono">{aluno.numero_pasta || '-'}</TableCell>
                    <TableCell>{aluno.turmas?.nome || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(aluno.status)}>
                        {aluno.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {!isReadOnly ? (
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(aluno)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(aluno.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Somente leitura</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default Alunos;
