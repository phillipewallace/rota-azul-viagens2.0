
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { CalendarDays, Filter, RefreshCw } from 'lucide-react';

interface ManagementFiltersProps {
  startDate: string;
  endDate: string;
  selectedTruck: string;
  selectedRoute: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onTruckChange: (truckId: string) => void;
  onRouteChange: (routeId: string) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  trucks: Array<{ id: string; name: string; plate: string }>;
  routes: Array<{ id: string; name: string }>;
}

export const ManagementFilters: React.FC<ManagementFiltersProps> = ({
  startDate,
  endDate,
  selectedTruck,
  selectedRoute,
  onStartDateChange,
  onEndDateChange,
  onTruckChange,
  onRouteChange,
  onApplyFilters,
  onResetFilters,
  trucks,
  routes
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros Avançados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Data Inicial</Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="end-date">Data Final</Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Caminhão</Label>
            <SearchableSelect
              value={selectedTruck}
              onValueChange={onTruckChange}
              placeholder="Todos os caminhões"
              searchPlaceholder="Buscar caminhão..."
              options={[
                { value: 'all', label: 'Todos os caminhões' },
                ...trucks.map((t) => ({ value: t.id, label: t.name, hint: t.plate })),
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Rota</Label>
            <SearchableSelect
              value={selectedRoute}
              onValueChange={onRouteChange}
              placeholder="Todas as rotas"
              searchPlaceholder="Buscar rota..."
              options={[
                { value: 'all', label: 'Todas as rotas' },
                ...routes.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={onApplyFilters} className="flex-1">
            <Filter className="h-4 w-4 mr-2" />
            Aplicar Filtros
          </Button>
          <Button variant="outline" onClick={onResetFilters}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
