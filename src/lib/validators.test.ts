import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  driverSchema,
  truckSchema,
  customerSchema,
  emailSchema,
  phoneSchema,
  cepSchema,
} from './validators';

describe('loginSchema', () => {
  it('aceita credenciais válidas', () => {
    expect(loginSchema.safeParse({ username: 'admin', password: 'x' }).success).toBe(true);
  });
  it('rejeita usuário vazio', () => {
    const r = loginSchema.safeParse({ username: '   ', password: 'x' });
    expect(r.success).toBe(false);
  });
});

describe('primitivos', () => {
  it('email valida formato', () => {
    expect(emailSchema.safeParse('a@b.co').success).toBe(true);
    expect(emailSchema.safeParse('invalido').success).toBe(false);
  });
  it('phone aceita 10 ou 11 dígitos', () => {
    expect(phoneSchema.safeParse('(11) 91234-5678').success).toBe(true);
    expect(phoneSchema.safeParse('123').success).toBe(false);
  });
  it('cep exige 8 dígitos', () => {
    expect(cepSchema.safeParse('01310-100').success).toBe(true);
    expect(cepSchema.safeParse('123').success).toBe(false);
  });
});

describe('driverSchema', () => {
  it('aceita motorista mínimo', () => {
    expect(driverSchema.safeParse({ name: 'João', username: 'joao' }).success).toBe(true);
  });
  it('rejeita nome vazio', () => {
    expect(driverSchema.safeParse({ name: '', username: 'joao' }).success).toBe(false);
  });
});

describe('truckSchema', () => {
  it('aceita caminhão com placa', () => {
    expect(truckSchema.safeParse({ plate: 'ABC1D23' }).success).toBe(true);
  });
  it('rejeita ano absurdo', () => {
    const r = truckSchema.safeParse({ plate: 'ABC1D23', year: 1800 });
    expect(r.success).toBe(false);
  });
});

describe('customerSchema', () => {
  it('aceita PF com CPF válido', () => {
    const r = customerSchema.safeParse({
      customerName: 'Maria',
      personType: 'PF',
      document: '529.982.247-25', // CPF válido
    });
    expect(r.success).toBe(true);
  });
  it('rejeita PF com CPF inválido', () => {
    const r = customerSchema.safeParse({
      customerName: 'Maria',
      personType: 'PF',
      document: '111.111.111-11',
    });
    expect(r.success).toBe(false);
  });
  it('aceita cliente sem documento', () => {
    const r = customerSchema.safeParse({
      customerName: 'Maria',
      personType: 'PF',
      document: '',
    });
    expect(r.success).toBe(true);
  });
});
