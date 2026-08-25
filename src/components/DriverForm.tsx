import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Driver } from '@/hooks/useDrivers';

interface DriverFormProps {
  driver?: Driver;
  onSubmit: (data: Omit<Driver, 'id'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const LICENSE_CATEGORIES = ['A', 'B', 'AB', 'C', 'D', 'E'] as const;

export const DriverForm = ({ driver, onSubmit, onCancel, isLoading }: DriverFormProps) => {
  const { register, handleSubmit, setValue, watch } = useForm<Omit<Driver, 'id'>>({
    defaultValues: driver
      ? {
          name: driver.name,
          phone: driver.phone,
          email: driver.email,
          license: driver.license,
          licenseCategory: driver.licenseCategory ?? '',
          status: driver.status,
        }
      : {
          name: '',
          phone: '',
          email: '',
          license: '',
          licenseCategory: '',
          status: 'active' as const,
        },
  });

  const status = watch('status');
  const licenseCategory = watch('licenseCategory') || '';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome Completo</Label>
        <Input id="name" {...register('name', { required: true })} placeholder="Ex: João Silva" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefone</Label>
        <Input id="phone" {...register('phone', { required: true })} placeholder="(11) 99999-9999" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" {...register('email', { required: true })} placeholder="joao@exemplo.com" />
      </div>

      <div className="grid grid-cols-[1fr_140px] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="license">CNH</Label>
          <Input id="license" {...register('license', { required: true })} placeholder="12345678901" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="licenseCategory">Categoria</Label>
          <SearchableSelect
            id="licenseCategory"
            value={licenseCategory}
            onValueChange={(value) => setValue('licenseCategory', value)}
            placeholder="—"
            options={LICENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <SearchableSelect
          id="status"
          value={status}
          onValueChange={(value) => setValue('status', value as Driver['status'])}
          placeholder="Status"
          options={[
            { value: 'active', label: 'Ativo' },
            { value: 'inactive', label: 'Inativo' },
          ]}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isLoading}>
          {driver ? 'Atualizar' : 'Criar'} Motorista
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};
