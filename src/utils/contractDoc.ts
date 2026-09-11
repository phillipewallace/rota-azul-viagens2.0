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
import { loadPdfImage, type PdfImage } from './pdfImage';
import { erpService } from '@/services/erp';

const esc = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const NL = '\r\n';

/** Nome/URL interno usado para casar a <img> com a parte MIME do MHTML. */
const IMG_BASE = 'file:///C:/rotaazul-contrato';

type ImagePart = {
  /** URL fake usada no src da <img> e no Content-Location da parte MIME. */
  loc: string;
  mime: string;
  base64: string;
  w: number;
  h: number;
};

/**
 * Baixa a imagem (URL relativa/absoluta ou dataURL) e devolve a parte MIME
 * pronta para embutir no MHTML, com tamanho limitado à caixa indicada.
 * Retorna null se a imagem não existir ou falhar o download (seguirá sem ela).
 */
async function loadImagePart(
  src: string | null | undefined,
  name: string,
  maxW: number,
  maxH: number,
): Promise<ImagePart | null> {
  if (!src) return null;
  try {
    const img: PdfImage = await loadPdfImage(src);
    const m = img.dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
    if (!m) return null;
    const nw = img.naturalWidth || 0;
    const nh = img.naturalHeight || 0;
    if (nw < 2 || nh < 2) return null;
    const r = Math.min(maxW / nw, maxH / nh);
    return {
      loc: `${IMG_BASE}/${name}`,
      mime: m[1],
      base64: m[2].replace(/\s+/g, ''),
      w: Math.max(1, Math.round(nw * r)),
      h: Math.max(1, Math.round(nh * r)),
    };
  } catch {
    return null;
  }
}

/** Quebra o base64 em linhas de 76 caracteres (exigência MIME). */
const wrapBase64 = (b64: string) => b64.replace(/(.{76})/g, `$1${NL}`);

/**
 * Monta o documento MHTML: a parte text/html + uma parte base64 por imagem.
 * O Word abre MHTML nativamente e renderiza as imagens EMBUTIDAS no arquivo
 * (nada de links externos, que o Word costuma bloquear ou perder).
 */
export function buildMhtml(html: string, images: ImagePart[]): string {
  const boundary = `----=_rotaazul_${Math.random().toString(36).slice(2, 10)}`;
  let out = '';
  out += 'MIME-Version: 1.0' + NL;
  out += `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"` + NL;
  out += NL;
  out += 'Documento Word gerado pelo sistema (formato MHTML).' + NL;

  // Parte 1: o HTML do contrato
  out += `--${boundary}` + NL;
  out += 'Content-Type: text/html; charset="utf-8"' + NL;
  out += 'Content-Transfer-Encoding: 8bit' + NL;
  out += `Content-Location: ${IMG_BASE}/documento.html` + NL;
  out += NL;
  out += html + NL;
  out += NL;

  // Partes seguintes: as imagens (logo, assinatura)
  for (const img of images) {
    out += `--${boundary}` + NL;
    out += `Content-Type: ${img.mime}` + NL;
    out += 'Content-Transfer-Encoding: base64' + NL;
    out += `Content-Location: ${img.loc}` + NL;
    out += `Content-ID: <${img.loc.replace(`${IMG_BASE}/`, '')}@rotaazul>` + NL;
    out += NL;
    out += wrapBase64(img.base64) + NL;
  }

  out += `--${boundary}--` + NL;
  return out;
}

export async function generateContractDoc(src: ContractSource) {
  const { tipoTpl, titulo, corpoHtml } = await buildContractDocument(src);

  const company: any = { ...(src.companySnapshot || {}) };
  const customer: any = src.customerSnapshot || {};

  // Busca informações frescas da empresa (assinatura/logo) caso o snapshot
  // do contrato seja antigo e não tenha os campos — mesmo comportamento do PDF.
  if (company.id && !company.assinatura_url) {
    try {
      const all = await erpService.listCompanies();
      const found = all.find((c) => c.id === company.id);
      if (found?.assinaturaUrl) company.assinatura_url = found.assinaturaUrl;
      if (found?.logoUrl && !company.logo_url) company.logo_url = found.logoUrl;
    } catch { /* silencioso */ }
  }

  // Carrega logo e assinatura para embutir no MHTML (falha = segue sem a imagem).
  const [logoPart, sigPart] = await Promise.all([
    loadImagePart(company.logo_url, 'logo', 220, 90),
    loadImagePart(company.assinatura_url, 'assinatura', 280, 80),
  ]);
  const images: ImagePart[] = [logoPart, sigPart].filter(Boolean) as ImagePart[];
  const logoImg = logoPart
    ? `<p class="logo-row"><img src="${logoPart.loc}" width="${logoPart.w}" height="${logoPart.h}" alt="logo"></p>`
    : '';
  const sigImg = sigPart
    ? `<img class="sig-img" src="${sigPart.loc}" width="${sigPart.w}" height="${sigPart.h}" alt="assinatura">`
    : '';

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
  p.logo-row { text-align: center; margin: 0 0 12pt; }
  .sig-img { display: block; margin: 0 auto 2pt; }
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
  ${logoImg}
  <h1 class="contract-title">${esc(titulo)}</h1>
  <p class="subtitle">Documento: ${esc(src.numero)} &middot; Emissão: ${esc(_fmtDateBr(emissao))}</p>

  ${corpoHtml}

  ${observacoes}

  <p class="place-date">${esc(cidade)}, ${esc(_fmtDateLong(emissao))}.</p>

  <table class="sig-table"><tr>
    <td>
      ${sigImg}
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

  // Saída em MHTML: o Word abre nativamente e as imagens (logo/assinatura)
  // ficam EMBUTIDAS no arquivo — HTML simples com <img src="http://...">
  // não funciona no Word (base64 em data: URI é ignorado e links externos
  // são bloqueados/quebrados).
  const mhtml = buildMhtml(html, images);
  const blob = new Blob([mhtml], {
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
