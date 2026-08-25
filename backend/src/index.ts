import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pool } from './config/database';
import path from 'path';
import { requestLogger, logger } from './utils/logger';

// Import routes
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import routesRoutes from './routes/routes';
import trucksRoutes from './routes/trucks';
import schedulesRoutes from './routes/schedules';
import geocodingRoutes from './routes/geocoding';
import mobileRoutes from './routes/mobile';
import mobileExtraRoutes from './routes/mobile-extra';
import maintenanceRoutes from './routes/maintenance';
import managementRoutes from './routes/management';
import settingsRoutes from './routes/settings';
import uploadRoutes from './routes/upload';
import analyticsRoutes from './routes/analytics';
import customersRoutes from './routes/customers';
import photosRoutes from './routes/photos';
import completedRoutesRoutes from './routes/completed-routes';
import trackingRoutes from './routes/tracking';
import sanitariosRoutes from './routes/sanitarios';
import erpInventoryRoutes from './routes/erp-inventory';
import erpCompaniesRoutes from './routes/erp-companies';
import erpQuotesRoutes from './routes/erp-quotes';
import erpServiceOrdersRoutes from './routes/erp-service-orders';
import erpDocSettingsRoutes from './routes/erp-doc-settings';
import erpContractsRoutes from './routes/erp-contracts';
import erpContractTemplatesRoutes from './routes/erp-contract-templates';
import erpReceiptsRoutes from './routes/erp-receipts';
import erpInvoicesRoutes from './routes/erp-invoices';
import erpMedicoesRoutes from './routes/erp-medicoes';
import erpExpensesRoutes from './routes/erp-expenses';
import erpExpenseCategoriesRoutes from './routes/erp-expense-categories';
import erpRecurringExpensesRoutes from './routes/erp-recurring-expenses';
import erpSignedPdfsRoutes from './routes/erp-signed-pdfs';
import checklistsRoutes from './routes/checklists';
import carretinhasRoutes from './routes/carretinhas';
import erpFuncionariosRoutes from './routes/erp-funcionarios';
import erpSanitariosNewRoutes from './routes/erp-sanitarios-new';
import appFuncionariosRoutes from './routes/app-funcionarios';
import erpOsHistoryRoutes from './routes/erp-os-history';
import erpOsRecolhimentoRoutes from './routes/erp-os-recolhimento';
import { requireAuth } from './middleware/requireAuth';
import { restrictDemo } from './middleware/restrictDemo';

const app = express();
const PORT = process.env.PORT || 3002;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(requestLogger);

const ALLOWED_ORIGINS = [
  'http://localhost:5173', 'http://localhost:8080', 'http://192.168.1.100:5173',
  'https://alchemyrotas.com', 'https://www.alchemyrotas.com',
  'capacitor://localhost', 'http://localhost', 'https://localhost', 'ionic://localhost',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (/\.lovableproject\.com$/.test(new URL(origin).hostname) || /\.lovable\.app$/.test(new URL(origin).hostname)) {
      return cb(null, true);
    }
    return cb(new Error(`Origem não permitida: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/erp/funcionarios/login', authLimiter);

// Centralized log intake
app.post('/api/logs/client', (req, res) => {
  const { level, message, context } = req.body;
  logger.log(level || 'INFO', 'CLIENT-LOG', message, context);
  res.status(200).json({ ok: true });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/erp/funcionarios', erpFuncionariosRoutes);
app.use('/api/app-funcionarios', appFuncionariosRoutes);
app.use('/api/auth', authRoutes);
app.use(restrictDemo);

app.use('/api/users', usersRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/trucks', trucksRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/mobile', mobileExtraRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/completed-routes', completedRoutesRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/sanitarios', sanitariosRoutes);
app.use('/api/erp', erpInventoryRoutes);
app.use('/api/erp/companies', erpCompaniesRoutes);
app.use('/api/erp/quotes', erpQuotesRoutes);
app.use('/api/erp/service-orders', erpServiceOrdersRoutes);
app.use('/api/erp/doc-settings', erpDocSettingsRoutes);
app.use('/api/erp/contracts', erpContractsRoutes);
app.use('/api/erp/contract-templates', erpContractTemplatesRoutes);
app.use('/api/erp/receipts', erpReceiptsRoutes);
app.use('/api/erp/invoices', erpInvoicesRoutes);
app.use('/api/erp/medicoes', erpMedicoesRoutes);
app.use('/api/erp/expenses', erpExpensesRoutes);
app.use('/api/erp/expense-categories', erpExpenseCategoriesRoutes);
app.use('/api/erp/recurring-expenses', erpRecurringExpensesRoutes);
app.use('/api/erp/signed-pdfs', erpSignedPdfsRoutes);
app.use('/api/checklists', checklistsRoutes);
app.use('/api/carretinhas', carretinhasRoutes);
app.use('/api/erp/sanitarios-new', erpSanitariosNewRoutes);
app.use('/api/erp/service-orders', erpOsHistoryRoutes);
app.use('/api/erp/service-orders', erpOsRecolhimentoRoutes);

const SENSITIVE_UPLOAD_PREFIXES = ['/invoices/', '/signed/', '/receipts/'];
app.use('/uploads', (req, res, next) => {
  if (!SENSITIVE_UPLOAD_PREFIXES.some(p => req.path.startsWith(p))) return next();
  if (!req.headers.authorization && typeof req.query.token === 'string' && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return (requireAuth as any)(req, res, next);
});
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), { maxAge: '7d' }));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('/var/www/rota-azul-viagens/dist'));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile('/var/www/rota-azul-viagens/dist/index.html');
    }
  });
}

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('SERVER-ERROR', err.message, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info('SERVER', `Servidor rodando na porta ${PORT}`);
});
