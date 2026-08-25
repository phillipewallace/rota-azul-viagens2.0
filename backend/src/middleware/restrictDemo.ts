import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthedRequest, JWT_SECRET } from './requireAuth';

/**
 * Sandbox de acesso para a role `demo`.
 *
 * Regras:
 *  - Nunca consulta tabelas reais do sistema.
 *  - Responde dados totalmente fictícios para GETs conhecidos.
 *  - Responde sucesso fictício para mutações, sem gravar nada.
 *
 * Motivo: o usuário demo/demo1234 é público (divulgado para curiosos) e
 * NÃO pode enxergar dados reais de nenhum módulo.
 */

const now = () => new Date().toISOString();
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const DEMO_CUSTOMERS = [
  {
    id: 'demo-cust-1', customerName: 'Reino de Aurélia — Cia. Fictícia',
    address: 'Alameda dos Unicórnios, 123', cep: '00000001', numero: '123',
    bairro: 'Vila Encantada', cidade: 'Ilha da Fantasia', estado: 'ZZ',
    personType: 'PJ', document: '00000000000100', email: 'contato@aurelia.demo',
    contactName: 'Rainha Lyra', contactPhone: '(00) 90000-1000',
    restroomsQty: 8, cleaningsQty: 2, tipoCliente: 'eventos', createdAt: daysAgo(120), updatedAt: now(),
  },
  {
    id: 'demo-cust-2', customerName: 'Festival dos Dragões Ltda (DEMO)',
    address: 'Rua do Arco-Íris, 456', cep: '00000002', numero: '456',
    bairro: 'Bosque das Fadas', cidade: 'Cidade Miragem', estado: 'ZZ',
    personType: 'PJ', document: '00000000000200', email: 'ola@dragoes.demo',
    contactName: 'Barão Corvo', contactPhone: '(00) 90000-2000',
    restroomsQty: 15, cleaningsQty: 3, tipoCliente: 'eventos', createdAt: daysAgo(64), updatedAt: now(),
  },
  {
    id: 'demo-cust-3', customerName: 'Guilda dos Anões — Obras (DEMO)',
    address: 'Caverna 7, s/n', cep: '00000003', bairro: 'Monte Nébula',
    cidade: 'Terra do Nunca', estado: 'ZZ', personType: 'PJ', document: '00000000000300',
    email: 'compras@anoes.demo', contactName: 'Mestre Thorin', contactPhone: '(00) 90000-3000',
    restroomsQty: 6, cleaningsQty: 4, tipoCliente: 'obra', createdAt: daysAgo(30), updatedAt: now(),
  },
];

const DEMO_DRIVERS = [
  { id: 'demo-driver-1', name: 'Merlin Estrela', license: 'DEMO0000001', licenseCategory: 'E', phone: '(00) 90000-0001', email: 'merlin@demo.ficticio', status: 'active', hireDate: daysAgo(720), currentRoute: 'Trilha dos Unicórnios', totalTrips: 111, truckCount: 1 },
  { id: 'demo-driver-2', name: 'Aurora Lumen', license: 'DEMO0000002', licenseCategory: 'D', phone: '(00) 90000-0002', email: 'aurora@demo.ficticio', status: 'active', hireDate: daysAgo(1100), totalTrips: 222, truckCount: 1 },
  { id: 'demo-driver-3', name: 'Nébula Vega', license: 'DEMO0000003', licenseCategory: 'E', phone: '(00) 90000-0003', email: 'nebula@demo.ficticio', status: 'active', hireDate: daysAgo(210), totalTrips: 33, truckCount: 1 },
];

const DEMO_TRUCKS = [
  { id: 'demo-truck-1', name: 'Dragão de Prata', plate: 'DEMO-001', model: 'Fantasia Heavy X9', year: 2099, status: 'in-route', currentRoute: 'demo-route-1', currentRouteName: 'Trilha dos Unicórnios', driver: 'demo-driver-1', driverName: 'Merlin Estrela', lastMaintenance: daysAgo(18), mileage: 12345, location: { lat: -15.7801, lng: -47.9292 } },
  { id: 'demo-truck-2', name: 'Fênix Dourada', plate: 'DEMO-002', model: 'Fábula Cargo 3000', year: 2099, status: 'available', driverName: 'Aurora Lumen', lastMaintenance: daysAgo(42), mileage: 22222 },
  { id: 'demo-truck-3', name: 'Grifo Azul', plate: 'DEMO-003', model: 'Mitologia Delivery', year: 2099, status: 'maintenance', driverName: '—', lastMaintenance: daysAgo(3), mileage: 33333 },
];

const DEMO_ROUTES = [
  {
    id: 'demo-route-1', name: 'Trilha dos Unicórnios', description: 'Rota demonstrativa — dados fictícios',
    points: [
      { id: 'demo-point-1', address: 'Alameda dos Unicórnios, 123 — Ilha da Fantasia/ZZ', lat: -15.7801, lng: -47.9292, order: 1, customerName: 'Reino de Aurélia — Cia. Fictícia' },
      { id: 'demo-point-2', address: 'Rua do Arco-Íris, 456 — Cidade Miragem/ZZ', lat: -15.7900, lng: -47.9000, order: 2, customerName: 'Festival dos Dragões Ltda (DEMO)' },
    ],
    totalDistance: 42.8, estimatedTime: '2h 15min', optimizedOrder: ['demo-point-1', 'demo-point-2'],
    optimizationMode: 'optimized', status: 'active', createdAt: daysAgo(2),
  },
  {
    id: 'demo-route-2', name: 'Rota Caverna dos Anões', description: 'Rota demonstrativa — dados fictícios',
    points: [{ id: 'demo-point-3', address: 'Caverna 7, s/n — Terra do Nunca/ZZ', lat: -15.8000, lng: -47.8800, order: 1, customerName: 'Guilda dos Anões — Obras (DEMO)' }],
    totalDistance: 88.4, estimatedTime: '3h 40min', optimizedOrder: ['demo-point-3'],
    optimizationMode: 'fixed', status: 'completed', createdAt: daysAgo(7),
  },
];

const DEMO_COMPANIES = [
  { id: 'demo-company-1', razaoSocial: 'Aurélia Sanitários Encantados Ltda', nomeFantasia: 'Aurélia Demo', cnpj: '00000000000100', inscricaoEstadual: 'ISENTO-DEMO', endereco: 'Castelo Norte, 100', cidade: 'Ilha da Fantasia', estado: 'ZZ', cep: '00000010', telefone: '(00) 90000-5000', email: 'financeiro@aurelia.demo', ativo: true, createdAt: daysAgo(90) },
];

const DEMO_ERP_ITEMS = [
  { id: 'demo-item-1', name: 'Sanitário Cristalino DEMO', category: 'Fictício', quantity: 42, min_quantity: 10, unit: 'un' },
  { id: 'demo-item-2', name: 'Essência de Lavanda Encantada', category: 'Fictício', quantity: 120, min_quantity: 20, unit: 'L' },
];

function demoPayload(path: string): unknown {
  const pathname = path.split('?')[0];

  if (pathname === '/api/health') return { status: 'OK', demo: true, timestamp: now() };
  if (pathname === '/api/customers') return DEMO_CUSTOMERS;
  if (pathname.startsWith('/api/customers/') && pathname.endsWith('/history')) return { current: [], history: [] };
  if (pathname.startsWith('/api/customers/')) return DEMO_CUSTOMERS.find(c => c.id === pathname.split('/')[3]) || DEMO_CUSTOMERS[0];

  if (pathname === '/api/routes') return DEMO_ROUTES;
  if (pathname.startsWith('/api/routes/')) return DEMO_ROUTES.find(r => r.id === pathname.split('/')[3]) || DEMO_ROUTES[0];
  if (pathname === '/api/trucks') return DEMO_TRUCKS;
  if (pathname.startsWith('/api/trucks/')) return DEMO_TRUCKS.find(t => t.id === pathname.split('/')[3]) || DEMO_TRUCKS[0];
  if (pathname === '/api/drivers') return DEMO_DRIVERS;
  if (pathname.startsWith('/api/drivers/') && pathname.endsWith('/dependencies')) return { trucks: [], tripsCount: 0, canDelete: true };
  if (pathname.startsWith('/api/drivers/')) return DEMO_DRIVERS.find(d => d.id === pathname.split('/')[3]) || DEMO_DRIVERS[0];

  if (pathname === '/api/management/stats') return { trucks: { total: 3, available: 1, in_route: 1, in_maintenance: 1 }, maintenance: { total_maintenances: 2, completed: 1, pending: 1, in_progress: 0 }, upcoming: { upcoming_count: 1 }, costs: { total_cost: 1234.56, avg_cost: 617.28 } };
  if (pathname.startsWith('/api/management/')) return [];
  if (pathname.startsWith('/api/analytics')) return [];
  if (pathname.startsWith('/api/completed-routes')) return DEMO_ROUTES.filter(r => r.status === 'completed');
  if (pathname.startsWith('/api/tracking/truck/')) return { lat: -15.7801, lng: -47.9292, recorded_at: now(), demo: true };
  if (pathname.startsWith('/api/tracking')) return [];
  if (pathname.startsWith('/api/maintenance')) return [];
  if (pathname.startsWith('/api/schedules')) return [];
  if (pathname.startsWith('/api/sanitarios')) return [];
  if (pathname.startsWith('/api/carretinhas')) return [];
  if (pathname.startsWith('/api/checklists')) return [];
  if (pathname.startsWith('/api/photos')) return [];
  if (pathname.startsWith('/api/users')) return [];

  if (pathname === '/api/erp/companies') return DEMO_COMPANIES;
  if (pathname.startsWith('/api/erp/companies/')) return DEMO_COMPANIES[0];
  if (pathname === '/api/erp/items') return DEMO_ERP_ITEMS;
  if (pathname === '/api/erp/categories') return [{ id: 'demo-cat-1', name: 'Categoria Fictícia', description: 'Demo' }];
  if (pathname === '/api/erp/dashboard') return { items: 2, lowStock: 0, movements: 4, vehicles: 1 };
  if (pathname.startsWith('/api/erp')) return [];

  if (pathname === '/api/settings') return {};
  if (pathname.startsWith('/api/geocoding/cep/')) return { logradouro: 'Rua Exemplo DEMO', bairro: 'Centro Fictício', localidade: 'Cidade Demo', uf: 'ZZ' };
  if (pathname.startsWith('/api/geocoding')) return { lat: -15.7801, lng: -47.9292 };

  return [];
}

export function restrictDemo(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  // Só analisa rotas /api/*
  if (!req.path.startsWith('/api/')) return next();

  // Decodifica token de forma "soft" — se não houver, deixa passar
  // (os próprios controllers exigem requireAuth quando precisam).
  let role: string | undefined;
  let username: string | undefined;
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      role = decoded?.role;
      username = decoded?.username;
    }
  } catch {
    return next(); // token inválido → deixa requireAuth tratar
  }

  // Segurança extra: tokens antigos do usuário demo podem ainda carregar role antiga.
  // Username `demo` é sempre sandbox, independentemente do role assinado no JWT.
  if (role !== 'demo' && username !== 'demo') return next();

  // Auth endpoints sempre liberados (login/verify/logout)
  if (req.path.startsWith('/api/auth')) return next();

  if (req.method === 'GET') {
    return res.json(demoPayload(req.originalUrl || req.path));
  }

  return res.status(req.method === 'POST' ? 201 : 200).json({
    ok: true,
    success: true,
    demo: true,
    message: 'Conta demonstrativa: ação simulada, nenhum dado real foi alterado.',
  });
}
