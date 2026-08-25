/**
 * Modo Demonstração
 * ─────────────────
 * Quando o usuário logado tem role === 'demo', instalamos um interceptor
 * global de `window.fetch` que responde a todas as chamadas /api/* com
 * dados fictícios, sem tocar no backend real.
 *
 * Isso permite que a pessoa explore todas as telas do sistema sem que
 * nenhuma informação real vaze.
 *
 * Endpoints de autenticação (/api/auth/*) continuam passando batido
 * para o backend — o login/verify precisa ser real.
 */

type JsonBody = Record<string, any> | any[] | null;

const API_HOSTS = ['alchemyrotas.com'];

function isApiRequest(url: string): { isApi: boolean; path: string } {
  try {
    // Aceita path relativo ou absoluto
    const u = url.startsWith('http')
      ? new URL(url)
      : new URL(url, window.location.origin);
    const isLocalApi = u.pathname.startsWith('/api/');
    const isRemoteApi = API_HOSTS.includes(u.hostname) && u.pathname.startsWith('/api/');
    return { isApi: isLocalApi || isRemoteApi, path: u.pathname + u.search };
  } catch {
    return { isApi: false, path: url };
  }
}

export function isDemoUser(): boolean {
  try {
    const raw = localStorage.getItem('user_data');
    if (!raw) return false;
    const u = JSON.parse(raw);
    return u?.role === 'demo' || u?.username === 'demo';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Dataset fictício
// ─────────────────────────────────────────────────────────────
const today = new Date();
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return iso(d);
};

const DEMO_TRUCKS = [
  {
    id: 'demo-truck-1', name: 'Dragão de Prata', plate: 'DEMO-001', model: 'Fantasia Heavy X9',
    year: 2099, status: 'in-route', currentRoute: 'demo-route-1', currentRouteName: 'Trilha dos Unicórnios',
    driver: 'demo-driver-1', driverName: 'Merlin Estrela',
    lastMaintenance: daysAgo(18), mileage: 12345,
    location: { lat: -15.7801, lng: -47.9292 },
  },
  {
    id: 'demo-truck-2', name: 'Fênix Dourada', plate: 'DEMO-002', model: 'Fábula Cargo 3000',
    year: 2099, status: 'available', driverName: 'Aurora Lumen',
    lastMaintenance: daysAgo(42), mileage: 22222,
  },
  {
    id: 'demo-truck-3', name: 'Grifo Azul', plate: 'DEMO-003', model: 'Mitologia Delivery',
    year: 2099, status: 'maintenance', driverName: '—',
    lastMaintenance: daysAgo(3), mileage: 33333,
  },
  {
    id: 'demo-truck-4', name: 'Kraken Verde', plate: 'DEMO-004', model: 'Encantado Turbo',
    year: 2099, status: 'available', driverName: 'Nébula Vega',
    lastMaintenance: daysAgo(9), mileage: 4444,
  },
];

const DEMO_DRIVERS = [
  { id: 'demo-driver-1', name: 'Merlin Estrela', license: 'DEMO0000001', licenseCategory: 'E',
    phone: '(00) 90000-0001', email: 'merlin@demo.fictício', status: 'active',
    hireDate: daysAgo(720), currentRoute: 'Trilha dos Unicórnios', totalTrips: 111, truckCount: 1 },
  { id: 'demo-driver-2', name: 'Aurora Lumen', license: 'DEMO0000002', licenseCategory: 'D',
    phone: '(00) 90000-0002', email: 'aurora@demo.fictício', status: 'active',
    hireDate: daysAgo(1100), totalTrips: 222, truckCount: 1 },
  { id: 'demo-driver-3', name: 'Nébula Vega', license: 'DEMO0000003', licenseCategory: 'E',
    phone: '(00) 90000-0003', email: 'nebula@demo.fictício', status: 'active',
    hireDate: daysAgo(210), totalTrips: 33, truckCount: 1 },
  { id: 'demo-driver-4', name: 'Zephyr Bruma', license: 'DEMO0000004', licenseCategory: 'D',
    phone: '(00) 90000-0004', email: 'zephyr@demo.fictício', status: 'inactive',
    hireDate: daysAgo(1500), totalTrips: 44 },
];

const DEMO_CUSTOMERS = [
  { id: 'demo-cust-1', customerName: 'Reino de Aurélia — Cia. Fictícia', address: 'Alameda dos Unicórnios, 123',
    cep: '00000-001', numero: '123', bairro: 'Vila Encantada', cidade: 'Ilha da Fantasia', estado: 'ZZ',
    personType: 'PJ', document: '00.000.000/0001-00', email: 'contato@aurelia.demo',
    contactName: 'Rainha Lyra', contactPhone: '(00) 90000-1000',
    restroomsQty: 8, cleaningsQty: 2, tipoCliente: 'eventos',
    createdAt: daysAgo(120) },
  { id: 'demo-cust-2', customerName: 'Festival dos Dragões Ltda (DEMO)', address: 'Rua do Arco-Íris, 456',
    cep: '00000-002', numero: '456', bairro: 'Bosque das Fadas', cidade: 'Cidade Miragem', estado: 'ZZ',
    personType: 'PJ', document: '00.000.000/0002-00', email: 'ola@dragoes.demo',
    contactName: 'Barão Corvo', contactPhone: '(00) 90000-2000',
    restroomsQty: 15, cleaningsQty: 3, tipoCliente: 'eventos',
    createdAt: daysAgo(64) },
  { id: 'demo-cust-3', customerName: 'Guilda dos Anões — Obras (DEMO)', address: 'Caverna 7, s/n',
    cep: '00000-003', bairro: 'Monte Nébula', cidade: 'Terra do Nunca', estado: 'ZZ',
    personType: 'PJ', document: '00.000.000/0003-00', email: 'compras@anoes.demo',
    contactName: 'Mestre Thorin', contactPhone: '(00) 90000-3000',
    restroomsQty: 6, cleaningsQty: 4, tipoCliente: 'obra',
    createdAt: daysAgo(30) },
  { id: 'demo-cust-4', customerName: 'Sr. Bilbo (Cliente Demonstrativo)', address: 'Toca do Hobbit, 1',
    cep: '00000-004', numero: '1', bairro: 'Condado', cidade: 'Vilarejo Verde', estado: 'ZZ',
    personType: 'PF', document: '000.000.000-00', email: 'bilbo@demo.fictício',
    contactPhone: '(00) 90000-4000', restroomsQty: 1, tipoCliente: 'outro',
    createdAt: daysAgo(8) },
];

const DEMO_ROUTES = [
  {
    id: 'demo-route-1', name: 'Trilha dos Unicórnios', description: 'Rota demonstrativa — dados fictícios',
    points: [
      { id: 'p1', address: 'Alameda dos Unicórnios, 123 — Ilha da Fantasia/ZZ', lat: -15.7801, lng: -47.9292, order: 1, customerName: 'Reino de Aurélia — Cia. Fictícia' },
      { id: 'p2', address: 'Rua do Arco-Íris, 456 — Cidade Miragem/ZZ', lat: -15.7900, lng: -47.9000, order: 2, customerName: 'Festival dos Dragões Ltda (DEMO)' },
      { id: 'p3', address: 'Toca do Hobbit, 1 — Vilarejo Verde/ZZ', lat: -15.7700, lng: -47.9500, order: 3, customerName: 'Sr. Bilbo (Cliente Demonstrativo)' },
    ],
    totalDistance: 42.8, estimatedTime: '2h 15min', optimizedOrder: ['p1','p2','p3'],
    optimizationMode: 'optimized', status: 'active', createdAt: daysAgo(2),
  },
  {
    id: 'demo-route-2', name: 'Rota Caverna dos Anões', description: 'Rota demonstrativa — dados fictícios',
    points: [
      { id: 'p4', address: 'Caverna 7, s/n — Terra do Nunca/ZZ', lat: -15.8000, lng: -47.8800, order: 1, customerName: 'Guilda dos Anões — Obras (DEMO)' },
      { id: 'p5', address: 'Monte Nébula, km 3 — Terra do Nunca/ZZ', lat: -15.8100, lng: -47.8700, order: 2, customerName: 'Guilda dos Anões — Obras (DEMO)' },
    ],
    totalDistance: 88.4, estimatedTime: '3h 40min', optimizedOrder: ['p4','p5'],
    optimizationMode: 'fixed', status: 'active', createdAt: daysAgo(5),
  },
  {
    id: 'demo-route-3', name: 'Festival dos Dragões', description: 'Rota demonstrativa — dados fictícios',
    points: [
      { id: 'p6', address: 'Rua do Arco-Íris, 456 — Cidade Miragem/ZZ', lat: -15.7900, lng: -47.9000, order: 1, customerName: 'Festival dos Dragões Ltda (DEMO)' },
    ],
    totalDistance: 12.1, estimatedTime: '45min', optimizedOrder: ['p6'],
    optimizationMode: 'optimized', status: 'completed', createdAt: daysAgo(7),
  },
];


const DEMO_COMPLETED = DEMO_ROUTES.filter(r => r.status === 'completed').map(r => ({
  id: `cr-${r.id}`, route_id: r.id, route_name: r.name,
  truck_id: 'demo-truck-1', truck_name: 'Águia 01', driver_name: 'Carlos Andrade',
  started_at: daysAgo(7), finished_at: daysAgo(7), total_distance: r.totalDistance,
  duration_minutes: 178, status: 'completed',
}));

const DEMO_MANAGEMENT_STATS = {
  trucks: { total: 4, available: 2, in_route: 1, maintenance: 1 },
  drivers: { total: 4, active: 3 },
  routes: { total: 3, active: 2 },
  trips: { total_trips: 128, total_distance: 4820, avg_duration: 132 },
};

const DEMO_PERFORMANCE = Array.from({ length: 14 }, (_, i) => ({
  date: daysAgo(13 - i).slice(0, 10),
  trips: 6 + Math.round(Math.sin(i / 2) * 3 + 3),
  total_distance: 180 + Math.round(Math.cos(i / 3) * 60 + 60),
  avg_duration: 110 + Math.round(Math.sin(i) * 20 + 20),
}));

const DEMO_ROUTE_USAGE = DEMO_ROUTES.map((r, i) => ({
  name: r.name, id: r.id,
  usage_count: 40 - i * 8, total_distance: r.totalDistance * (10 - i * 2),
  avg_duration: 120 + i * 25,
}));

const DEMO_TRUCK_PERF = DEMO_TRUCKS.slice(0, 3).map((t, i) => ({
  name: t.name, id: t.id, plate: t.plate,
  trips_count: 60 - i * 12, total_distance: 4200 - i * 900,
  avg_duration: 130 + i * 15, status: t.status,
}));

// ─────────────────────────────────────────────────────────────
// Roteador de mocks
// ─────────────────────────────────────────────────────────────
function matchMock(method: string, path: string): JsonBody | undefined {
  // Remove querystring pra casar padrão
  const pathname = path.split('?')[0];

  // Rotas
  if (pathname === '/api/routes') return DEMO_ROUTES;
  if (/^\/api\/routes\/[^/]+$/.test(pathname)) {
    const id = pathname.split('/').pop()!;
    return DEMO_ROUTES.find(r => r.id === id) || DEMO_ROUTES[0];
  }

  // Caminhões
  if (pathname === '/api/trucks') return DEMO_TRUCKS;
  if (/^\/api\/trucks\/[^/]+$/.test(pathname)) {
    const id = pathname.split('/').pop()!;
    return DEMO_TRUCKS.find(t => t.id === id) || DEMO_TRUCKS[0];
  }

  // Motoristas
  if (pathname === '/api/drivers') return DEMO_DRIVERS;

  // Clientes
  if (pathname === '/api/customers') return DEMO_CUSTOMERS;
  if (/^\/api\/customers\/[^/]+$/.test(pathname)) {
    const id = pathname.split('/').pop()!;
    return DEMO_CUSTOMERS.find(c => c.id === id) || DEMO_CUSTOMERS[0];
  }

  // Gestão / Analytics
  if (pathname === '/api/management/stats') return DEMO_MANAGEMENT_STATS;
  if (pathname === '/api/management/performance') return DEMO_PERFORMANCE;
  if (pathname === '/api/management/route-usage') return DEMO_ROUTE_USAGE;
  if (pathname === '/api/management/truck-performance') return DEMO_TRUCK_PERF;
  if (pathname.startsWith('/api/analytics')) return [];

  // Rotas concluídas
  if (pathname === '/api/completed-routes') return DEMO_COMPLETED;

  // Rastreio
  if (pathname.startsWith('/api/tracking/route/')) return [];
  if (pathname.startsWith('/api/tracking/truck/')) {
    return { lat: -23.5629, lng: -46.6544, recorded_at: iso(new Date()) };
  }

  // Manutenção
  if (pathname === '/api/maintenance') return [];
  if (pathname.startsWith('/api/maintenance/')) return { items: [], stats: {} };

  // Schedules
  if (pathname === '/api/schedules') return [];

  // Sanitários / carretinhas / checklists / fotos
  if (pathname === '/api/sanitarios') return [];
  if (pathname === '/api/carretinhas') return [];
  if (pathname === '/api/checklists') return [];
  if (pathname.startsWith('/api/photos')) return [];

  // Sanitários — dashboard do ERP consome resumo
  if (pathname === '/api/sanitarios/stock-summary') {
    return {
      disponivel: 24, em_cliente: 12, manutencao: 3, inativo: 1,
      em_os: 6, reservadosEmOs: 6, atrasados: 0, total: 40, totalFisico: 40,
      porCategoria: {},
    };
  }

  // ERP — shapes específicos usados pelo Dashboard/telas
  if (pathname === '/api/erp/service-orders/overdue/count') return { overdue: 0 };
  if (pathname === '/api/erp/service-orders/notifications/upcoming') return [];
  if (pathname.startsWith('/api/erp/receipts/summary')) return { series: [] };
  if (pathname.startsWith('/api/erp/receipts/pending')) return { competencia: '', pendentes: [] };
  if (pathname === '/api/erp/items') return [];
  if (pathname === '/api/erp/quotes' || pathname.startsWith('/api/erp/quotes?')) return [];
  if (pathname === '/api/erp/service-orders' || pathname.startsWith('/api/erp/service-orders?')) return [];
  if (pathname === '/api/erp/contracts' || pathname.startsWith('/api/erp/contracts?')) return [];
  if (pathname === '/api/erp/expenses' || pathname.startsWith('/api/erp/expenses?')) return [];
  if (pathname === '/api/erp/expense-categories') return [];
  if (pathname === '/api/erp/recurring-expenses') return [];
  if (pathname === '/api/erp/doc-settings') return [];
  if (pathname === '/api/erp/contract-templates') return [];
  if (pathname === '/api/erp/categories') return [];
  if (pathname === '/api/erp/employees') return [];
  if (pathname === '/api/erp/vehicles') return [];
  if (pathname === '/api/erp/movements' || pathname.startsWith('/api/erp/movements?')) return [];
  if (pathname === '/api/erp/companies') return [];
  if (pathname === '/api/erp/dashboard') {
    return { lowStock: [], expiring: [], totals: { totalItems: 0, totalCategories: 0, totalEmployees: 0 }, alertCount: 0 };
  }
  // Fallback ERP — arrays vazios
  if (pathname.startsWith('/api/erp/')) return [];
  if (pathname === '/api/settings') return {};

  // Geocoding — placeholder neutro
  if (pathname.startsWith('/api/geocoding/cep/')) {
    return { logradouro: 'Rua Exemplo', bairro: 'Centro', localidade: 'São Paulo', uf: 'SP' };
  }
  if (pathname.startsWith('/api/geocoding')) return { lat: -23.5505, lng: -46.6333 };

  // Fallback genérico — nunca deixa a UI quebrar
  if (method === 'GET') return [];
  return { ok: true, demo: true };
}

function jsonResponse(body: JsonBody, status = 200): Response {
  return new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─────────────────────────────────────────────────────────────
// Instalação do interceptor
// ─────────────────────────────────────────────────────────────
const ORIGINAL_FETCH_KEY = '__demoOriginalFetch__' as const;

export function installDemoFetch() {
  if ((window as any)[ORIGINAL_FETCH_KEY]) return; // já instalado
  const original = window.fetch.bind(window);
  (window as any)[ORIGINAL_FETCH_KEY] = original;

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL ? input.toString() : (input as Request).url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    const { isApi, path } = isApiRequest(url);

    // Deixa passar: não-API, auth (login/verify/logout) e uploads de mídia
    if (!isApi || path.startsWith('/api/auth')) {
      return original(input as any, init);
    }

    // Simula pequena latência pra sensação natural
    await new Promise(r => setTimeout(r, 120));

    const body = matchMock(method, path);
    return jsonResponse(body);
  }) as typeof window.fetch;
}

export function uninstallDemoFetch() {
  const original = (window as any)[ORIGINAL_FETCH_KEY];
  if (original) {
    window.fetch = original;
    delete (window as any)[ORIGINAL_FETCH_KEY];
  }
}

/** Chama no bootstrap: se o usuário já é demo, ativa mocks. */
export function bootstrapDemoMode() {
  if (isDemoUser()) installDemoFetch();
}
