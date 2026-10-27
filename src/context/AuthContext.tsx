import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Perfil } from "../lib/types";

interface AuthValor {
  session: Session | null;
  perfil: Perfil | null;
  carregando: boolean;
  perfilFalhou: boolean;
  ehEquipe: boolean;
  ehAdmin: boolean;
  recarregarPerfil: () => Promise<void>;
  sair: () => Promise<void>;
}

const AuthCtx = createContext<AuthValor | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [perfilFalhou, setPerfilFalhou] = useState(false);

  const buscarPerfil = useCallback(async (userId: string | undefined) => {
    setPerfilFalhou(false);
    if (!userId) {
      setPerfil(null);
      return;
    }
    // O perfil é criado por gatilho logo após o cadastro; tenta algumas vezes por segurança.
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const { data } = await supabase.from("perfis").select("*").eq("id", userId).maybeSingle();
      if (data) {
        setPerfil(data as Perfil);
        return;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    setPerfil(null);
    setPerfilFalhou(true);
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return;
      setSession(data.session);
      await buscarPerfil(data.session?.user.id);
      if (ativo) setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nova) => {
      setSession(nova);
      // Evita chamadas ao Supabase dentro do callback (recomendação da biblioteca)
      setTimeout(() => void buscarPerfil(nova?.user.id), 0);
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, [buscarPerfil]);

  const valor = useMemo<AuthValor>(
    () => ({
      session,
      perfil,
      carregando,
      perfilFalhou,
      ehEquipe: !!perfil && perfil.ativo && (perfil.papel === "tecnico" || perfil.papel === "admin"),
      ehAdmin: !!perfil && perfil.ativo && perfil.papel === "admin",
      recarregarPerfil: () => buscarPerfil(session?.user.id),
      sair: async () => {
        await supabase.auth.signOut();
        setPerfil(null);
      },
    }),
    [session, perfil, carregando, perfilFalhou, buscarPerfil],
  );

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
