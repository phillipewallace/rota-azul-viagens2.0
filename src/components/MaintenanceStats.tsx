
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Wrench, Calendar, DollarSign } from 'lucide-react';
import { MaintenanceStats as StatsType } from '@/hooks/useMaintenanceManagement';

interface MaintenanceStatsProps {
  stats: StatsType | null;
  loading: boolean;
}

export const MaintenanceStats: React.FC<MaintenanceStatsProps> = ({ stats, loading }) => {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      title: 'Caminhões',
      value: `${stats.trucks?.available || 0}/${stats.trucks?.total || 0}`,
      icon: Truck,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      subtitle: `${stats.trucks?.in_maintenance || 0} em manutenção`
    },
    {
      title: 'Manutenções',
      value: (stats.maintenance?.total_maintenances || 0).toString(),
      icon: Wrench,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      subtitle: `${stats.maintenance?.completed || 0} concluídas`
    },
    {
      title: 'Próximas 30 dias',
      value: (stats.upcoming?.upcoming_count || 0).toString(),
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      subtitle: 'manutenções agendadas'
    },
    {
      title: 'Custo Médio',
      value: `R$ ${Number(stats.costs?.avg_cost || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      subtitle: 'últimos 30 dias'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${metric.bgColor}`}>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground">
                {metric.subtitle}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
