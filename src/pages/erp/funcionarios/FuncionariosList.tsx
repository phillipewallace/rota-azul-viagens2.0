import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
    Users, Search, Plus, UserCircle, Phone, 
    Mail, Edit2, Trash2, Power, UserMinus 
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/config';

interface Funcionario {
    id: string;
    nome: string;
    cpf: string;
    telefone?: string;
    email?: string;
    tipo: string;
    active: boolean;
    created_at?: string;
}

const formatCPF = (v: string) => {
    v = v.replace(/\D/g, '');
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return v;
};

const FuncionariosList = () => {
    const [list, setList] = useState<Funcionario[]>([]);
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Funcionario | null>(null);
    const [loading, setLoading] = useState(false);
    
    const load = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_BASE_URL}/erp/funcionarios`, {
                headers: { Authorization: token ? `Bearer ${token}` : '' }
            });
            const json = await res.json();
            const data = Array.isArray(json) ? json : [];
            setList(data);
            const statsEl = document.querySelector('#stats-total-funcionarios p.text-2xl');
            if (statsEl) statsEl.textContent = String(data.length);
        } catch (e) { 
            console.error(e);
            toast.error('Erro ao carregar funcionários'); 
        }
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (id: string) => {
        const choice = confirm(
            'ESCOLHA O TIPO DE EXCLUSÃO:\n\n' +
            'CANCELAR: Não faz nada.\n' +
            'OK: INATIVAR (recomendado para manter histórico).\n\n' +
            'Para EXCLUSÃO DEFINITIVA (remover do banco), clique em OK e depois confirme o aviso de segurança.'
        );
        
        if (!choice) return;

        const isPermanent = confirm('⚠️ AVISO: Deseja EXCLUIR DEFINITIVAMENTE do banco de dados? Esta ação não pode ser desfeita e falhará se o funcionário tiver OS vinculadas.');

        try {
            const token = localStorage.getItem('auth_token');
            const url = `${API_BASE_URL}/erp/funcionarios/${id}${isPermanent ? '?permanent=true' : ''}`;
            const res = await fetch(url, {
                method: 'DELETE',
                headers: { Authorization: token ? `Bearer ${token}` : '' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro na operação');
            toast.success(isPermanent ? 'Funcionário removido permanentemente' : 'Funcionário inativado');
            load();
        } catch (e: any) { 
            toast.error(e.message || 'Erro ao processar exclusão'); 
        }
    };

    const handleToggleStatus = async (f: Funcionario) => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_BASE_URL}/erp/funcionarios/${f.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: token ? `Bearer ${token}` : '' 
                },
                body: JSON.stringify({ ...f, active: !f.active })
            });
            if (!res.ok) throw new Error();
            toast.success(`Funcionário ${!f.active ? 'ativado' : 'inativado'}`);
            load();
        } catch { toast.error('Erro ao alterar status'); }
    };

    const filtered = list.filter(f => 
        f.nome.toLowerCase().includes(search.toLowerCase()) || 
        f.cpf.includes(search.replace(/\D/g, ''))
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
                    <Plus className="h-4 w-4" /> Novo Funcionário
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(f => (
                    <Card key={f.id} className={`hover:shadow-md transition-shadow ${!f.active ? 'opacity-60 bg-muted/50' : ''}`}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <UserCircle className="h-8 w-8 text-muted-foreground" />
                                    <div>
                                        <CardTitle className="text-sm font-semibold">{f.nome}</CardTitle>
                                        <p className="text-xs text-muted-foreground">{f.tipo.toUpperCase()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(f); setOpen(true); }}>
                                        <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => handleDelete(f.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-2 text-xs space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold w-12 text-muted-foreground">CPF:</span> 
                                        {f.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                                    </div>
                                    {f.telefone && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-3 w-3 text-muted-foreground" /> {f.telefone}
                                        </div>
                                    )}
                                    {f.email && (
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-3 w-3 text-muted-foreground" /> {f.email}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="pt-2 border-t flex justify-between items-center">
                                <Badge variant={f.active ? 'default' : 'secondary'} className="text-[10px]">
                                    {f.active ? 'Ativo' : 'Inativo'}
                                </Badge>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className={`h-7 px-2 text-[10px] gap-1 ${f.active ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                                    onClick={() => handleToggleStatus(f)}
                                >
                                    {f.active ? <UserMinus className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                                    {f.active ? 'Inativar' : 'Ativar'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Editar Funcionário' : 'Cadastrar Novo Funcionário'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        setLoading(true);
                        const formData = new FormData(e.currentTarget);
                        const payload = Object.fromEntries(formData);
                        
                        try {
                            const token = localStorage.getItem('auth_token');
                            const url = editing ? `${API_BASE_URL}/erp/funcionarios/${editing.id}` : `${API_BASE_URL}/erp/funcionarios`;
                            const method = editing ? 'PUT' : 'POST';
                            
                            const res = await fetch(url, {
                                method,
                                headers: { 
                                    'Content-Type': 'application/json',
                                    Authorization: token ? `Bearer ${token}` : '' 
                                },
                                body: JSON.stringify({
                                    ...payload,
                                    active: editing ? editing.active : true
                                })
                            });
                            
                            if (!res.ok) throw new Error();
                            toast.success(editing ? 'Dados atualizados!' : 'Funcionário cadastrado!');
                            setOpen(false);
                            load();
                        } catch { 
                            toast.error(editing ? 'Erro ao atualizar' : 'Erro ao cadastrar'); 
                        } finally {
                            setLoading(false);
                        }
                    }} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome Completo</label>
                            <Input name="nome" required defaultValue={editing?.nome} placeholder="Ex: João Silva" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">CPF</label>
                                <Input 
                                    name="cpf" 
                                    required 
                                    disabled={!!editing}
                                    defaultValue={editing?.cpf ? formatCPF(editing.cpf) : ''}
                                    placeholder="000.000.000-00"
                                    onChange={(e) => e.target.value = formatCPF(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tipo</label>
                                <select 
                                    name="tipo" 
                                    defaultValue={editing?.tipo || 'motorista'}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
                                    required
                                >
                                    <option value="motorista">Motorista</option>
                                    <option value="ajudante">Ajudante</option>
                                    <option value="operador">Operador</option>
                                    <option value="administrativo">Administrativo</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Telefone</label>
                                <Input name="telefone" defaultValue={editing?.telefone} placeholder="(00) 00000-0000" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">E-mail</label>
                                <Input name="email" type="email" defaultValue={editing?.email} placeholder="email@exemplo.com" />
                            </div>
                        </div>
                        
                        {!editing && (
                            <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg space-y-1">
                                <p className="text-[11px] font-bold text-primary uppercase">Configurações de Acesso</p>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                    Login: <span className="font-bold text-foreground">CPF (apenas números)</span><br/>
                                    Senha Inicial: <span className="font-bold text-foreground">1234</span>
                                </p>
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Cadastrar'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FuncionariosList;