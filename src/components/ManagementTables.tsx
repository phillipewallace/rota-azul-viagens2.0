
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TruckPerformanceData, RouteUsageData } from '@/hooks/useManagement';
import { Truck, Route, BarChart3 } from 'lucide-react';

interface ManagementTablesProps {
  truckPerformance: TruckPerformanceData[];
  routeUsage: RouteUsageData[];
  loading: boolean;
}

export const ManagementTables: React.FC<ManagementTablesProps> = ({
  truckPerformance,
  routeUsage,
  loading
}) => {
  const getStatusBadge = (status: string) => {
    const statusMap = {
      'available': { label: 'Disponível', variant: 'default' as const },
      'in-route': { label: 'Em Rota', variant: 'secondary' as const },
      'maintenance': { label: 'Manutenção', variant: 'destructive' as const }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
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
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Performance dos Caminhões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caminhão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Viagens</TableHead>
                <TableHead className="text-right">Distância</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {truckPerformance.slice(0, 8).map((truck) => (
                <TableRow key={truck.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{truck.name}</div>
                      <div className="text-sm text-gray-500">{truck.plate}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(truck.status)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {truck.trips_count}
                  </TableCell>
                  <TableCell className="text-right">
                    {Math.round(truck.total_distance)} km
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Uso das Rotas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead className="text-right">Uso</TableHead>
                <TableHead className="text-right">Distância</TableHead>
                <TableHead className="text-right">Tempo Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routeUsage.slice(0, 8).map((route) => (
                <TableRow key={route.id}>
                  <TableCell className="font-medium">
                    {route.name}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">
                      {route.usage_count}x
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {Math.round(route.total_distance)} km
                  </TableCell>
                  <TableCell className="text-right">
                    {Math.round(route.avg_duration)} min
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
