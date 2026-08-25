/**
 * ContractViewDialog — visualização read-only de um contrato ERP.
 * Carrega dados via contractsService.get(id) e exibe organizado em seções.
 */
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, FileText } from 'lucide-react';
import { contractsService, type Contract } from '@/services/contracts';
import { formatDateBR } from '@/utils/dateFormat';
import { maskCnpj, maskCpf } from '@/utils/brazilianDocs';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';

import { BRL } from '@/utils/currency';

const D = (s?: string | null) => (s ? formatDateBR(s) : '—');

const maskDoc = (d?: string | null) => {
  if (!d) return '—';
  const x = String(d).replace(/\D/g, '');
  if (x.length === 11) return maskCpf(x);
  if (x.length === 14) return maskCnpj(x);
  return String(d);
};

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label, children, className,
}) => (
  <div className={className}>
    <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground font-medium">
      {label}
    </div>
    <div className="text-sm text-foreground mt-0.5 break-words">{children}</div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2.5">
    <h3 className="text-[11px] uppercase tracking-wider text-primary font-semibold border-b border-border/60 pb-1.5">
      {title}
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">{children}</div>
  </section>
);

export const ContractViewDialog: React.FC<{
  contractId: string | null;
  onClose: () => void;
}> = ({ contractId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractId) { setContract(null); setError(null); return; }
    let alive = true;
    setLoading(true); setError(null);
    contractsService.get(contractId)
      .then((c) => { if (alive) setContract(c); })
      .catch((e) => { if (alive) setError(e?.message || 'Falha ao carregar contrato'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [contractId]);

  const open = !!contractId;
  const c = contract;

  const tipoLabel =
    c?.tipoContrato === 'evento' ? 'Evento'
    : c?.tipoContrato === 'obra' ? 'Obra'
    : 'Locação';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <FileText className="h-5 w-5 text-primary" />
            <span>Contrato</span>
            {c?.numero && (
              <span className="font-mono text-sm text-muted-foreground">{c.numero}</span>
            )}
            {c && (
              <>
                <Badge variant="secondary" className="ml-1">{tipoLabel}</Badge>
                <Badge
                  variant={c.ativo ? 'default' : 'outline'}
                  className={c.ativo ? 'bg-emerald-600 hover:bg-emerald-600' : 'text-muted-foreground'}
                >
                  {c.ativo ? 'Ativo' : 'Encerrado'}
                </Badge>
                {c.origem && (
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {c.origem}
                  </Badge>
                )}
              </>
            )}
          </DialogTitle>
          <DialogDescription>Visualização somente leitura de todos os dados do contrato.</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
          </div>
        )}

        {error && !loading && (
          <div className="py-8 text-center text-sm text-destructive">{error}</div>
        )}

        {c && !loading && (
          <div className="space-y-6 pt-2">
            {/* Empresa emissora */}
            <Section title="Empresa emissora (locadora)">
              <Field label="Razão Social">{c.companyRazaoSocial || '—'}</Field>
              <Field label="CNPJ">{c.companyCnpj ? maskCnpj(c.companyCnpj) : '—'}</Field>
            </Section>

            {/* Cliente */}
            <Section title="Cliente (locatário)">
              <Field label="Nome / Razão Social">{c.customerName || '—'}</Field>
              <Field label="Documento">{maskDoc(c.customerDocument)}</Field>
            </Section>

            {/* Datas / vigência */}
            <Section title="Vigência">
              <Field label="Data início">{D(c.dataInicio)}</Field>
              <Field label="Data fim">{c.dataFim ? D(c.dataFim) : 'Vigente (sem fim)'}</Field>
              <Field label="Dia de vencimento">{c.diaVencimento ?? '—'}</Field>
              <Field label="Renovação automática">
                {c.renovacaoAutomatica ? 'Sim' : 'Não'}
              </Field>
              {c.encerradoEm && (
                <Field label="Encerrado em">{D(c.encerradoEm)}</Field>
              )}
              {c.motivoEncerramento && (
                <Field label="Motivo do encerramento" className="sm:col-span-2">
                  {c.motivoEncerramento}
                </Field>
              )}
            </Section>

            {/* Evento (quando aplicável) */}
            {(c.tipoContrato === 'evento' || c.dataEvento || c.localEvento || c.horaEntrega || c.dataRecolhimento) && (
              <Section title="Evento">
                <Field label="Data do evento">{D(c.dataEvento)}</Field>
                <Field label="Data de recolhimento">{D(c.dataRecolhimento)}</Field>
                <Field label="Hora de entrega">{c.horaEntrega || '—'}</Field>
                <Field label="Valor total do evento">
                  {c.valorTotalEvento != null ? BRL(c.valorTotalEvento) : '—'}
                </Field>
                <Field label="Local do evento" className="sm:col-span-2">
                  {c.localEvento || '—'}
                </Field>
              </Section>
            )}

            {/* Obra (quando aplicável) */}
            {(c.tipoContrato === 'obra' || c.enderecoObra || c.cno) && (
              <Section title="Obra">
                <Field label="Endereço da obra" className="sm:col-span-2">
                  {c.enderecoObra || '—'}
                </Field>
                <Field label="CNO / Ordem de Compra">{c.cno || '—'}</Field>
              </Section>
            )}

            {/* Financeiro */}
            <Section title="Financeiro">
              <Field label="Valor mensal">{BRL(c.valorMensal)}</Field>
              <Field label="Frete">{c.frete != null ? BRL(c.frete) : '—'}</Field>
            </Section>

            {/* Responsável */}
            {(c.responsavelNome || c.responsavelTelefone || c.responsavelEmail) && (
              <Section title="Responsável">
                <Field label="Nome">{c.responsavelNome || '—'}</Field>
                <Field label="Telefone">{c.responsavelTelefone || '—'}</Field>
                <Field label="E-mail" className="sm:col-span-2">{c.responsavelEmail || '—'}</Field>
              </Section>
            )}

            {/* Descrição / observações */}
            {(c.descricao || c.observacoes) && (
              <Section title="Descrição e observações">
                {c.descricao && (
                  <Field label="Descrição" className="sm:col-span-2">
                    <div className="whitespace-pre-wrap">{c.descricao}</div>
                  </Field>
                )}
                {c.observacoes && (
                  <Field label="Observações" className="sm:col-span-2">
                    <div className="whitespace-pre-wrap">{c.observacoes}</div>
                  </Field>
                )}
              </Section>
            )}

            {/* Vínculos */}
            {(c.osNumero || c.pdfUrl) && (
              <Section title="Vínculos e anexos">
                {c.osNumero && (
                  <Field label="Ordem de serviço">{c.osNumero}</Field>
                )}
                {c.pdfUrl && (
                  <Field label="PDF assinado" className="sm:col-span-2">
                    <a
                      href={toAbsoluteUrl(c.pdfUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Abrir documento <ExternalLink className="h-3 w-3" />
                    </a>
                  </Field>
                )}
              </Section>
            )}

            {/* Meta */}
            <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
              Criado em {D(c.createdAt)}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContractViewDialog;
