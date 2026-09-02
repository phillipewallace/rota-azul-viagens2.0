/**
 * Helpers da Central de Documentos — detecção do tipo de pré-visualização,
 * formatação de tamanho e download confiável (blob + objectURL para funcionar
 * cross-origin, já que o arquivo fica no backend e a app pode rodar em outro host).
 */
import { toAbsoluteUrl } from './absoluteUrl';

export type PreviewKind = 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'office' | 'archive' | 'other';

export function fileExtension(name?: string | null): string {
  if (!name) return '';
  const ext = name.split('.').pop() || '';
  return ext.toLowerCase();
}

export function formatFileSize(bytes?: number | null): string {
  const n = Number(bytes);
  if (!n || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'heic', 'tif', 'tiff']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogv', 'ogg', 'mov', 'm4v', 'avi', 'mkv', 'mpg', 'mpeg', '3gp', 'wmv']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'wma', 'mid', 'midi']);
const TEXT_EXTS = new Set([
  'txt', 'md', 'markdown', 'json', 'xml', 'html', 'htm', 'csv', 'log', 'yml', 'yaml', 'toml', 'ini', 'env',
  'cfg', 'conf', 'properties', 'ts', 'js', 'jsx', 'tsx', 'css', 'scss', 'sass', 'less', 'sql', 'sh', 'bash',
  'py', 'java', 'c', 'cpp', 'h', 'hpp', 'rb', 'go', 'rs', 'php', 'swift', 'kt', 'lua', 'pl', 'r', 'dart',
  'vue', 'svelte', 'graphql', 'prisma', 'gitignore', 'editorconfig', 'bat', 'cmd', 'ps1', 'xlsx', 'xls', 'doc', 'docx',
]);
const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz']);
const OFFICE_EXTS = new Set(['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt', 'odt', 'ods', 'odp', 'rtf', 'csv']);

export function getPreviewKind(filename?: string | null, mime?: string | null): PreviewKind {
  const ext = fileExtension(filename);
  const mt = (mime || '').toLowerCase();

  if (ext === 'pdf' || mt.includes('pdf')) return 'pdf';
  if (mt.startsWith('image/') || IMAGE_EXTS.has(ext)) return 'image';
  if (mt.startsWith('video/') || VIDEO_EXTS.has(ext)) return 'video';
  if (mt.startsWith('audio/') || AUDIO_EXTS.has(ext)) return 'audio';
  if (OFFICE_EXTS.has(ext)) return 'office';
  if (ARCHIVE_EXTS.has(ext) || mt.includes('zip') || mt.includes('compressed')) return 'archive';
  if (mt.startsWith('text/') || TEXT_EXTS.has(ext)) return 'text';

  // Qualquer coisa sem classificação específica tenta como texto; se falhar,
  // o diálogo cai no fallback com metadados + download/abrir.
  return 'other';
}

export const previewKindLabels: Record<PreviewKind, string> = {
  pdf: 'PDF',
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  text: 'Texto',
  office: 'Documento Office',
  archive: 'Arquivo compactado',
  other: 'Arquivo',
};

/**
 * Baixa o arquivo de forma confiável, mesmo cross-origin:
 * busca como blob e dispara o download via objectURL.
 */
export async function downloadFileFromUrl(url: string, filename: string): Promise<void> {
  const abs = toAbsoluteUrl(url);
  if (!abs) throw new Error('URL do arquivo inválida');

  const res = await fetch(abs);
  if (!res.ok) throw new Error('Falha ao baixar o arquivo');
  const blob = await res.blob();

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename || 'documento';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}