import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Notificacao } from "../lib/types";

/** Notificações do usuário com atualização em tempo real (Supabase Realtime). */
export function useNotificacoes(userId: string | undefined, aoChegar?: (n: Notificacao) => void) {
  const [itens, setItens] = useState<Notificacao[]>([]);

  const carregar = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notificacoes")
      .select("*")
      .eq("usuario_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    setItens((data as Notificacao[]) ?? []);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void carregar();
    const canal = supabase
      .channel(`notificacoes-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes", filter: `usuario_id=eq.${userId}` },
        (payload) => {
          const nova = payload.new as Notificacao;
          setItens((l) => [nova, ...l].slice(0, 30));
          aoChegar?.(nova);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
    // aoChegar é intencionalmente ignorado para não recriar o canal a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, carregar]);

  const marcarLida = async (id: number) => {
    setItens((l) => l.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
  };

  const marcarTodas = async () => {
    if (!userId) return;
    setItens((l) => l.map((n) => ({ ...n, lida: true })));
    await supabase.from("notificacoes").update({ lida: true }).eq("usuario_id", userId).eq("lida", false);
  };

  return { itens, naoLidas: itens.filter((n) => !n.lida).length, marcarLida, marcarTodas, recarregar: carregar };
}
