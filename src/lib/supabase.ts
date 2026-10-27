import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false quando o .env ainda não foi preenchido — o app mostra uma tela de configuração. */
export const supabaseConfigurado = Boolean(url && anonKey);

export const supabase = createClient(
  url || "https://configure-o-env.supabase.co",
  anonKey || "chave-ausente",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

/** Traduz mensagens comuns do Supabase para português. */
export function mensagemErro(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err ?? "Erro desconhecido");
  const mapa: [RegExp, string][] = [
    [/Invalid login credentials/i, "E-mail ou senha incorretos."],
    [/Email not confirmed/i, "Confirme seu e-mail pelo link enviado antes de entrar."],
    [/User already registered/i, "Já existe uma conta com este e-mail."],
    [/Password should be at least/i, "A senha precisa ter pelo menos 6 caracteres."],
    [/rate limit/i, "Muitas tentativas. Aguarde um instante e tente novamente."],
    [/Failed to fetch|NetworkError/i, "Sem conexão com o servidor. Verifique sua internet."],
    [/row-level security|permission denied/i, "Você não tem permissão para esta ação."],
    [/payload too large|exceeded the maximum allowed size/i, "Arquivo maior que o limite de 10 MB."],
  ];
  for (const [re, txt] of mapa) if (re.test(msg)) return txt;
  return msg;
}
