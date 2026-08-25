/**
 * Geração de contrato em formato Word (.doc) editável.
 *
 * Reutiliza o mesmo template + contexto do gerador de PDF (buildContractDocument),
 * mudando apenas a saída: um HTML "Word-compatible" salvo com MIME
 * application/msword. O Word abre normalmente, permite edição e depois
 * "Salvar como .docx" caso o usuário queira.
 *
 * Uso pensado: ajustes pontuais e raros em contratos muito específicos que
 * fogem dos parâmetros normais — o layout fica bem próximo do PDF.
 */
import { maskCnpj } from '@/utils/brazilianDocs';
import {
  buildContractDocument,
  _fmtDateBr,
  _fmtDateLong,
  _maskDoc,
  sanitizeObservacoesDatas,
  type ContractSource,

} from './contractPdf';

const esc = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export async function generateContractDoc(src: ContractSource) {
  const { tipoTpl, titulo, corpoHtml } = await buildContractDocument(src);

  const company: any = src.companySnapshot || {};
  const customer: any = src.customerSnapshot || {};

  const companyName = String(
    company.razao_social || src.companyRazaoSocial || 'LOCADORA',
  ).toUpperCase();
  const companyCnpj = company.cnpj
    ? `CNPJ ${maskCnpj(company.cnpj)}`
    : src.companyCnpj
      ? `CNPJ ${maskCnpj(src.companyCnpj)}`
      : '';
  const customerName = String(
    customer.customer_name || src.customerName || 'LOCATÁRIA',
  ).toUpperCase();
  const customerDoc = customer.document ? _maskDoc(customer.document) : '';
  const customerDocLabel =
    customer.document && String(customer.document).replace(/\D/g, '').length === 11
      ? 'CPF'
      : 'CNPJ';
  const cidade = String(company.cidade || '____________');
  const emissao = src.dataEmissao || src.dataInicio || new Date().toISOString();
  const roleLabel = tipoTpl === 'evento' ? 'CONTRATANTE' : 'LOCATÁRIA';
  const obsTexto = sanitizeObservacoesDatas(
    src.observacoes,
    src.dataEntrega || src.dataInicio,
    src.dataRecolhimento || src.dataFimPrevista,
  );
  const observacoes = obsTexto.trim()
    ? `<h2>OBSERVAÇÕES COMPLEMENTARES</h2><p>${esc(obsTexto).replace(/\n/g, '<br>')}</p>`
    : '';


  // HTML Word-compatible: estilos inline via <style>, cabeçalho MSO,
  // meta charset e BOM UTF-8 no blob para preservar acentuação.
  const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${esc(titulo)}</title>
<!--[if gte mso 9]><xml>
<w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml><![endif]-->
<style>
  @page WordSection1 { size: 21cm 29.7cm; margin: 2cm 2.2cm 2cm 2.2cm; }
  div.WordSection1 { page: WordSection1; }
  body { font-family: 'Calibri', 'Segoe UI', sans-serif; font-size: 11pt; color: #111; line-height: 1.55; }
  h1.contract-title { font-size: 16pt; text-align: center; margin: 0 0 6pt; letter-spacing: .3pt; }
  p.subtitle { text-align: center; color: #555; font-size: 10pt; margin: 0 0 22pt; }
  p { margin: 0 0 10pt; text-align: justify; }
  h2 { font-size: 12pt; margin: 18pt 0 6pt; color: #14224e; }
  h3 { font-size: 11pt; margin: 14pt 0 4pt; color: #14224e; }
  strong { font-weight: 700; }
  ul, ol { margin: 0 0 10pt 22pt; }
  li { margin-bottom: 4pt; }
  hr { border: none; border-top: 1px solid #d0d5dd; margin: 14pt 0; }
  p.place-date { margin-top: 28pt; }
  table.sig-table { width: 100%; margin-top: 42pt; border-collapse: collapse; }
  table.sig-table td { width: 50%; padding: 0 18pt; vertical-align: top; }
  .sig-line { border-top: 1px solid #333; padding-top: 5pt; text-align: center; font-size: 10pt; font-weight: 700; margin: 0; }
  .sig-meta { text-align: center; font-size: 9pt; color: #555; margin: 2pt 0 0; }
  .sig-role { text-align: center; font-size: 8.5pt; color: #888; letter-spacing: .5pt; margin: 4pt 0 0; }
  .witness { margin-top: 28pt; font-size: 10pt; }
  .witness-line { border-top: 1px solid #333; padding-top: 4pt; font-size: 9pt; color: #555; }
</style>
</head>
<body>
<div class="WordSection1">
  <h1 class="contract-title">${esc(titulo)}</h1>
  <p class="subtitle">Documento: ${esc(src.numero)} &middot; Emissão: ${esc(_fmtDateBr(emissao))}</p>

  ${corpoHtml}

  ${observacoes}

  <p class="place-date">${esc(cidade)}, ${esc(_fmtDateLong(emissao))}.</p>

  <table class="sig-table"><tr>
    <td>
      <p class="sig-line">${esc(companyName)}</p>
      ${companyCnpj ? `<p class="sig-meta">${esc(companyCnpj)}</p>` : ''}
      <p class="sig-role">LOCADORA</p>
    </td>
    <td>
      <p class="sig-line">${esc(customerName)}</p>
      ${customerDoc ? `<p class="sig-meta">${esc(customerDocLabel)} ${esc(customerDoc)}</p>` : ''}
      <p class="sig-role">${esc(roleLabel)}</p>
    </td>
  </tr></table>

  <div class="witness">
    <p>Testemunhas:</p>
    <table class="sig-table" style="margin-top:14pt"><tr>
      <td><p class="witness-line">Nome: ______________________________<br>CPF: ______________________________</p></td>
      <td><p class="witness-line">Nome: ______________________________<br>CPF: ______________________________</p></td>
    </tr></table>
  </div>
</div>
</body>
</html>`;

  const filename =
    tipoTpl === 'evento'
      ? `contrato-evento-${src.numero}.doc`
      : `contrato-${src.numero}.doc`;

  // BOM + application/msword garantem que o Word reconheça o arquivo e
  // preserve acentuação ao abrir.
  const blob = new Blob(['\ufeff', html], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
