import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MapPin, Route, Truck, Users, 
  Settings, Wrench, Building2, LogOut,
  FileText, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';

const MobileOperatorMenu = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const mainItems = [
    { icon: MapPin, label: 'Mapa Principal', to: '/' },
    { icon: Route, label: 'Rotas', to: '/routes' },
    { icon: Truck, label: 'Caminhões', to: '/trucks' },
    { icon: Users, label: 'Motoristas', to: '/drivers' },
  ];

  const secondaryItems = [
    { icon: Building2, label: 'Clientes', to: '/customers' },
    { icon: Wrench, label: 'Manutenção', to: '/maintenance' },
    { icon: FileText, label: 'Orçamentos', to: '/erp/orcamentos' },
    { icon: ClipboardList, label: 'Ordens de Serviço', to: '/erp/ordens-servico' },
    { icon: Building2, label: 'Gestão Interna (ERP)', to: '/gestao-interna' },
    { icon: Settings, label: 'Configurações', to: '/settings' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="p-5 border-b border-gray-700">
        <h2 className="text-xl font-bold text-blue-400">AlchemyRotas</h2>
        <p className="text-sm text-gray-400 mt-1">Sistema de Roteirização</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-1">
          {mainItems.map((item) => (
            <Button
              key={item.to}
              variant="ghost"
              className="w-full justify-start text-white hover:bg-gray-800 hover:text-blue-400 h-12"
              asChild
            >
              <Link to={item.to}>
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </Link>
            </Button>
          ))}
        </div>

        <Separator className="my-4 bg-gray-700" />

        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-4">
          ERP
        </p>
        
        <div className="space-y-1">
          {secondaryItems.map((item) => (
            <Button
              key={item.to}
              variant="ghost"
              className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-blue-400 h-11"
              asChild
            >
              <Link to={item.to}>
                <item.icon className="mr-3 h-4 w-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-700">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-400 hover:bg-red-500/10 hover:text-red-300 h-12"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sair
        </Button>
      </div>
    </div>
  );
};

export default MobileOperatorMenu;
