import { useState, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import { CategoriaIcone, ICONES_CATEGORIA } from "../components/Badges";
import { Carregando, Modal } from "../components/Ui";
import { useToast } from "../context/ToastContext";
import { useCategorias } from "../hooks/useDados";
import { mensagemErro, supabase } from "../lib/supabase";
import type { Categoria } from "../lib/types";

type Rascunho = Pick<Categoria, "nome" | "descricao" | "icone" | "destaque" | "ordem"> & { id?: number; slug?: string };

const NOMES_ICONES: Record<string, string> = {
  monitor: "Monitor",
  database: "Banco de dados",
  wifi: "Wi-Fi",
  "key-round": "Chave",
  "app-window": "Programa",
  printer: "Impressora",
  "circle-help": "Ajuda",
};

const gerarSlug = (nome: string) =>
  nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function Categorias() {
  const { categorias, carregando, recarregar } = useCategorias(true);
  const toast = useToast();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);

  async function salvar(e?: FormEvent) {
    e?.preventDefault();
    if (!rascunho || rascunho.nome.trim().length < 2) return;
    const dados = {
      nome: rascunho.nome.trim(),
      descricao: rascunho.descricao?.trim() || null,
      icone: rascunho.icone,
      destaque: rascunho.destaque,
      ordem: rascunho.ordem,
    };
    const { error } = rascunho.id
      ? await supabase.from("categorias").update(dados).eq("id", rascunho.id)
      : await supabase.from("categorias").insert({ ...dados, slug: gerarSlug(dados.nome) });
    if (error) return toast({ tipo: "erro", titulo: "Não foi possível salvar", mensagem: mensagemErro(error) });
    toast({ tipo: "sucesso", titulo: "Categoria salva" });
    setRascunho(null);
    void recarregar();
  }

  async function alternarAtivo(c: Categoria) {
    const { error } = await supabase.from("categorias").update({ ativo: !c.ativo }).eq("id", c.id);
    if (error) return toast({ tipo: "erro", titulo: "Não foi possível salvar", mensagem: mensagemErro(error) });
    void recarregar();
  }

  if (carregando) return <Carregando />;

  return (
    <>
      <div className="fdv-page__header">
        <div>
          <h2 className="fdv-page__title">Categorias</h2>
          <p className="fdv-page__lead">Organize os tipos de chamado. Categorias inativas deixam de aparecer na abertura, mas o histórico é mantido.</p>
        </div>
        <button className="fdv-btn fdv-btn--primary" onClick={() => setRascunho({ nome: "", descricao: "", icone: "circle-help", destaque: false, ordem: 100 })}>
          <Plus /> Nova categoria
        </button>
      </div>

      <section className="fdv-card">
        <div className="fdv-table-wrap tabela-borda-zero">
          <table className="fdv-table">
            <thead>
              <tr>
                <th scope="col">Categoria</th>
                <th scope="col">Descrição</th>
                <th scope="col">Ordem</th>
                <th scope="col">Situação</th>
                <th scope="col"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((c) => (
                <tr key={c.id} className={c.ativo ? "" : "linha-inativa"}>
                  <td>
                    <span className="fdv-category">
                      <CategoriaIcone slug={c.slug} icone={c.icone} tamanho="sm" />
                      {c.nome}
                      {c.destaque && <span className="tag-destaque">Destaque</span>}
                    </span>
                  </td>
                  <td className="fdv-muted">{c.descricao}</td>
                  <td>{c.ordem}</td>
                  <td>
                    <label className="check">
                      <input type="checkbox" checked={c.ativo} onChange={() => void alternarAtivo(c)} />
                      {c.ativo ? "Ativa" : "Inativa"}
                    </label>
                  </td>
                  <td>
                    <button className="fdv-btn fdv-btn--ghost fdv-btn--sm" onClick={() => setRascunho({ ...c })}>
                      <Pencil /> Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        titulo={rascunho?.id ? "Editar categoria" : "Nova categoria"}
        aberto={!!rascunho}
        aoFechar={() => setRascunho(null)}
        rodape={
          <>
            <button className="fdv-btn fdv-btn--secondary" onClick={() => setRascunho(null)}>Cancelar</button>
            <button className="fdv-btn fdv-btn--primary" onClick={() => void salvar()} disabled={!rascunho || rascunho.nome.trim().length < 2}>Salvar</button>
          </>
        }
      >
        {rascunho && (
          <form className="fdv-form" onSubmit={salvar}>
            <div className="fdv-field">
              <label className="fdv-label" htmlFor="cat-nome">Nome</label>
              <input id="cat-nome" className="fdv-input" value={rascunho.nome} onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} />
            </div>
            <div className="fdv-field">
              <label className="fdv-label" htmlFor="cat-desc">Descrição curta</label>
              <input id="cat-desc" className="fdv-input" value={rascunho.descricao ?? ""} onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })} />
            </div>
            <div className="fdv-form__row">
              <div className="fdv-field">
                <label className="fdv-label" htmlFor="cat-icone">Ícone</label>
                <select id="cat-icone" className="fdv-select" value={rascunho.icone} onChange={(e) => setRascunho({ ...rascunho, icone: e.target.value })}>
                  {Object.keys(ICONES_CATEGORIA).map((k) => (
                    <option key={k} value={k}>{NOMES_ICONES[k] ?? k}</option>
                  ))}
                </select>
              </div>
              <div className="fdv-field">
                <label className="fdv-label" htmlFor="cat-ordem">Ordem</label>
                <input id="cat-ordem" type="number" className="fdv-input" value={rascunho.ordem} onChange={(e) => setRascunho({ ...rascunho, ordem: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={rascunho.destaque} onChange={(e) => setRascunho({ ...rascunho, destaque: e.target.checked })} />
              Exibir em destaque na abertura de chamados
            </label>
          </form>
        )}
      </Modal>
    </>
  );
}
