import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

// Garantir que a pasta de logs existe
const LOGS_DIR = path.join(process.cwd(), 'backend', 'src', 'logs');
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG',
    AUTH = 'AUTH',
    DB = 'DB',
    SUCCESS = 'SUCCESS',
    OS = 'OS',
    FINANCE = 'FINANCE'
}

const LevelConfig: Record<LogLevel, { emoji: string; color: string }> = {
    [LogLevel.INFO]: { emoji: 'ℹ️', color: '\x1b[36m' },    // Cyan
    [LogLevel.WARN]: { emoji: '⚠️', color: '\x1b[33m' },    // Yellow
    [LogLevel.ERROR]: { emoji: '🔥', color: '\x1b[31m' },   // Red
    [LogLevel.DEBUG]: { emoji: '🔍', color: '\x1b[90m' },   // Gray
    [LogLevel.AUTH]: { emoji: '🔐', color: '\x1b[35m' },    // Magenta
    [LogLevel.DB]: { emoji: '🗄️', color: '\x1b[34m' },     // Blue
    [LogLevel.SUCCESS]: { emoji: '✅', color: '\x1b[32m' },  // Green
    [LogLevel.OS]: { emoji: '🛠️', color: '\x1b[38;5;208m' }, // Orange
    [LogLevel.FINANCE]: { emoji: '💰', color: '\x1b[38;5;190m' } // Gold
};

class Logger {
    private getTimestamp() {
        return new Date().toLocaleTimeString('pt-BR', { hour12: false }) + '.' + new Date().getMilliseconds().toString().padStart(3, '0');
    }

    private formatMessage(level: LogLevel, tag: string, message: string, data?: any) {
        const timestamp = this.getTimestamp();
        const config = LevelConfig[level] || LevelConfig[LogLevel.INFO];
        
        let header = `${config.emoji} [${timestamp}] [${level}] [${tag}]`;
        let body = message;

        if (data && typeof data === 'object') {
            try {
                const dataStr = JSON.stringify(data, null, 2);
                body += `\n   ┗━━ Data: ${dataStr.replace(/\n/g, '\n   ')}`;
            } catch (e) {
                body += `\n   ┗━━ Data: [Unserializable Object]`;
            }
        } else if (data !== undefined && data !== null) {
            body += `\n   ┗━━ Data: ${String(data)}`;
        }
        
        return { 
            plain: `${header} ${body}`,
            colored: `${config.color}${header}\x1b[0m ${body}`
        };
    }

    private async writeToFile(message: string) {
        const fileName = `${new Date().toISOString().split('T')[0]}.log`;
        const filePath = path.join(LOGS_DIR, fileName);
        fs.appendFile(filePath, message + '\n', (err) => {
            if (err) console.error('❌ [LOGGER] Erro ao escrever no arquivo:', err);
        });
    }

    public log(level: LogLevel, tag: string, message: string, data?: any) {
        const { plain, colored } = this.formatMessage(level, tag, message, data);
        
        // Print to server console with colors
        console.log(colored);

        this.writeToFile(plain);
    }

    public info(tag: string, message: string, data?: any) { this.log(LogLevel.INFO, tag, message, data); }
    public warn(tag: string, message: string, data?: any) { this.log(LogLevel.WARN, tag, message, data); }
    public error(tag: string, message: string, data?: any) { this.log(LogLevel.ERROR, tag, message, data); }
    public debug(tag: string, message: string, data?: any) { this.log(LogLevel.DEBUG, tag, message, data); }
    public auth(tag: string, message: string, data?: any) { this.log(LogLevel.AUTH, tag, message, data); }
    public db(tag: string, message: string, data?: any) { this.log(LogLevel.DB, tag, message, data); }
    public success(tag: string, message: string, data?: any) { this.log(LogLevel.SUCCESS, tag, message, data); }
    public os(tag: string, message: string, data?: any) { this.log(LogLevel.OS, tag, message, data); }
    public finance(tag: string, message: string, data?: any) { this.log(LogLevel.FINANCE, tag, message, data); }
}

export const logger = new Logger();

/**
 * Middleware para logar requisições HTTP
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, url, ip, body, query } = req;
    const userAgent = req.get('user-agent') || 'Unknown';

    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const tag = 'NETWORK';
        
        const emoji = status >= 500 ? '💥' : status >= 400 ? '⚠️' : '🌐';
        const msg = `${emoji} ${method} ${url} | Status: ${status} | Time: ${duration}ms | IP: ${ip}`;
        
        const context: any = { duration: `${duration}ms`, ip };
        
        // Verbosidade total: Logar body/query em rotas que não sejam sensíveis (auth)
        if (!url.includes('/auth') && !url.includes('/login')) {
            if (query && typeof query === 'object' && Object.keys(query).length > 0) {
                context.query = query;
            }
            if (body && typeof body === 'object' && Object.keys(body).length > 0) {
                context.body = body;
            }
        }

        if (status >= 500) {
            logger.error(tag, msg, context);
        } else if (status >= 400) {
            logger.warn(tag, msg, context);
        } else {
            logger.info(tag, msg, context);
        }
    });

    next();
}
