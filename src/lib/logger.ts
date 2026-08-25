import { API_BASE_URL } from "@/services/config";

/**
 * Logger estruturado leve para frontend.
 * Saída em JSON no console e opcionalmente enviada para o servidor.
 */
type Level = "debug" | "info" | "warn" | "error" | "success" | "auth" | "db" | "os" | "finance";

interface LogContext {
  [key: string]: unknown;
}

const isDev = import.meta.env.DEV;

const LevelStyles: Record<string, { emoji: string; color: string }> = {
  debug: { emoji: '🔍', color: '#666' },
  info: { emoji: 'ℹ️', color: '#0ea5e9' },
  warn: { emoji: '⚠️', color: '#f59e0b' },
  error: { emoji: '🔥', color: '#ef4444' },
  success: { emoji: '✅', color: '#22c55e' },
  auth: { emoji: '🔐', color: '#a855f7' },
  db: { emoji: '🗄️', color: '#3b82f6' },
  os: { emoji: '🛠️', color: '#f97316' },
  finance: { emoji: '💰', color: '#eab308' }
};

async function emit(level: Level, message: string, context?: LogContext) {
  const ts = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  const entry = {
    ts,
    level,
    message,
    ...(context ?? {}),
  };

  const style = LevelStyles[level] || LevelStyles.info;

  // 1. Console Log Vibrante
  console.log(
    `%c${style.emoji} [${ts}] [${level.toUpperCase()}] %c${message}`,
    `color: ${style.color}; font-weight: bold;`,
    "color: inherit; font-weight: normal;",
    context ?? ""
  );

  // 2. Enviar para o servidor (Verbosidade Total no Detective Mode)
  // Enviamos quase tudo para o servidor no Detective Mode, exceto debug
  if (level !== "debug") {
    try {
      fetch(`${API_BASE_URL}/logs/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          level: level.toUpperCase(), 
          message: `${style.emoji} ${message}`, 
          context 
        }),
        keepalive: true
      }).catch(() => {});
    } catch (e) {}
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
  success: (msg: string, ctx?: LogContext) => emit("success", msg, ctx),
  auth: (msg: string, ctx?: LogContext) => emit("auth", msg, ctx),
  db: (msg: string, ctx?: LogContext) => emit("db", msg, ctx),
  os: (msg: string, ctx?: LogContext) => emit("os", msg, ctx),
  finance: (msg: string, ctx?: LogContext) => emit("finance", msg, ctx),
};


/**
 * Registra handlers globais para erros não tratados.
 * Idempotente: pode ser chamado múltiplas vezes sem duplicar.
 */
let installed = false;
export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    logger.error("window.error", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      col: event.colno,
      stack: event.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    logger.error("unhandledrejection", {
      message: reason?.message ?? String(reason),
      stack: reason?.stack,
    });
  });
}
