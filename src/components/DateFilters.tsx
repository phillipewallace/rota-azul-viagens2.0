
import React from 'react';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface DateFiltersProps {
  selectedMonth: string;
  selectedYear: string;
  onMonthChange: (month: string) => void;
  onYearChange: (year: string) => void;
}

export const DateFilters: React.FC<DateFiltersProps> = ({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange
}) => {
  const months = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <SearchableSelect
          value={selectedMonth}
          onValueChange={onMonthChange}
          placeholder="Selecione o mês"
          searchPlaceholder="Buscar mês..."
          options={months}
        />
      </div>
      <div className="flex-1">
        <SearchableSelect
          value={selectedYear}
          onValueChange={onYearChange}
          placeholder="Selecione o ano"
          searchPlaceholder="Buscar ano..."
          options={years.map((y) => ({ value: y.toString(), label: y.toString() }))}
        />
      </div>
    </div>
  );
};
