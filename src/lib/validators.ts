/**
 * Schemas de validação reutilizáveis (Zod).
 *
 * Estes schemas são a fonte da verdade para entradas do usuário e podem ser
 * adotados incrementalmente — basta `schema.safeParse(value)` no submit ou
 * conectar via `@hookform/resolvers/zod` quando o form usar react-hook-form.
 *
 * Mantemos as mensagens em PT-BR e sempre fazemos `.trim()` antes de validar
 * comprimentos, evitando que espaços em branco passem como conteúdo válido.
 */
import { z } from 'zod';
import { isValidCpf, isValidCnpj, onlyDigits } from '@/utils/brazilianDocs';

// ── Primitivos reutilizáveis ────────────────────────────────────────────────
export const nonEmptyString = (label = 'Campo', max = 255) =>
  z
    .string({ required_error: `${label} é obrigatório` })
    .trim()
    .min(1, { message: `${label} é obrigatório` })
    .max(max, { message: `${label} deve ter no máximo ${max} caracteres` });

export const optionalString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, { message: `Máximo de ${max} caracteres` })
    .optional()
    .or(z.literal(''));

export const emailSchema = z
  .string()
  .trim()
  .email({ message: 'E-mail inválido' })
  .max(255, { message: 'E-mail deve ter no máximo 255 caracteres' });

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => {
    const digits = onlyDigits(v);
    return digits.length === 10 || digits.length === 11;
  }, { message: 'Telefone deve ter 10 ou 11 dígitos' });

export const cepSchema = z
  .string()
  .trim()
  .refine((v) => onlyDigits(v).length === 8, { message: 'CEP deve ter 8 dígitos' });

export const cpfSchema = z
  .string()
  .trim()
  .refine((v) => isValidCpf(v), { message: 'CPF inválido' });

export const cnpjSchema = z
  .string()
  .trim()
  .refine((v) => isValidCnpj(v), { message: 'CNPJ inválido' });

// ── Schemas de domínio ──────────────────────────────────────────────────────
export const loginSchema = z.object({
  username: nonEmptyString('Usuário', 64),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(1, { message: 'Senha é obrigatória' })
    .max(128, { message: 'Senha muito longa' }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const driverSchema = z.object({
  name: nonEmptyString('Nome', 120),
  username: nonEmptyString('Usuário', 64),
  phone: phoneSchema.optional().or(z.literal('')),
  license: optionalString(32),
});
export type DriverInput = z.infer<typeof driverSchema>;

export const truckSchema = z.object({
  plate: nonEmptyString('Placa', 10),
  model: optionalString(80),
  year: z
    .number({ invalid_type_error: 'Ano deve ser numérico' })
    .int()
    .min(1950, { message: 'Ano inválido' })
    .max(new Date().getFullYear() + 1, { message: 'Ano inválido' })
    .optional(),
});
export type TruckInput = z.infer<typeof truckSchema>;

/**
 * Customer aceita PF ou PJ. O documento é validado conforme o tipo selecionado;
 * campos de endereço são opcionais para não bloquear cadastros parciais
 * (a UI já complementa via CEP/CNPJ lookup).
 */
export const customerSchema = z
  .object({
    customerName: nonEmptyString('Nome', 200),
    personType: z.enum(['PF', 'PJ'], {
      errorMap: () => ({ message: 'Tipo de pessoa inválido' }),
    }),
    document: z.string().trim().optional().or(z.literal('')),
    email: emailSchema.optional().or(z.literal('')),
    phone: phoneSchema.optional().or(z.literal('')),
    cep: cepSchema.optional().or(z.literal('')),
    address: optionalString(255),
    cidade: optionalString(120),
    estado: optionalString(2),
  })
  .superRefine((data, ctx) => {
    if (!data.document) return; // documento é opcional
    const ok = data.personType === 'PF' ? isValidCpf(data.document) : isValidCnpj(data.document);
    if (!ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['document'],
        message: data.personType === 'PF' ? 'CPF inválido' : 'CNPJ inválido',
      });
    }
  });
export type CustomerInput = z.infer<typeof customerSchema>;
