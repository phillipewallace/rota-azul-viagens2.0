import { API_BASE_URL } from '@/services/config';

/** Envia um arquivo avulso pela mesma rota usada no cadastro de documentos. */
export async function uploadDocumentFile(file: File): Promise<{ url: string; size: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const tk = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: tk ? { Authorization: `Bearer ${tk}` } : undefined,
    body: fd,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.url) throw new Error(data?.error || 'Falha ao enviar o arquivo');
  return { url: data.url, size: Number(data.size) || file.size };
}
