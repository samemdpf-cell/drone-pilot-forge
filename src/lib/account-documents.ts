import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type AccountDocument = Tables<'pilot_documents'>;
const bucket = 'pilot-documents';

export async function listAccountDocuments(userId: string) {
  const { data, error } = await supabase.from('pilot_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function uploadAccountDocument(userId: string, file: Blob, metadata: { name: string; folder: 'piloto' | 'drone'; expires?: string | undefined; id?: string }) {
  const id = metadata.id ?? crypto.randomUUID();
  const path = `${userId}/${id}`;
  const { data: existing, error: readError } = await supabase.from('pilot_documents').select('id').eq('id', id).eq('user_id', userId).maybeSingle();
  if (readError) throw readError;
  if (existing) return;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (uploadError && uploadError.message !== 'The resource already exists') throw uploadError;
  const { error } = await supabase.from('pilot_documents').insert({ id, user_id: userId, storage_path: path, name: metadata.name, folder: metadata.folder, mime_type: file.type || 'application/octet-stream', expires_on: metadata.expires || null });
  if (error) throw error;
}

export async function downloadDocument(doc: AccountDocument): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).download(doc.storage_path);
  if (error) throw error;
  return data;
}

export async function documentData(doc: AccountDocument): Promise<string> {
  const blob = await downloadDocument(doc);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(blob);
  });
}

export async function deleteAccountDocument(doc: AccountDocument) {
  const { error: fileError } = await supabase.storage.from(bucket).remove([doc.storage_path]);
  if (fileError) throw fileError;
  const { error } = await supabase.from('pilot_documents').delete().eq('id', doc.id).eq('user_id', doc.user_id);
  if (error) throw error;
}