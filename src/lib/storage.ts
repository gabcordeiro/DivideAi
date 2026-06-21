import { supabase } from '@/lib/supabaseClient';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

/** Valida o arquivo de avatar. Retorna a mensagem de erro ou null se ok. */
export function validateAvatar(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'O avatar precisa ser uma imagem.';
  if (file.size > MAX_AVATAR_BYTES) return 'A imagem deve ter no máximo 2 MB.';
  return null;
}

/**
 * Sobe o avatar para `avatars/<userId>/avatar.<ext>` (sobrescrevendo o anterior)
 * e devolve a URL pública com cache-busting.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // `?t=` força o navegador a recarregar quando o usuário troca a foto.
  return `${data.publicUrl}?t=${Date.now()}`;
}
