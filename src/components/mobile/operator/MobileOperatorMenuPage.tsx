import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MapPin, Route, Truck, Users, 
  Settings, Wrench, Building2, ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import MobileOperatorHeader from './MobileOperatorHeader';
import MobileOperatorNav from './MobileOperatorNav';
import { cn } from '@/lib/utils';

const MobileOperatorMenuPage = () => {
  const navigate = useNavigate();

  const menuSections = [
    {
      title: 'Gestão',
      items: [
        { icon: Building2, label: 'Clientes', to: '/customers', color: 'bg-purple-100 text-purple-600' },
        { icon: Settings, label: 'Gerenciamento', to: '/management', color: 'bg-slate-100 text-slate-600' },
        { icon: Wrench, label: 'Manutenção', to: '/maintenance', color: 'bg-amber-100 text-amber-600' },
      ]
    },
    {
      title: 'Sistema',
      items: [
        { icon: Settings, label: 'Configurações', to: '/settings', color: 'bg-gray-100 text-gray-600' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MobileOperatorHeader title="Menu" showBack />

      <main className="flex-1 pt-14 pb-20 overflow-auto">
        <div className="p-4 space-y-6">
          {menuSections.map((section) => (
            <div key={section.title}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
                {section.title}
              </h2>
              <Card>
                <CardContent className="p-0 divide-y divide-gray-100">
                  {section.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center gap-4 p-4 active:bg-gray-50"
                    >
                      <div className={cn("p-2.5 rounded-xl", item.color)}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="flex-1 font-medium text-gray-900">
                        {item.label}
                      </span>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </main>

      
    </div>
  );
};

export default MobileOperatorMenuPage;
