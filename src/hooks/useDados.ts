import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Categoria, PessoaResumo } from "../lib/types";

export function useCategorias(incluirInativas = false) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    let q = supabase.from("categorias").select("*").order("ordem").order("nome");
    if (!incluirInativas) q = q.eq("ativo", true);
    const { data } = await q;
    setCategorias((data as Categoria[]) ?? []);
    setCarregando(false);
  }, [incluirInativas]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { categorias, carregando, recarregar: carregar };
}

/** Técnicos e administradores ativos (para atribuição e filtros). */
export function useEquipe() {
  const [equipe, setEquipe] = useState<PessoaResumo[]>([]);
  useEffect(() => {
    supabase
      .from("perfis")
      .select("id,nome,email")
      .in("papel", ["tecnico", "admin"])
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setEquipe((data as PessoaResumo[]) ?? []));
  }, []);
  return equipe;
}
