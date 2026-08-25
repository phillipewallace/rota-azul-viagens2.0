/**
 * Tradução centralizada de erros do Postgres → mensagens amigáveis + status.
 * Evita vazar nome de constraints/colunas em `res.status(500).json({ error: e.message })`.
 *
 * Uso:
 *   } catch (e: any) { return sendError(res, e, '[erp-invoices POST]'); }
 */
import type { Response } from 'express';
import { logger } from './logger';

const PG_MAP: Record<string, { status: number; msg: string }> = {
  '23505': { status: 409, msg: 'Registro duplicado.' },        // unique_violation
  '23503': { status: 409, msg: 'Referência inválida ou em uso.' }, // foreign_key_violation
  '23502': { status: 400, msg: 'Campo obrigatório ausente.' }, // not_null_violation
  '23514': { status: 400, msg: 'Valor não permitido para o campo.' }, // check_violation
  '22001': { status: 400, msg: 'Valor excede o tamanho permitido.' }, // string_data_right_truncation
  '22P02': { status: 400, msg: 'Formato inválido para um dos campos.' }, // invalid_text_representation
};

export function sendError(res: Response, e: any, logTag = '[api]') {
  const code: string | undefined = e?.code;
  const status = e?.status || (code && PG_MAP[code] ? PG_MAP[code].status : 500);
  const message = (code && PG_MAP[code]) ? PG_MAP[code].msg : (e.message || 'Erro interno do servidor');

  // Log detalhado e profissional
  if (status >= 500) {
    logger.error(logTag, `Erro Crítico: ${message}`, { 
      stack: e.stack, 
      code, 
      detail: e.detail 
    });
  } else {
    logger.warn(logTag, `Erro de Requisição: ${message}`, { 
      code, 
      status 
    });
  }

  if (code && PG_MAP[code]) {
    return res.status(PG_MAP[code].status).json({ error: PG_MAP[code].msg });
  }

  if (typeof e?.status === 'number') {
    return res.status(e.status).json({ error: e.message || 'Erro na requisição' });
  }

  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({ error: e?.message || 'Erro interno' });
  }
  return res.status(500).json({ error: 'Erro interno do servidor.' });
}
