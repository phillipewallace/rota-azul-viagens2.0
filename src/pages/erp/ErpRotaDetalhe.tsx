/**
 * ERP → detalhe de uma Rota ("entrar dentro do card").
 * Rota /erp/rotas/:id — mostra o mapa da rota no Google Maps e a lista
 * organizada dos Pontos com CRUD completo, reordenação e geração de PDF.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, PlusCircle, FileDown, Edit, Trash2,
  Building2, Phone, Bath, Droplets, CircleDot, FileText, ArrowUp, ArrowDown,
  ListOrdered, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rota, Ponto } from '@/types/rota';
import { useRotas } from '@/hooks/useRotas';
import ErpRotaMap from '@/components/erp/ErpRotaMap';
import ErpRotaForm, { RotaFormData } from '@/components/erp/ErpRotaForm';
import ErpPontoForm, { PontoFormData } from '@/components/erp/ErpPontoForm';
import { rotaPdfGenerator } from '@/utils/rotasPdf';
import { confirmDialog } from '@/lib/confirm';
import { toast } from 'sonner';

const ErpRotaDetalhe: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    routes, loading, error,
    updateRoute, deleteRoute,
    addPonto, updatePonto, deletePonto, movePonto,
  } = useRotas();

  const rota = useMemo(() => routes.find((r) => r.id === id) || null, [routes, id]);

  const [isSaving, setIsSaving] = useState(false);

  // Modal de rota (editar nome/status)
  const [isRotaFormOpen, setIsRotaFormOpen] = useState(false);

  // Modal de ponto (novo/editar)
  const [isPontoFormOpen, setIsPontoFormOpen] = useState(false);
  const [editingPonto, setEditingPonto] = useState<Ponto | null>(null);

  // ===== Ações da rota =====
  const handleSaveRota = async (data: RotaFormData) => {
    if (!rota) return;
    setIsSaving(true);
    try {
      await updateRoute(rota.id, data);
      toast.success('Rota atualizada com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar rota');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRota = async () => {
    if (!rota) return;
    const ok = await confirmDialog({
      title: 'Excluir rota',
      description: `Excluir a rota "${rota.name}" e todos os seus pontos? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
    });
    if (!ok) return;
    try {
      await deleteRoute(rota.id);
      toast.success('Rota excluída com sucesso!');
      navigate('/erp/rotas');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir rota');
    }
  };

  const handleGeneratePdf = async () => {
    if (!rota) return;
    try {
      await rotaPdfGenerator.generateRotaPdf(rota, rota.name);
      toast.success('PDF gerado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar PDF');
    }
  };

  // ===== Ações de pontos =====
  const handleAddPonto = () => {
    setEditingPonto(null);
    setIsPontoFormOpen(true);
  };

  const handleEditPonto = (ponto: Ponto) => {
    setEditingPonto(ponto);
    setIsPontoFormOpen(true);
  };

  const handleSavePonto = async (data: PontoFormData) => {
    if (!rota) return;
    setIsSaving(true);
    try {
      if (editingPonto) {
        await updatePonto(rota.id, editingPonto.id, data);
      } else {
        await addPonto(rota.id, data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar ponto');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePonto = async (ponto: Ponto) => {
    if (!rota) return;
    const ok = await confirmDialog({
      title: 'Excluir ponto',
      description: `Excluir o ponto "${ponto.company}" desta rota?`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
    });
    if (!ok) return;
    try {
      await deletePonto(rota.id, ponto.id);
      toast.success('Ponto excluído!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir ponto');
    }
  };

  const handleMovePonto = (ponto: Ponto, direction: 'up' | 'down') => {
    if (!rota) return;
    movePonto(rota.id, ponto.id, direction).catch((err: any) =>
      toast.error(err.message || 'Erro ao mover ponto')
    );
  };

  // ===== Estados de carregamento / não encontrada =====
  if (loading && routes.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-16 text-slate-400">
          Carregando rota...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
        <BackButton onClick={() => navigate('/erp/rotas')} />
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!rota) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
        <BackButton onClick={() => navigate('/erp/rotas')} />
        <div className="text-center py-16">
          <AlertTriangle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Rota não encontrada.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/erp/rotas')}>
            Voltar para Rotas
          </Button>
        </div>
      </div>
    );
  }

  const statusColor = {
    ativa: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    inativa: 'bg-amber-100 text-amber-800 border-amber-200',
    concluida: 'bg-blue-100 text-blue-800 border-blue-200',
  } as const;

  const statusLabel = rota.status === 'ativa' ? 'Ativa' :
    rota.status === 'inativa' ? 'Inativa' : 'Concluída';

  const pontoCount = rota.pontos.length;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Barra superior: voltar + ações */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <BackButton onClick={() => navigate('/erp/rotas')} />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRotaFormOpen(true)}
            className="h-9"
          >
            <Edit className="h-4 w-4 mr-1.5" /> Editar rota
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGeneratePdf}
            className="h-9"
          >
            <FileDown className="h-4 w-4 mr-1.5" /> Gerar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteRota}
            className="h-9 text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
          </Button>
        </div>
      </div>

      {/* Cabeçalho da rota */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center text-white shadow-lg flex-shrink-0">
            <MapPin className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{rota.name}</h1>
              <Badge className={`border ${statusColor[rota.status]}`}>{statusLabel}</Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
              <ListOrdered className="h-4 w-4" />
              {pontoCount === 0
                ? 'Nenhum ponto adicionado'
                : `${pontoCount} ponto${pontoCount > 1 ? 's' : ''} na rota`}
              <span className="text-slate-400 hidden sm:inline">
                · criada em {new Date(rota.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Mapa da rota (Google Maps) */}
      <div className="mb-5">
        <ErpRotaMap rota={rota} />
      </div>

      {/* Lista de pontos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-700">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Pontos da rota</span>
          </div>
          <Button size="sm" onClick={handleAddPonto} className="h-9">
            <PlusCircle className="h-4 w-4 mr-1.5" /> Adicionar Ponto
          </Button>
        </div>

        {pontoCount === 0 ? (
          <div className="px-5 py-10 text-center">
            <Building2 className="h-9 w-9 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-1">Nenhum ponto nesta rota ainda.</p>
            <p className="text-xs text-slate-400">
              Adicione o primeiro ponto para começar a montar a rota.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rota.pontos.map((ponto, index) => (
              <li key={ponto.id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Número da ordem */}
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {ponto.company}
                        </h3>
                        <p className="text-sm text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          {ponto.address}
                        </p>
                      </div>

                      {/* Ações do ponto */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button
                          variant="ghost" size="sm" disabled={index === 0}
                          onClick={() => handleMovePonto(ponto, 'up')}
                          className="h-7 w-7 p-0" aria-label="Mover ponto para cima"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" disabled={index === pontoCount - 1}
                          onClick={() => handleMovePonto(ponto, 'down')}
                          className="h-7 w-7 p-0" aria-label="Mover ponto para baixo"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleEditPonto(ponto)}
                          className="h-7 w-7 p-0" aria-label="Editar ponto"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleDeletePonto(ponto)}
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          aria-label="Excluir ponto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Chips de detalhes */}
                    {(ponto.cleaning || ponto.bathrooms || (ponto as any).toilets || (ponto as any).pieces || ponto.contact ||
                      ponto.sanitarioNumber || ponto.model || ponto.color) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {ponto.cleaning && (
                          <Chip icon={<Droplets className="h-3 w-3" />} label={ponto.cleaning} />
                        )}
                        {ponto.bathrooms && (
                          <Chip icon={<Bath className="h-3 w-3" />} label={`${ponto.bathrooms} banheiro(s)`} />
                        )}
                        {(ponto as any).toilets && (
                          <Chip icon={<Bath className="h-3 w-3" />} label={`${(ponto as any).toilets} sanitário(s)`} />
                        )}
                        {(ponto as any).pieces && (
                          <Chip icon={<ListOrdered className="h-3 w-3" />} label={`${(ponto as any).pieces} peça(s)`} />
                        )}
                        {ponto.contact && (
                          <Chip icon={<Phone className="h-3 w-3" />} label={ponto.contact} />
                        )}
                        {ponto.sanitarioNumber && (
                          <Chip icon={<CircleDot className="h-3 w-3" />} label={`Sanitário nº ${ponto.sanitarioNumber}`} />
                        )}
                        {ponto.model && (
                          <Chip icon={<ListOrdered className="h-3 w-3" />} label={ponto.model} />
                        )}
                        {ponto.color && (
                          <Chip icon={<span className="text-[10px]">🎨</span>} label={ponto.color} />
                        )}
                      </div>
                    )}

                    {/* Observação */}
                    {ponto.observation && (
                      <div className="mt-2 flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <FileText className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 whitespace-pre-wrap">
                          {ponto.observation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>


      {/* Modal de rota (editar nome/status) */}
      <ErpRotaForm
        open={isRotaFormOpen}
        onOpenChange={setIsRotaFormOpen}
        rota={rota}
        onSave={handleSaveRota}
        isLoading={isSaving}
      />

      {/* Modal de ponto (novo/editar) */}
      <ErpPontoForm
        open={isPontoFormOpen}
        onOpenChange={setIsPontoFormOpen}
        ponto={editingPonto}
        rotaName={rota.name}
        onSave={handleSavePonto}
        isLoading={isSaving}
      />
    </div>
  );
};

/** Botão "Voltar" reutilizável no topo da página. */
const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
  >
    <ArrowLeft className="h-4 w-4" /> Voltar para Rotas
  </button>
);

/** Chip pequeno de detalhe do ponto. */
const Chip: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">
    {icon}
    <span className="max-w-[180px] truncate">{label}</span>
  </span>
);

export default ErpRotaDetalhe;
