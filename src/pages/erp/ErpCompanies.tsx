/**
 * ERP — Empresas emissoras (CNPJs usados nos orçamentos/OS).
 * Reutiliza o componente CompaniesSettings do app principal.
 */
import React from 'react';
import CompaniesSettings from '@/components/settings/CompaniesSettings';

const ErpCompanies: React.FC = () => (
  <div className="p-6 md:p-8 max-w-5xl mx-auto">
    <header className="mb-6">
      <h1 className="text-2xl font-bold text-slate-900">Empresas Emissoras</h1>
      <p className="text-slate-500 text-sm">CNPJs cadastrados para emissão de orçamentos e ordens de serviço.</p>
    </header>
    <CompaniesSettings />
  </div>
);

export default ErpCompanies;
