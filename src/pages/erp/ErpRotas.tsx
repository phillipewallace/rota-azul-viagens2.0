/**
 * Página principal da aba "Rotas" no ERP.
 * Exibe as rotas como cards; cada card expande mostrando os pontos
 * (empresas/paradas) com CRUD completo, reordenação e geração de PDF.
 */
import React, { useState } from 'react';
import { PlusCircle, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rota, Ponto } from '@/types/rota';
import { useRotas } from '@/hooks/useRotas';
import ErpRotaCard from '@/components/erp/ErpRotaCard';
import ErpRotaForm, { RotaFormData } from '@/components/erp/ErpRotaForm';
import ErpPontoForm, { PontoFormData } from '@/components/erp/ErpPontoForm';
import { rotaPdfGenerator } from '@/utils/rotasPdf';
import { toast } from 'sonner';

const ErpRotas: React.FC = () => {
  const {
    routes, loading, error,
    createRoute, updateRoute, deleteRoute, moveRoute,
    addPonto, updatePonto, deletePonto, movePonto,
  } = useRotas();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Modal de rota (novo/editar)
  const [isRotaFormOpen, setIsRotaFormOpen] = useState(false);
  const [editingRota, setEditingRota] = useState<Rota | null>(null);

  // Modal de ponto (novo/editar) — sempre dentro de uma rota pai
  const [isPontoFormOpen, setIsPontoFormOpen] = useState(false);
  const [pontoRota, setPontoRota] = useState<Rota | null>(null);
  const [editingPonto, setEditingPonto] = useState<Ponto | null>(null);

  // Filtro de busca (nome da rota ou qualquer ponto dela)
  const filteredRoutes = routes.filter((r) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    if (r.name.toLowerCase().includes(term)) return true;
    return r.pontos.some(
      (p) =>
        p.company.toLowerCase().includes(term) ||
        p.address.toLowerCase().includes(term)
    );
  });

  // ===== Rotas =====
  const handleNewRota = () => {
    setEditingRota(null);
    setIsRotaFormOpen(true);
  };

  const handleEditRota = (rota: Rota) => {
    setEditingRota(rota);
    setIsRotaFormOpen(true);
  };

  const handleSaveRota = async (data: RotaFormData) => {
    setIsSaving(true);
    try {
      if (editingRota) {
        await updateRoute(editingRota.id, data);
      } else {
        await createRoute(data);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRota = async (id: string) => {
    try {
      await deleteRoute(id);
      toast.success('Rota excluída com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir rota');
    }
  };

  const handleMoveRota = (id: string, direction: 'up' | 'down') => {
    moveRoute(id, direction).catch((err: any) =>
      toast.error(err.message || 'Erro ao mover rota')
    );
  };

  // ===== Pontos =====
  const handleAddPonto = (rota: Rota) => {
    setPontoRota(rota);
    setEditingPonto(null);
    setIsPontoFormOpen(true);
  };

  const handleEditPonto = (rota: Rota, ponto: Ponto) => {
    setPontoRota(rota);
    setEditingPonto(ponto);
    setIsPontoFormOpen(true);
  };

  const handleSavePonto = async (data: PontoFormData) => {
    if (!pontoRota) return;
    setIsSaving(true);
    try {
      if (editingPonto) {
        await updatePonto(pontoRota.id, editingPonto.id, data);
      } else {
        await addPonto(pontoRota.id, data);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePonto = async (rotaId: string, pontoId: string) => {
    try {
      await deletePonto(rotaId, pontoId);
      toast.success('Ponto excluído com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir ponto');
    }
  };

  const handleMovePonto = (rotaId: string, pontoId: string, direction: 'up' | 'down') => {
    movePonto(rotaId, pontoId, direction).catch((err: any) =>
      toast.error(err.message || 'Erro ao mover ponto')
    );
  };

  // ===== PDF =====
  const handleGeneratePdf = (rota: Rota) => {
    try {
      rotaPdfGenerator.generateRotaPdf(rota, rota.name);
      toast.success('PDF gerado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar PDF');
    }
  };

  const handleToggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rotas</h1>
          <p className="text-slate-500 text-sm mt-1">
            Crie uma rota (ex.: Centro Barreiro), adicione os pontos dentro dela e gere o PDF.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Input
              placeholder="Buscar rota ou ponto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8"
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
              <LayoutDashboard className="h-4 w-4" />
            </div>
          </div>
          <Button
            onClick={handleNewRota}
            className="bg-gradient-to-r from-primary to-primary-700 hover:from-primary/90 hover:to-primary-600"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> Nova Rota
          </Button>
        </div>
      </div>

      {/* Mensagens de estado */}
      {loading && routes.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-400">Carregando rotas...</div>
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : filteredRoutes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">
            {search
              ? 'Nenhuma rota encontrada'
              : 'Nenhuma rota criada. Clique em "Nova Rota" para começar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRoutes.map((rota) => (
            <ErpRotaCard
              key={rota.id}
              rota={rota}
              expanded={expandedId === rota.id}
              onToggle={() => handleToggle(rota.id)}
              onEdit={handleEditRota}
              onDelete={handleDeleteRota}
              onMove={handleMoveRota}
              onPdf={handleGeneratePdf}
              onAddPonto={handleAddPonto}
              onEditPonto={handleEditPonto}
              onDeletePonto={handleDeletePonto}
              onMovePonto={handleMovePonto}
            />
          ))}
        </div>
      )}

      {/* Modal de rota (nome + status) */}
      <ErpRotaForm
        open={isRotaFormOpen}
        onOpenChange={setIsRotaFormOpen}
        rota={editingRota}
        onSave={handleSaveRota}
        isLoading={isSaving}
      />

      {/* Modal de ponto (dentro da rota pai) */}
      <ErpPontoForm
        open={isPontoFormOpen}
        onOpenChange={setIsPontoFormOpen}
        ponto={editingPonto}
        rotaName={pontoRota?.name || ''}
        onSave={handleSavePonto}
        isLoading={isSaving}
      />
    </div>
  );
};

export default ErpRotas;

