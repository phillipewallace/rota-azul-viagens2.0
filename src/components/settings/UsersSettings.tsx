/**
 * Gestão de Usuários — visível somente para o super-admin (phillipe.sodre).
 * Permite criar/editar/desativar/excluir contas de funcionários.
 */
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Users, Plus, Pencil, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usersService, type AppUser } from '@/services/users';

const ADMIN_USERNAME = 'phillipe.sodre';

const UsersSettings: React.FC = () => {
  const [list, setList] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);

  const load = async () => {
    setLoading(true);
    try { setList(await usersService.list()); }
    catch (e: any) { toast.error(e.message || 'Erro ao carregar usuários'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async () => {
    if (!deleting) return;
    try {
      await usersService.remove(deleting.id);
      toast.success('Usuário removido');
      setDeleting(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-600" /> Gestão de Usuários
          <Badge variant="outline" className="ml-2 text-[10px]">super-admin</Badge>
        </CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setOpenForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo usuário
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…
                </TableCell></TableRow>
              )}
              {!loading && list.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum usuário.</TableCell></TableRow>
              )}
              {list.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.username}</TableCell>
                  <TableCell>{u.name || '—'}</TableCell>
                  <TableCell className="text-xs">{u.email || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{u.role || 'user'}</Badge></TableCell>
                  <TableCell>
                    {u.active
                      ? <Badge className="bg-emerald-600">Ativo</Badge>
                      : <Badge variant="secondary">Inativo</Badge>}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(u); setOpenForm(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {u.username !== ADMIN_USERNAME && (
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleting(u)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <UserFormDialog
          open={openForm}
          editing={editing}
          onClose={() => { setOpenForm(false); setEditing(null); }}
          onSaved={async () => { setOpenForm(false); setEditing(null); await load(); }}
        />

        <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir usuário {deleting?.username}?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação é permanente.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

function UserFormDialog({
  open, editing, onClose, onSaved,
}: { open: boolean; editing: AppUser | null; onClose: () => void; onSaved: () => void; }) {
  const [form, setForm] = useState({ username: '', password: '', name: '', email: '', role: 'user', active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setForm({
      username: editing.username, password: '', name: editing.name || '',
      email: editing.email || '', role: editing.role || 'user', active: editing.active,
    });
    else setForm({ username: '', password: '', name: '', email: '', role: 'user', active: true });
  }, [editing, open]);

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await usersService.update(editing.id, {
          password: form.password || undefined,
          name: form.name, email: form.email, role: form.role, active: form.active,
        });
        toast.success('Usuário atualizado');
      } else {
        if (!form.username.trim() || !form.password.trim()) {
          toast.error('Usuário e senha são obrigatórios'); setSaving(false); return;
        }
        await usersService.create(form);
        toast.success('Usuário criado');
      }
      onSaved();
    } catch (e: any) { toast.error(e.message || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar ${editing.username}` : 'Novo usuário'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Usuário (login)</Label>
            <Input value={form.username} disabled={!!editing}
              onChange={(e) => setForm(f => ({ ...f, username: e.target.value.toLowerCase().trim() }))} />
          </div>
          <div>
            <Label>{editing ? 'Nova senha (deixe vazio para manter)' : 'Senha'}</Label>
            <Input type="text" value={form.password}
              onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Papel</Label>
              <SearchableSelect
                value={form.role}
                onValueChange={(v) => setForm(f => ({ ...f, role: v }))}
                placeholder="Papel"
                options={[
                  { value: 'user', label: 'Usuário' },
                  { value: 'manager', label: 'Gerente' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
            </div>
            <div className="flex items-end gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm(f => ({ ...f, active: v }))} />
              <Label className="mb-2">Ativo</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UsersSettings;
