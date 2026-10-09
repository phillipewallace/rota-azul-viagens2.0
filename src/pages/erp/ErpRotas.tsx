/**
 * Página principal da aba "Rotas" no ERP — SEM card expansível.
 * Lista os cards; clicar entra "dentro do card" (/erp/rotas/:id),
 * onde ficam o mapinha do Google Maps + os pontos organizados.
 * Aqui ficam apenas: buscar, criar/editar rota, mover, excluir e gerar PDF.
 */
import React, { useState } from 'react';
import { PlusCircle, LayoutDashboard, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rota } from '@/types/rota';
import { useRotas } from '@/hooks/useRotas';
import ErpRotaCard from '@/components/erp/ErpRotaCard';
import ErpRotaForm, { RotaFormData } from '@/components/erp/ErpRotaForm';
import ErpRotaImportDialog from '@/components/erp/ErpRotaImportDialog';
import { ParsedRota } from '@/utils/rotasExcelParser';
import { rotaPdfGenerator } from '@/utils/rotasPdf';
import { toast } from 'sonner';

const ErpRotas: React.FC = () => {
  const {
    routes, loading, error,
    createRoute, updateRoute, deleteRoute, moveRoute, importRotas,
  } = useRotas();

  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Modal de rota (novo/editar)
  const [isRotaFormOpen, setIsRotaFormOpen] = useState(false);
  const [editingRota, setEditingRota] = useState<Rota | null>(null);

  // Modal de importação do Excel (cada aba = uma rota)
  const [isImportOpen, setIsImportOpen] = useState(false);

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

  const handleGeneratePdf = async (rota: Rota) => {
    try {
      rotaPdfGenerator.generateRotaPdf(rota, rota.name);
      toast.success('PDF gerado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar PDF');
    }
  };

  // ===== Importação do Excel (cada aba = uma rota) =====
  const handleImportExcel = async (parsed: ParsedRota[]) => {
    const created = await importRotas(
      parsed.map((r) => ({ name: r.name, status: r.status, pontos: r.pontos })),
    );
    const skipped = parsed.length - created.length;
    if (created.length === 0) {
      toast.error('Nenhuma rota válida para importar (abas sem pontos foram ignoradas)');
      return;
    }
    const totalPontos = created.reduce((s, r) => s + r.pontos.length, 0);
    toast.success(
      `${created.length} ${created.length === 1 ? 'rota importada' : 'rotas importadas'} com ${totalPontos} ${totalPontos === 1 ? 'ponto' : 'pontos'}!` +
      (skipped > 0 ? ` (${skipped} ${skipped === 1 ? 'aba ignorada' : 'abas ignoradas'} sem pontos)` : ''),
    );
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
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            title="Importar rotas de uma planilha (cada aba vira uma rota)"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Importar Excel
          </Button>
          <Button
            onClick={handleNewRota}
            className="bg-gradient-to-r from-primary to-primary-700 hover:from-primary/90 hover:to-primary-600"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> Nova Rota
          </Button>
        </div>
      </div>

      {/* Estados */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRoutes.map((rota, index) => (
            <ErpRotaCard
              key={rota.id}
              rota={rota}
              index={index}
              total={filteredRoutes.length}
              onEdit={handleEditRota}
              onDelete={handleDeleteRota}
              onMove={handleMoveRota}
              onPdf={handleGeneratePdf}
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

      {/* Modal de importação do Excel */}
      <ErpRotaImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleImportExcel}
      />
    </div>
  );
};

export default ErpRotas;
