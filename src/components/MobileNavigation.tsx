
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, BarChart3, Calendar, Users, Settings, Smartphone, Truck, Route } from 'lucide-react';
import { Button } from "@/components/ui/button";

const MobileNavigation = () => {
  const location = useLocation();

  const navigationItems = [
    { icon: MapPin, label: 'Mapa', to: '/' },
    { icon: Route, label: 'Rotas', to: '/routes' },
    { icon: Truck, label: 'Caminhões', to: '/trucks' },
    { icon: Users, label: 'Motoristas', to: '/drivers' },
    { icon: Smartphone, label: 'Mobile', to: '/mobile' },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
      <div className="flex justify-around items-center py-2">
        {navigationItems.map((item) => (
          <Button
            key={item.to}
            variant="ghost"
            size="sm"
            className={`flex flex-col items-center p-2 ${
              isActive(item.to) 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-gray-600 hover:text-blue-600'
            }`}
            asChild
          >
            <Link to={item.to}>
              <item.icon className="h-5 w-5 mb-1" />
              <span className="text-xs">{item.label}</span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default MobileNavigation;
