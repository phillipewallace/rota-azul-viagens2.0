-- Security tables for brute-force protection and session tracking
-- Run after the schema deployments have created erp_funcionarios and other base tables.

CREATE TABLE IF NOT EXISTS public.login_attempt_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_key TEXT NOT NULL,        -- username/CPF informado (sanitizado)
  ip_address INET NOT NULL,
  user_agent TEXT,
  session_id TEXT,
  succeeded BOOLEAN NOT NULL DEFAULT false,
  failed_at TIMESTAMPTZ,            -- preenchido apenas quando succeeded=false
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempt_tracker_ip_failed_at
  ON public.login_attempt_tracker (ip_address, failed_at DESC)
  WHERE succeeded = false;

CREATE INDEX IF NOT EXISTS idx_login_attempt_tracker_key_failed_at
  ON public.login_attempt_tracker (attempt_key, failed_at DESC)
  WHERE succeeded = false;

COMMENT ON TABLE public.login_attempt_tracker IS
  'Registro de tentativas de login para detecção de força bruta e auditoria de sessões.
   succeeded=true + session_id preenchido → sessão válida.
   succeeded=false + failed_at preenchido → tentativa falha.';
