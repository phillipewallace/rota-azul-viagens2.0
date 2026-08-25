// Checklist completo de inspeção de veículos.
// Usado tanto no formulário público quanto na visualização administrativa.

export type ChecklistStatus = 'ok' | 'attention' | 'critical' | 'na';
export type VehicleType = 'carroceria' | 'tanque' | 'carretinha';

export interface ChecklistItemDef {
  key: string;
  label: string;
}

export interface ChecklistCategoryDef {
  category: string;
  items: ChecklistItemDef[];
  /** Se definido, a categoria só aparece para os tipos de veículo correspondentes. */
  vehicleTypes?: VehicleType[];
}

// ============ CHECKLIST CAMINHÃO (carroceria/tanque) ============
const TRUCK_TEMPLATE: ChecklistCategoryDef[] = [
  {
    category: 'Externo / Lataria',
    vehicleTypes: ['carroceria', 'tanque'],
    items: [
      { key: 'parachoque_dianteiro', label: 'Para-choque dianteiro' },
      { key: 'parachoque_traseiro', label: 'Para-choque traseiro' },
      { key: 'retrovisor_esq', label: 'Retrovisor esquerdo' },
      { key: 'retrovisor_dir', label: 'Retrovisor direito' },
      { key: 'placas_visiveis', label: 'Placas legíveis' },
      { key: 'adesivos', label: 'Adesivos / identificação visual' },
      { key: 'vazamentos_visiveis', label: 'Sem vazamentos visíveis no chão' },
      { key: 'lataria_geral', label: 'Lataria sem amassados/avarias' },
    ],
  },
  {
    category: 'Iluminação',
    vehicleTypes: ['carroceria', 'tanque'],
    items: [
      { key: 'farol_baixo', label: 'Farol baixo' },
      { key: 'farol_alto', label: 'Farol alto' },
      { key: 'farol_neblina', label: 'Farol de neblina' },
      { key: 'lanternas_traseiras', label: 'Lanternas traseiras' },
      { key: 'luz_freio', label: 'Luz de freio' },
      { key: 'luz_re', label: 'Luz de ré' },
      { key: 'setas', label: 'Setas dianteiras e traseiras' },
      { key: 'pisca_alerta', label: 'Pisca-alerta' },
      { key: 'luz_placa', label: 'Luz da placa' },
      { key: 'luz_interna', label: 'Luz interna da cabine' },
    ],
  },
  {
    category: 'Pneus e Rodas',
    vehicleTypes: ['carroceria', 'tanque'],
    items: [
      { key: 'pneu_diant_esq', label: 'Pneu dianteiro esquerdo' },
      { key: 'pneu_diant_dir', label: 'Pneu dianteiro direito' },
      { key: 'pneu_tras_esq', label: 'Pneu traseiro esquerdo' },
      { key: 'pneu_tras_dir', label: 'Pneu traseiro direito' },
      { key: 'calibragem', label: 'Calibragem correta' },
      { key: 'sulcos', label: 'Sulcos dentro do limite legal' },
      { key: 'parafusos_roda', label: 'Parafusos das rodas' },
    ],
  },
  {
    category: 'Motor / Compartimento',
    vehicleTypes: ['carroceria', 'tanque'],
    items: [
      { key: 'oleo_motor', label: 'Nível de óleo do motor' },
      { key: 'agua_radiador', label: 'Água do radiador' },
      { key: 'fluido_freio', label: 'Fluido de freio' },
      { key: 'arla', label: 'Nível de Arla 32' },
      { key: 'correias', label: 'Correias e mangueiras' },
      { key: 'vazamento_motor', label: 'Sem vazamento no motor' },
      { key: 'tacografo', label: 'Tacógrafo aferido' },
    ],
  },
  {
    category: 'Cabine Interna',
    vehicleTypes: ['carroceria', 'tanque'],
    items: [
      { key: 'cintos', label: 'Cintos de segurança' },
      { key: 'bancos', label: 'Bancos / regulagem' },
      { key: 'painel_instrumentos', label: 'Painel de instrumentos' },
      { key: 'ar_condicionado', label: 'Ar-condicionado' },
      { key: 'buzina', label: 'Buzina' },
      { key: 'limpadores', label: 'Limpadores de para-brisa' },
      { key: 'palhetas', label: 'Palhetas em bom estado' },
      { key: 'esguicho_agua', label: 'Esguicho de água' },
      { key: 'espelhos_internos', label: 'Espelhos internos' },
    ],
  },
  {
    category: 'Freios e Suspensão',
    vehicleTypes: ['carroceria', 'tanque'],
    items: [
      { key: 'freio_servico', label: 'Freio de serviço' },
      { key: 'freio_estacionamento', label: 'Freio de estacionamento' },
      { key: 'abs', label: 'Sistema ABS' },
      { key: 'ruidos_freio', label: 'Sem ruídos no freio' },
      { key: 'suspensao', label: 'Suspensão' },
      { key: 'amortecedores', label: 'Amortecedores' },
    ],
  },
  {
    category: 'Carroceria (3/4 embutida)',
    vehicleTypes: ['carroceria'],
    items: [
      { key: 'travas_carroceria', label: 'Travas da carroceria' },
      { key: 'ganchos', label: 'Ganchos / correntes' },
      { key: 'plataforma', label: 'Plataforma / assoalho' },
      { key: 'estrutura_carroceria', label: 'Estrutura / fixação da carroceria embutida' },
      { key: 'portas_carroceria', label: 'Portas e fechaduras da carroceria' },
    ],
  },
  {
    category: 'Tanque / Equipamentos Sanitários',
    vehicleTypes: ['tanque'],
    items: [
      { key: 'plataforma_tanque', label: 'Plataforma do tanque' },
      { key: 'tanque_dejeto', label: 'Tanque de dejetos' },
      { key: 'tanque_agua_limpa', label: 'Tanque de água limpa' },
      { key: 'mangueiras', label: 'Mangueiras' },
      { key: 'bomba', label: 'Bomba sucção' },
      { key: 'valvulas', label: 'Válvulas de descarga' },
      { key: 'vazamento_sanitario', label: 'Sem vazamentos no sistema' },
    ],
  },
  {
    category: 'Limpeza',
    vehicleTypes: ['carroceria', 'tanque'],
    items: [
      { key: 'limpeza_cabine', label: 'Cabine limpa' },
      { key: 'limpeza_externa', label: 'Veículo limpo externamente' },
      { key: 'limpeza_compartimento', label: 'Compartimento de carga limpo' },
    ],
  },
];

// ============ CHECKLIST CARRETINHA ============
const CARRETINHA_TEMPLATE: ChecklistCategoryDef[] = [
  {
    category: 'Identificação',
    vehicleTypes: ['carretinha'],
    items: [
      { key: 'c_placa_visivel', label: 'Placa legível e fixada' },
      { key: 'c_chassi', label: 'Número de chassi visível' },
      { key: 'c_documento', label: 'Documento da carretinha em dia' },
    ],
  },
  {
    category: 'Estrutura e Lataria',
    vehicleTypes: ['carretinha'],
    items: [
      { key: 'c_chassi_estrutura', label: 'Chassi sem trincas/soldas comprometidas' },
      { key: 'c_assoalho', label: 'Assoalho / piso em bom estado' },
      { key: 'c_laterais', label: 'Laterais e portas' },
      { key: 'c_pintura', label: 'Pintura / sem ferrugem grave' },
      { key: 'c_para_lamas', label: 'Para-lamas fixos' },
    ],
  },
  {
    category: 'Acoplamento',
    vehicleTypes: ['carretinha'],
    items: [
      { key: 'c_engate', label: 'Engate / cabeçote em bom estado' },
      { key: 'c_trava_engate', label: 'Trava do engate funcional' },
      { key: 'c_corrente_seguranca', label: 'Correntes de segurança' },
      { key: 'c_pe_apoio', label: 'Pé de apoio / macaco regulável' },
      { key: 'c_conector_eletrico', label: 'Conector elétrico (chicote)' },
    ],
  },
  {
    category: 'Iluminação e Sinalização',
    vehicleTypes: ['carretinha'],
    items: [
      { key: 'c_lanterna_traseira', label: 'Lanternas traseiras' },
      { key: 'c_luz_freio', label: 'Luz de freio' },
      { key: 'c_setas', label: 'Setas direcionais' },
      { key: 'c_luz_placa', label: 'Luz da placa' },
      { key: 'c_refletivos', label: 'Faixas refletivas / catadióptricos' },
    ],
  },
  {
    category: 'Pneus e Rodas',
    vehicleTypes: ['carretinha'],
    items: [
      { key: 'c_pneu_esq', label: 'Pneu esquerdo' },
      { key: 'c_pneu_dir', label: 'Pneu direito' },
      { key: 'c_estepe', label: 'Estepe (se houver)' },
      { key: 'c_calibragem', label: 'Calibragem correta' },
      { key: 'c_parafusos', label: 'Parafusos das rodas' },
      { key: 'c_rolamentos', label: 'Cubos / rolamentos sem folga' },
    ],
  },
  {
    category: 'Freios e Suspensão',
    vehicleTypes: ['carretinha'],
    items: [
      { key: 'c_freio', label: 'Sistema de freio (se aplicável)' },
      { key: 'c_molas', label: 'Molas / feixes' },
      { key: 'c_suspensao', label: 'Suspensão geral' },
    ],
  },
  {
    category: 'Carga e Amarração',
    vehicleTypes: ['carretinha'],
    items: [
      { key: 'c_amarracoes', label: 'Pontos de amarração / olhais' },
      { key: 'c_cintas', label: 'Cintas / cordas em bom estado' },
      { key: 'c_lonas', label: 'Lonas / coberturas (se houver)' },
      { key: 'c_travas_carga', label: 'Travas da carga' },
    ],
  },
  {
    category: 'Limpeza',
    vehicleTypes: ['carretinha'],
    items: [
      { key: 'c_limpeza_geral', label: 'Carretinha limpa externamente' },
      { key: 'c_limpeza_carga', label: 'Compartimento de carga limpo' },
    ],
  },
];

export const CHECKLIST_TEMPLATE: ChecklistCategoryDef[] = [
  ...TRUCK_TEMPLATE,
  ...CARRETINHA_TEMPLATE,
];

/** Retorna as categorias aplicáveis ao tipo de veículo selecionado. */
export function getChecklistFor(vehicleType: VehicleType | null): ChecklistCategoryDef[] {
  if (!vehicleType) return [];
  return CHECKLIST_TEMPLATE.filter(c => !c.vehicleTypes || c.vehicleTypes.includes(vehicleType));
}

export const STATUS_LABEL: Record<ChecklistStatus, string> = {
  ok: 'OK',
  attention: 'Atenção',
  critical: 'Crítico',
  na: 'N/A',
};

export const STATUS_COLOR: Record<ChecklistStatus, string> = {
  ok: 'bg-emerald-500',
  attention: 'bg-amber-500',
  critical: 'bg-red-600',
  na: 'bg-gray-400',
};
