import { supabase } from "./supabase";

export const LIMITE_ANEXO = 10 * 1024 * 1024; // 10 MB (igual ao bucket)
export const MAX_ANEXOS = 5;

const nomeSeguro = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-80);

/** Envia arquivos para o bucket "anexos" na pasta do chamado e registra na tabela. */
export async function enviarAnexos(chamadoId: number, arquivos: File[]): Promise<string[]> {
  const falhas: string[] = [];
  for (const arquivo of arquivos) {
    if (arquivo.size > LIMITE_ANEXO) {
      falhas.push(`${arquivo.name} (maior que 10 MB)`);
      continue;
    }
    const caminho = `${chamadoId}/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`;
    const up = await supabase.storage.from("anexos").upload(caminho, arquivo, { contentType: arquivo.type || undefined });
    if (up.error) {
      falhas.push(arquivo.name);
      continue;
    }
    const { error } = await supabase
      .from("anexos")
      .insert({ chamado_id: chamadoId, nome: arquivo.name, caminho, tamanho: arquivo.size, tipo: arquivo.type || null });
    if (error) falhas.push(arquivo.name);
  }
  return falhas;
}

export async function abrirAnexo(caminho: string) {
  const { data, error } = await supabase.storage.from("anexos").createSignedUrl(caminho, 60);
  if (error || !data) throw error ?? new Error("Não foi possível abrir o anexo.");
  window.open(data.signedUrl, "_blank", "noopener");
}
