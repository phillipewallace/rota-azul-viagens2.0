
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Users, Truck, MapPin, Activity, Clock, Route } from 'lucide-react';
import { ManagementStats } from '@/hooks/useManagement';

interface ManagementMetricsProps {
  stats: ManagementStats | null;
  loading: boolean;
}

export const ManagementMetrics: React.FC<ManagementMetricsProps> = ({ stats, loading }) => {
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
      title: 'Total de Viagens',
      value: stats.trips.total_trips.toLocaleString(),
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      subtitle: `${Math.round(stats.trips.avg_duration)} min média`
    },
    {
      title: 'Caminhões Ativos',
      value: `${stats.trucks.available + stats.trucks.in_route}/${stats.trucks.total}`,
      icon: Truck,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      subtitle: `${stats.trucks.in_route} em rota`
    },
    {
      title: 'Motoristas',
      value: `${stats.drivers.active}/${stats.drivers.total}`,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      subtitle: 'motoristas ativos'
    },
    {
      title: 'Distância Total',
      value: `${Math.round(stats.trips.total_distance).toLocaleString()} km`,
      icon: Route,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      subtitle: 'percorridos'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {metric.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {metric.value}
                  </p>
                  <p className="text-xs text-gray-500">
                    {metric.subtitle}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${metric.bgColor}`}>
                  <Icon className={`h-6 w-6 ${metric.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
