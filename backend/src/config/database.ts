
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { logger } from '../utils/logger';

const TAG = 'DATABASE';

dotenv.config();

// Pool principal para o banco da aplicação
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'alchemy_rotas',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const setupDatabase = async () => {
  try {
    logger.info(TAG, `Conectando ao banco de dados: ${process.env.DB_NAME || 'alchemy_rotas'}`);
    
    // Testa a conexão
    const client = await pool.connect();
    logger.info(TAG, `Conectado ao banco de dados '${process.env.DB_NAME || 'alchemy_rotas'}'`);
    
    // Verifica se as extensões estão instaladas
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // 🏗️ Garantir tabelas base que podem estar faltando devido a migrações parciais
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.erp_funcionarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome TEXT NOT NULL,
        cpf TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        tipo TEXT,
        active BOOLEAN DEFAULT TRUE,
        first_login BOOLEAN DEFAULT TRUE,
        telefone TEXT,
        email TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 🏗️ Garantir tabela sanitarios (estoque unificado)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.sanitarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        numero TEXT UNIQUE NOT NULL,
        modelo TEXT,
        categoria TEXT NOT NULL DEFAULT 'comum',
        status TEXT DEFAULT 'disponivel',
        estado_atual TEXT DEFAULT 'bom',
        tipo_locacao_alvo TEXT,
        current_customer_id UUID,
        current_customer_name TEXT,
        current_address TEXT,
        current_lat NUMERIC,
        current_lng NUMERIC,
        installed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 🏗️ Garantir tabela erp_sanitario_movimentacoes
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.erp_sanitario_movimentacoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sanitario_id UUID REFERENCES sanitarios(id) ON DELETE CASCADE,
        operation_type TEXT NOT NULL,
        customer_id UUID,
        customer_name TEXT,
        address TEXT,
        funcionario_id UUID REFERENCES erp_funcionarios(id),
        funcionario_nome TEXT,
        occurred_at TIMESTAMPTZ DEFAULT NOW(),
        notes TEXT,
        fotos TEXT[]
      )
    `);

    // 🏗️ Garantir tabela erp_sanitario_fotos
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.erp_sanitario_fotos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sanitario_id UUID REFERENCES sanitarios(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        tipo_evento TEXT,
        estado_conservacao TEXT,
        observacoes TEXT,
        funcionario_id UUID REFERENCES erp_funcionarios(id),
        funcionario_nome TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 🏗️ Garantir tabela erp_companies (Empresas Emissoras)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.erp_companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        razao_social TEXT NOT NULL,
        nome_fantasia TEXT,
        cnpj TEXT UNIQUE NOT NULL,
        inscricao_estadual TEXT,
        endereco TEXT,
        cidade TEXT,
        estado TEXT,
        cep TEXT,
        telefone TEXT,
        email TEXT,
        logo_url TEXT,
        assinatura_url TEXT,
        financeiro_contato TEXT,
        sigla TEXT,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 🏗️ Garantir tabela erp_doc_settings_company (Numeração por Empresa)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.erp_doc_settings_company (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES erp_companies(id) ON DELETE CASCADE,
        doc_type TEXT NOT NULL,
        prefix TEXT,
        last_number INTEGER DEFAULT 0,
        year INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(company_id, doc_type, year)
      )
    `);

    console.log('✅ Extensões e tabelas base do PostgreSQL verificadas');

    // 🛡️ Auto-migração defensiva — garante que todas as colunas usadas pelas
    // queries existem. 100% idempotente (ADD COLUMN IF NOT EXISTS).
    // NÃO toca em dados existentes, apenas adiciona o que faltar.
    const ensureCols: Array<[string, string, string]> = [
      // route_points
      ['route_points', 'sanitario_numbers', 'TEXT[]'],
      ['route_points', 'sanitario_recolhidos', 'TEXT[]'],
      ['route_points', 'point_category', 'TEXT'],
      ['route_points', 'operation_type', 'TEXT'],
      ['route_points', 'recolhido_qty', 'INTEGER'],
      ['route_points', 'auto_removed', 'BOOLEAN DEFAULT FALSE'],
      ['route_points', 'completed', 'BOOLEAN DEFAULT FALSE'],
      ['route_points', 'completed_at', 'TIMESTAMP'],
      ['route_points', 'customer_name', 'TEXT'],
      ['route_points', 'restrooms_qty', 'INTEGER'],
      ['route_points', 'cleanings_qty', 'INTEGER'],
      ['route_points', 'contact_name', 'TEXT'],
      ['route_points', 'contact_phone', 'TEXT'],
      ['route_points', 'notes', 'TEXT'],
      ['route_points', 'cep', 'TEXT'],
      ['route_points', 'stop_type', 'TEXT'],
      // routes
      ['routes', 'optimization_mode', "TEXT DEFAULT 'optimized'"],
      ['routes', 'description', 'TEXT'],
      ['routes', 'total_distance', 'NUMERIC'],
      ['routes', 'estimated_time', 'INTEGER'],
      ['routes', 'estimated_duration', 'INTEGER'],
      ['routes', 'optimized_order', 'JSONB'],
      ['routes', 'polyline', 'TEXT'],
      ['routes', 'status', "TEXT DEFAULT 'active'"],
      ['routes', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['routes', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      // trucks
      ['trucks', 'current_route', 'TEXT'],
      ['trucks', 'driver', 'TEXT'],
      ['trucks', 'current_route_id', 'UUID'],
      ['trucks', 'current_driver_id', 'UUID'],
      ['trucks', 'location_lat', 'NUMERIC'],
      ['trucks', 'location_lng', 'NUMERIC'],
      ['trucks', 'mileage', 'INTEGER DEFAULT 0'],
      ['trucks', 'last_maintenance', 'DATE'],
      ['trucks', 'status', "TEXT DEFAULT 'available'"],
      ['trucks', 'model', 'TEXT'],
      ['trucks', 'year', 'INTEGER'],
      ['trucks', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['trucks', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      // drivers
      ['drivers', 'phone', 'TEXT'],
      ['drivers', 'license', 'TEXT'],
      ['drivers', 'license_expiry', 'DATE'],
      ['drivers', 'status', "TEXT DEFAULT 'active'"],
      ['drivers', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['drivers', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      // schedules
      ['schedules', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['schedules', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      // customers
      ['customers', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['customers', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      // erp_service_orders
      ['erp_service_orders', 'funcionario_id', 'UUID REFERENCES erp_funcionarios(id)'],
      ['erp_service_orders', 'use_new_flow', 'BOOLEAN DEFAULT TRUE'],
      ['erp_service_orders', 'numero', 'TEXT'], // Segurança extra para tabelas que podem estar inconsistentes
      ['erp_service_orders', 'company_id', 'UUID REFERENCES erp_companies(id)'],
      ['erp_service_orders', 'entregue_por_id', 'UUID REFERENCES erp_funcionarios(id)'],
      ['erp_service_orders', 'recolhido_por_id', 'UUID REFERENCES erp_funcionarios(id)'],
      ['erp_service_orders', 'entregue_por_nome', 'TEXT'],
      ['erp_service_orders', 'recolhido_por_nome', 'TEXT'],
      ['erp_service_orders', 'data_recolhimento_solicitada', 'DATE'],
      ['erp_sanitario_fotos', 'funcionario_nome', 'TEXT'],

      // erp_quotes
      ['erp_quotes', 'company_id', 'UUID REFERENCES erp_companies(id)'],
      ['erp_quotes', 'endereco_entrega', 'TEXT'],
      ['erp_quotes', 'data_recolhimento', 'DATE'],
      ['erp_quotes', 'responsavel_nome', 'TEXT'],
      ['erp_quotes', 'responsavel_telefone', 'TEXT'],
      ['erp_quotes', 'responsavel_email', 'TEXT'],
      ['erp_quotes', 'tipo_locacao', 'TEXT'],
      ['erp_quotes', 'forma_pagamento', 'TEXT'],
      ['erp_quotes', 'pdf_gerado_em', 'TIMESTAMPTZ'],
      // erp_service_orders (mais colunas)
      ['erp_service_orders', 'endereco_entrega', 'TEXT'],
      ['erp_service_orders', 'data_entrega', 'DATE'],
      ['erp_service_orders', 'data_recolhimento', 'DATE'],
      ['erp_service_orders', 'qtd_reservada', 'INTEGER DEFAULT 0'],
      ['erp_service_orders', 'forma_pagamento', 'TEXT'],
      ['erp_service_orders', 'tipo_locacao', 'TEXT'],
      ['erp_service_orders', 'limpezas_semanais', 'INTEGER'],
      // erp_invoices
      ['erp_invoices', 'company_id', 'UUID REFERENCES erp_companies(id)'],
      // erp_medicoes
      ['erp_medicoes', 'company_id', 'UUID REFERENCES erp_companies(id)'],
      // erp_receipts
      ['erp_receipts', 'company_id', 'UUID REFERENCES erp_companies(id)'],
      // erp_expenses
      ['erp_expenses', 'company_id', 'UUID REFERENCES erp_companies(id)'],
      // erp_signed_pdfs
      ['erp_signed_pdfs', 'company_id', 'UUID REFERENCES erp_companies(id)'],
      // maintenance_records
      ['maintenance_records', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['maintenance_records', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      // erp_quote_items
      ['erp_quote_items', 'is_sanitario', 'BOOLEAN DEFAULT FALSE'],
      ['erp_quote_items', 'is_generic_service', 'BOOLEAN DEFAULT FALSE'],
      // erp_os_history
      ['erp_os_history', 'os_id', 'UUID REFERENCES erp_service_orders(id) ON DELETE CASCADE'],
      ['erp_os_history', 'tipo', 'TEXT'],
      ['erp_os_history', 'descricao', 'TEXT'],
      ['erp_os_history', 'payload', 'JSONB'],
      ['erp_os_history', 'created_by', 'UUID REFERENCES auth.users(id)'],
      // erp_os_notes
      ['erp_os_notes', 'os_id', 'UUID REFERENCES erp_service_orders(id) ON DELETE CASCADE'],
      ['erp_os_notes', 'note', 'TEXT'],
      ['erp_os_notes', 'author_name', 'TEXT'],
      ['erp_os_notes', 'created_by', 'UUID REFERENCES auth.users(id)'],

    ];
    for (const [table, col, type] of ensureCols) {
      try {
        await client.query(`ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`);
      } catch (e) {
        console.warn(`⚠️ Não foi possível garantir ${table}.${col}:`, (e as Error).message);
      }
    }

    // Garantir tabela auxiliar truck_location_history
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.truck_location_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          truck_id UUID NOT NULL,
          lat NUMERIC NOT NULL,
          lng NUMERIC NOT NULL,
          recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) {
      console.warn('⚠️ Não foi possível garantir truck_location_history:', (e as Error).message);
    }

    // 🏗️ Garantir tabelas de histórico e notas
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.erp_os_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        os_id UUID REFERENCES erp_service_orders(id) ON DELETE CASCADE,
        tipo TEXT NOT NULL,
        descricao TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES public.users(id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.erp_os_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        os_id UUID REFERENCES erp_service_orders(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        author_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES public.users(id)
      )
    `);

    // 🏗️ Garantir tabela de tipos de sanitários
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.erp_sanitario_tipos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome TEXT NOT NULL UNIQUE,
        descricao TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Inserir tipos padrão
    await client.query(`
      INSERT INTO public.erp_sanitario_tipos (nome, descricao)
      VALUES 
        ('Comum', 'Sanitário químico padrão'),
        ('PNE', 'Sanitário adaptado para pessoas com necessidades especiais'),
        ('Pia', 'Sanitário com lavatório interno'),
        ('Luxo', 'Sanitário de alto padrão para eventos vip'),
        ('Banho', 'Cabine de chuveiro/banho'),
        ('Rede Esgoto', 'Conectado diretamente à rede de esgoto')
      ON CONFLICT (nome) DO NOTHING
    `);

    // Garantir colunas extras em sanitarios (tabela base)
    const sanCols: Array<[string, string]> = [
      ['categoria', 'TEXT DEFAULT \'comum\''],
      ['tipo_locacao_alvo', 'TEXT'],
      ['estado_atual', 'TEXT DEFAULT \'bom\'']
    ];
    for (const [col, type] of sanCols) {
      try {
        await client.query(`ALTER TABLE public.sanitarios ADD COLUMN IF NOT EXISTS ${col} ${type}`);
      } catch (e) {}
    }

    console.log('✅ Colunas críticas verificadas');

    client.release();
    console.log('✅ Configuração do banco de dados completa');
  } catch (err) {
    console.error('❌ Erro ao configurar o banco de dados:', err);
    console.error('🔍 Verifique se o PostgreSQL está rodando e as credenciais estão corretas');
    console.error('📝 Para criar o banco, execute: CREATE DATABASE alchemy_rotas;');
    throw err;
  }
};

// Função para verificar se as tabelas existem
export const checkTables = async () => {
  try {
    const client = await pool.connect();
    
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'drivers', 'trucks', 'routes', 'schedules', 'maintenance_records')
    `);
    
    console.log(`📊 Tabelas encontradas: ${tablesCheck.rows.map(r => r.table_name).join(', ')}`);
    
    if (tablesCheck.rows.length < 6) {
      console.log('⚠️  Algumas tabelas estão faltando. Execute o arquivo complete-schema-fixed.sql');
    }
    
    client.release();
  } catch (err) {
    console.error('❌ Erro ao verificar tabelas:', err);
  }
};

// Export setupDatabase as createTables for compatibility
export const createTables = setupDatabase;

export { pool };
