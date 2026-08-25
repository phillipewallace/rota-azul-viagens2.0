
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Link as LinkIcon, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/PageHeader';
import { useTrucks } from '@/hooks/useTrucks';
import { useTrucksCRUD } from '@/hooks/useTrucksCRUD';
import { TruckModal } from '@/components/TruckModal';
import { LinkRouteModal } from '@/components/LinkRouteModal';
import { Truck as TruckType } from '@/hooks/useTrucks';

import { confirmDialog } from '@/lib/confirm';
const Trucks = () => {
  const { toast } = useToast();
  const [editingTruck, setEditingTruck] = useState<TruckType | null>(null);
  const [showTruckModal, setShowTruckModal] = useState(false);
  const [linkingTruck, setLinkingTruck] = useState<TruckType | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const { trucks, loading: trucksLoading, refetch } = useTrucks();
  const { createTruck, updateTruck, deleteTruck, isLoading: truckCrudLoading } = useTrucksCRUD();

  const handleCreateTruck = async (data: Omit<TruckType, 'id'>) => {
    try {
      await createTruck(data);
      setShowTruckModal(false);
      await refetch();
      toast({ title: 'Caminhão criado com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao criar caminhão', variant: 'destructive' });
    }
  };

  const handleUpdateTruck = async (data: Omit<TruckType, 'id'>) => {
    if (!editingTruck) return;
    try {
      await updateTruck({ id: editingTruck.id, truck: data });
      setEditingTruck(null);
      await refetch();
      toast({ title: 'Caminhão atualizado com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar caminhão', variant: 'destructive' });
    }
  };

  const handleDeleteTruck = async (id: string) => {
    if ((await confirmDialog({ description: 'Tem certeza que deseja excluir este caminhão?', destructive: true }))) {
      try {
        await deleteTruck(id);
        await refetch();
        toast({ title: 'Caminhão excluído com sucesso!' });
      } catch (error) {
        toast({ title: 'Erro ao excluir caminhão', variant: 'destructive' });
      }
    }
  };

  const handleLinkRoute = (truck: TruckType) => {
    setLinkingTruck(truck);
    setShowLinkModal(true);
  };

  const handleUnlinkRoute = async (truck: TruckType) => {
    if (!(await confirmDialog({ description: `Desvincular a rota atual de ${truck.name}?`, destructive: true }))) return;
    try {
      const { API_CONFIG } = await import('@/services/config');
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_CONFIG.BASE_URL}/trucks/unlink-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ truckId: truck.id }),
      });
      if (!res.ok) throw new Error('Falha ao desvincular');
      await refetch();
      toast({ title: 'Rota desvinculada com sucesso!' });
    } catch (e: any) {
      toast({ title: 'Erro ao desvincular rota', description: e?.message, variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      available: 'default',
      'in-route': 'secondary',
      maintenance: 'destructive'
    } as const;
    const labels = {
      available: 'Disponível',
      'in-route': 'Em Rota',
      maintenance: 'Manutenção'
    };
    return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>;
  };

  const handleCloseModals = () => {
    setShowTruckModal(false);
    setShowLinkModal(false);
    setEditingTruck(null);
    setLinkingTruck(null);
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Caminhões" 
        subtitle="Gerenciamento da frota de caminhões"
      >
        <Button onClick={() => setShowTruckModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Caminhão
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card>
          <CardContent className="p-6">
            {trucksLoading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p>Carregando caminhões...</p>
              </div>
            ) : trucks.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum caminhão cadastrado</h3>
                <p className="text-gray-600 mb-4">Comece adicionando seu primeiro caminhão</p>
                <Button onClick={() => setShowTruckModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Primeiro Caminhão
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Ano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Km</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trucks.map((truck) => (
                    <TableRow key={truck.id}>
                      <TableCell className="font-medium">{truck.name}</TableCell>
                      <TableCell>{truck.plate}</TableCell>
                      <TableCell>{truck.model}</TableCell>
                      <TableCell>{truck.year}</TableCell>
                      <TableCell>{getStatusBadge(truck.status)}</TableCell>
                      <TableCell>{truck.driver || '-'}</TableCell>
                      <TableCell>{truck.mileage?.toLocaleString() || '0'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingTruck(truck)}
                            title="Editar caminhão"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLinkRoute(truck)}
                            title="Vincular rota"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </Button>
                          {(truck.status === 'in-route' || (truck as any).current_route_id || (truck as any).currentRouteId || (truck as any).current_route) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUnlinkRoute(truck)}
                              title="Desvincular rota"
                              className="text-orange-600 hover:bg-orange-50"
                            >
                              <Unlink className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteTruck(truck.id)}
                            title="Excluir caminhão"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <TruckModal
        open={showTruckModal || !!editingTruck}
        onOpenChange={(open) => {
          if (!open) handleCloseModals();
        }}
        truck={editingTruck || undefined}
        onSubmit={editingTruck ? handleUpdateTruck : handleCreateTruck}
        isLoading={truckCrudLoading}
      />

      <LinkRouteModal
        open={showLinkModal}
        onOpenChange={(open) => {
          if (!open) handleCloseModals();
        }}
        truck={linkingTruck}
        onSuccess={() => {
          handleCloseModals();
          refetch();
        }}
      />
    </div>
  );
};

export default Trucks;
