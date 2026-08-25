
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Wrench } from 'lucide-react';
import { MaintenanceRecord } from '@/hooks/useMaintenanceManagement';
import { formatDateBR } from '@/utils/dateFormat';

interface MaintenanceTableProps {
  records: MaintenanceRecord[];
  loading: boolean;
  onEdit: (record: MaintenanceRecord) => void;
  onDelete: (id: string) => void;
}

export const MaintenanceTable: React.FC<MaintenanceTableProps> = ({
  records,
  loading,
  onEdit,
  onDelete
}) => {
  const getStatusBadge = (status: string) => {
    const statusMap = {
      'pending': { label: 'Pendente', variant: 'secondary' as const },
      'in_progress': { label: 'Em Andamento', variant: 'default' as const },
      'completed': { label: 'Concluída', variant: 'outline' as const }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const typeColors = {
      'preventiva': 'bg-green-100 text-green-800',
      'corretiva': 'bg-red-100 text-red-800',
      'preditiva': 'bg-blue-100 text-blue-800',
      'revisao': 'bg-yellow-100 text-yellow-800',
      'inspecao': 'bg-purple-100 text-purple-800'
    };
    
    const colorClass = typeColors[type as keyof typeof typeColors] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  // Função para garantir que o valor seja numérico
  const formatCost = (cost: any): string => {
    const numericCost = typeof cost === 'string' ? parseFloat(cost) : Number(cost);
    return isNaN(numericCost) ? '0.00' : numericCost.toFixed(2);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse h-6 bg-gray-200 rounded w-1/3"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="animate-pulse h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Registros de Manutenção
        </CardTitle>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="text-center py-8">
            <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum registro de manutenção encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caminhão</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Data Agendada</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Km</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{record.truck_name || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{record.truck_plate || 'N/A'}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getTypeBadge(record.maintenance_type || 'geral')}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={record.description || ''}>
                      {record.description || 'Sem descrição'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {record.scheduled_date ? formatDateBR(record.scheduled_date) : 'Data não definida'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(record.status || 'pending')}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {record.mileage != null
                      ? `${Number(record.mileage).toLocaleString('pt-BR')} km`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    R$ {formatCost(record.cost)}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(record)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(record.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
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
  );
};
