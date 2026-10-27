import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Paperclip, Send, X } from "lucide-react";
import { CategoriaIcone } from "../components/Badges";
import { Carregando } from "../components/Ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useCategorias } from "../hooks/useDados";
import { enviarAnexos, LIMITE_ANEXO, MAX_ANEXOS } from "../lib/anexos";
import { PRIORIDADES, tamanhoArquivo } from "../lib/format";
import { mensagemErro, supabase } from "../lib/supabase";
import type { PessoaResumo, Prioridade } from "../lib/types";

export default function NovoChamado() {
  const { perfil, ehEquipe } = useAuth();
  const { categorias, carregando } = useCategorias();
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const toast = useToast();
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [local, setLocal] = useState("");
  const [patrimonio, setPatrimonio] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [solicitanteId, setSolicitanteId] = useState("");
  const [pessoas, setPessoas] = useState<PessoaResumo[]>([]);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  // Remove o aviso de erro do campo assim que o usuário o corrige
  const limparErro = (campo: string) => setErros((e) => (e[campo] ? { ...e, [campo]: "" } : e));

  // Pré-seleciona a categoria vinda do atalho da tela inicial (?categoria=hardware)
  useEffect(() => {
    const slug = params.get("categoria");
    if (slug && categorias.length && categoriaId === null) {
      const c = categorias.find((x) => x.slug === slug);
      if (c) setCategoriaId(c.id);
    }
  }, [params, categorias, categoriaId]);

  // A equipe de TI pode registrar chamado em nome de outra pessoa (ex.: pedido por telefone)
  useEffect(() => {
    if (!ehEquipe) return;
    supabase
      .from("perfis")
      .select("id,nome,email,setor")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setPessoas((data as PessoaResumo[]) ?? []));
  }, [ehEquipe]);

  function adicionarArquivos(lista: FileList | null) {
    if (!lista) return;
    const novos = Array.from(lista);
    const grandes = novos.filter((f) => f.size > LIMITE_ANEXO);
    if (grandes.length) toast({ tipo: "erro", titulo: "Arquivo muito grande", mensagem: "Cada anexo pode ter até 10 MB." });
    setArquivos((atual) => [...atual, ...novos.filter((f) => f.size <= LIMITE_ANEXO)].slice(0, MAX_ANEXOS));
    if (inputArquivo.current) inputArquivo.current.value = "";
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    if (!categoriaId) novosErros.categoria = "Escolha uma categoria.";
    if (titulo.trim().length < 3) novosErros.titulo = "Descreva o problema em poucas palavras (mínimo de 3 caracteres).";
    if (descricao.trim().length < 10) novosErros.descricao = "Conte um pouco mais sobre o problema (mínimo de 10 caracteres).";
    setErros(novosErros);
    if (Object.keys(novosErros).length) {
      document.getElementById(`campo-${Object.keys(novosErros)[0]}`)?.focus();
      return;
    }

    setEnviando(true);
    try {
      const { data, error } = await supabase
        .from("chamados")
        .insert({
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          categoria_id: categoriaId,
          prioridade,
          local: local.trim() || null,
          patrimonio: patrimonio.trim() || null,
          solicitante_id: ehEquipe && solicitanteId ? solicitanteId : perfil!.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      const id = (data as { id: number }).id;
      if (arquivos.length) {
        const falhas = await enviarAnexos(id, arquivos);
        if (falhas.length) toast({ tipo: "erro", titulo: "Alguns anexos não foram enviados", mensagem: falhas.join(", ") });
      }
      toast({ tipo: "sucesso", titulo: `Chamado #${id} aberto`, mensagem: "A equipe de TI já foi avisada." });
      navegar(`/chamados/${id}`);
    } catch (err) {
      toast({ tipo: "erro", titulo: "Não foi possível abrir o chamado", mensagem: mensagemErro(err) });
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <Carregando />;

  return (
    <>
      <div className="fdv-page__header">
        <div>
          <h2 className="fdv-page__title">Abrir chamado</h2>
          <p className="fdv-page__lead">Quanto mais detalhes, mais rápido conseguimos ajudar.</p>
        </div>
      </div>

      <form className="fdv-card form-chamado" onSubmit={enviar} noValidate>
        <div className="fdv-card__body fdv-form">
          {ehEquipe && (
            <div className="fdv-field">
              <label className="fdv-label" htmlFor="campo-solicitante">Solicitante</label>
              <select id="campo-solicitante" className="fdv-select" value={solicitanteId} onChange={(e) => setSolicitanteId(e.target.value)}>
                <option value="">Eu mesmo ({perfil?.nome})</option>
                {pessoas
                  .filter((p) => p.id !== perfil?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                      {p.setor ? ` · ${p.setor}` : ""}
                    </option>
                  ))}
              </select>
              <span className="fdv-help">Use para registrar pedidos recebidos por telefone ou pessoalmente.</span>
            </div>
          )}

          <fieldset className="fdv-field fieldset-limpo">
            <legend className="fdv-label">
              Categoria<span className="req">*</span>
            </legend>
            <div className="fdv-category-grid" role="radiogroup" aria-label="Categoria" id="campo-categoria" tabIndex={-1}>
              {categorias.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  role="radio"
                  aria-checked={categoriaId === c.id}
                  className={`fdv-category-option${c.destaque ? " destaque" : ""}`}
                  onClick={() => {
                    setCategoriaId(c.id);
                    limparErro("categoria");
                  }}
                >
                  <CategoriaIcone slug={c.slug} icone={c.icone} />
                  <span>
                    <span className="fdv-category-option__title">{c.nome}</span>
                    <span className="fdv-category-option__desc">{c.descricao}</span>
                  </span>
                </button>
              ))}
            </div>
            {erros.categoria && <span className="fdv-error">{erros.categoria}</span>}
          </fieldset>

          <div className="fdv-field">
            <label className="fdv-label" htmlFor="campo-titulo">
              Assunto<span className="req">*</span>
            </label>
            <input
              id="campo-titulo"
              className="fdv-input"
              value={titulo}
              maxLength={160}
              onChange={(e) => {
                setTitulo(e.target.value);
                limparErro("titulo");
              }}
              placeholder="Ex.: Projetor da sala 204 não liga"
              aria-invalid={!!erros.titulo || undefined}
            />
            {erros.titulo && <span className="fdv-error">{erros.titulo}</span>}
          </div>

          <fieldset className="fdv-field fieldset-limpo">
            <legend className="fdv-label">Prioridade</legend>
            <div className="prioridades" role="radiogroup" aria-label="Prioridade">
              {PRIORIDADES.map((p) => (
                <button
                  type="button"
                  key={p.valor}
                  role="radio"
                  aria-checked={prioridade === p.valor}
                  className={`prioridade-opcao prioridade-opcao--${p.valor}`}
                  onClick={() => setPrioridade(p.valor)}
                >
                  <span className="prioridade-opcao__nome">{p.rotulo}</span>
                  <span className="prioridade-opcao__ajuda">{p.ajuda}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="fdv-form__row">
            <div className="fdv-field">
              <label className="fdv-label" htmlFor="campo-local">Local</label>
              <input id="campo-local" className="fdv-input" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Sala 204, bloco B" />
            </div>
            <div className="fdv-field">
              <label className="fdv-label" htmlFor="campo-patrimonio">Nº de patrimônio</label>
              <input id="campo-patrimonio" className="fdv-input" value={patrimonio} onChange={(e) => setPatrimonio(e.target.value)} placeholder="Se houver etiqueta no equipamento" />
            </div>
          </div>

          <div className="fdv-field">
            <label className="fdv-label" htmlFor="campo-descricao">
              Descrição<span className="req">*</span>
            </label>
            <textarea
              id="campo-descricao"
              className="fdv-textarea"
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
                limparErro("descricao");
              }}
              placeholder="O que aconteceu, desde quando e o que já foi tentado. Se aparecer mensagem de erro, copie aqui."
              aria-invalid={!!erros.descricao || undefined}
            />
            {erros.descricao && <span className="fdv-error">{erros.descricao}</span>}
          </div>

          <div className="fdv-field">
            <span className="fdv-label">Anexos</span>
            <div className="anexos-input">
              <button type="button" className="fdv-btn fdv-btn--secondary fdv-btn--sm" onClick={() => inputArquivo.current?.click()} disabled={arquivos.length >= MAX_ANEXOS}>
                <Paperclip /> Adicionar arquivo
              </button>
              <span className="fdv-help">Prints da tela ajudam muito. Até {MAX_ANEXOS} arquivos de 10 MB.</span>
              <input ref={inputArquivo} type="file" multiple hidden onChange={(e) => adicionarArquivos(e.target.files)} />
            </div>
            {arquivos.length > 0 && (
              <ul className="arquivos-lista">
                {arquivos.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <Paperclip size={14} aria-hidden="true" />
                    <span className="arquivo-nome">{f.name}</span>
                    <span className="fdv-help">{tamanhoArquivo(f.size)}</span>
                    <button type="button" className="fdv-icon-btn icon-xs" onClick={() => setArquivos((l) => l.filter((_, j) => j !== i))} aria-label={`Remover ${f.name}`}>
                      <X />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="fdv-form__actions">
            <button type="button" className="fdv-btn fdv-btn--secondary" onClick={() => navegar(-1)}>Cancelar</button>
            <button type="submit" className="fdv-btn fdv-btn--primary" disabled={enviando}>
              <Send /> {enviando ? "Enviando…" : "Enviar chamado"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
