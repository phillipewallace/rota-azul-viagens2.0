/**
 * Página principal da aba "Rotas" no ERP.
 * Exibe a lista de rotas como cards, com expansão para detalhes,
 * adição/edição/exclusão, reordenação e geração de PDF.
 */
import React, { useState, useCallback } from 'react';
import { Plus, FileDown, Edit, Trash2, PlusCircle, LayoutDashboard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Rota } from '@/types/rota';
import { useRotas } from '@/hooks/useRotas';
import ErpRotaCard from '@/components/erp/ErpRotaCard';
import ErpRotaForm from '@/components/erp/ErpRotaForm';
import { rotaPdfGenerator } from '@/utils/rotasPdf';
import { toast } from 'sonner';

const ErpRotas: React.FC = () => {
  const { routes, loading, error, createRoute, updateRoute, deleteRoute, moveRoute } = useRotas();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRota, setEditingRota] = useState<Rota | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Filtro de busca
  const filteredRoutes = routes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.company.toLowerCase().includes(search.toLowerCase()) ||
    r.address.toLowerCase().includes(search.toLowerCase())
  );

  // Abrir modal de novo
  const handleNew = () => {
    setEditingRota(null);
    setIsFormOpen(true);
  };

  // Abrir modal de edição
  const handleEdit = (rota: Rota) => {
    setEditingRota(rota);
    setIsFormOpen(true);
  };

  // Salvar rota
  const handleSave = async (data: Omit<Rota, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingRota) {
      await updateRoute(editingRota.id, data);
    } else {
      await createRoute(data);
    }
  };

  // Excluir rota
  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      await deleteRoute(id);
      toast.success('Rota excluída com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir rota');
    } finally {
      setIsDeleting(null);
    }
  };

  // Alternar expansão do card
  const handleToggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Mover rota
  const handleMove = (id: string, direction: 'up' | 'down') => {
    try {
      moveRoute(id, direction);
      toast.success(`Rota movida para ${direction === 'up' ? 'cima' : 'baixo'}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao mover rota');
    }
  };

  // Gerar PDF
  const handleGeneratePdf = async (rota: Rota) => {
    try {
      setIsGeneratingPdf(true);
      rotaPdfGenerator.generateRotaPdf(rota, 'Rota de Entrega');
      toast.success('PDF gerado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rotas</h1>
          <p className="text-slate-500 text-sm mt-1">
            Gerencie as rotas de entrega/limpeza com detalhes completos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Input
              placeholder="Buscar rota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8"
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
              <LayoutDashboard className="h-4 w-4" />
            </div>
          </div>
          <Button
            onClick={handleNew}
            className="bg-gradient-to-r from-primary to-primary-700 hover:from-primary/90 hover:to-primary-600"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> Nova Rota
          </Button>
        </div>
      </div>

      {/* Mensagem de carregamento */}
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
          <p className="text-slate-400">Nenhuma rota encontrada</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRoutes.map((rota) => (
            <ErpRotaCard
              key={rota.id}
              rota={rota}
              expanded={expandedId === rota.id}
              onToggle={() => handleToggle(rota.id)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onMove={handleMove}
            />
          ))}
        </div>
      )
      }

      {/* Modal de formulário */}
      <ErpRotaForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        rota={editingRota}
        onSave={handleSave}
        isLoading={false}
      />
    </div>
  );
};

export default ErpRotas;