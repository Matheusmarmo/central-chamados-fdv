import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Lock, Paperclip, RotateCcw, Send, UserCheck } from "lucide-react";
import { CategoriaTag, PrioridadeBadge, StatusBadge } from "../components/Badges";
import { Avatar, Carregando, Modal, Vazio } from "../components/Ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useCategorias, useEquipe } from "../hooks/useDados";
import { abrirAnexo, enviarAnexos, LIMITE_ANEXO } from "../lib/anexos";
import { dataHora, PRIORIDADES, rotuloPrioridade, rotuloStatus, STATUS, tamanhoArquivo, tempoRelativo } from "../lib/format";
import { mensagemErro, supabase } from "../lib/supabase";
import { SELECT_CHAMADO, type Anexo, type Chamado, type Comentario, type Evento, type Prioridade, type Status } from "../lib/types";

function descreverEvento(e: Evento): string {
  switch (e.tipo) {
    case "criado":
      return "Chamado aberto";
    case "status":
      return `Status alterado de ${rotuloStatus(e.de)} para ${rotuloStatus(e.para)}`;
    case "prioridade":
      return `Prioridade alterada de ${rotuloPrioridade(e.de)} para ${rotuloPrioridade(e.para)}`;
    case "categoria":
      return `Categoria alterada de ${e.de ?? "—"} para ${e.para ?? "—"}`;
    case "atribuicao":
      return e.para ? `Técnico responsável: ${e.para}` : `Atribuição removida (${e.de ?? "—"})`;
    case "comentario":
      return e.para === "interno" ? "Nota interna adicionada" : "Nova mensagem na conversa";
    case "anexo":
      return `Anexo adicionado: ${e.para}`;
    default:
      return e.tipo;
  }
}

export default function ChamadoDetalhe() {
  const { id } = useParams();
  const chamadoId = Number(id);
  const { perfil, ehEquipe } = useAuth();
  const toast = useToast();
  const { categorias } = useCategorias();
  const equipe = useEquipe();

  const [chamado, setChamado] = useState<Chamado | null | undefined>(undefined);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [interno, setInterno] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modalReabrir, setModalReabrir] = useState(false);
  const [motivo, setMotivo] = useState("");

  const carregar = useCallback(async () => {
    if (!Number.isFinite(chamadoId)) return setChamado(null);
    const [c, com, ev, an] = await Promise.all([
      supabase.from("chamados").select(SELECT_CHAMADO).eq("id", chamadoId).maybeSingle(),
      supabase.from("comentarios").select("*, autor:perfis(id,nome)").eq("chamado_id", chamadoId).order("created_at"),
      supabase.from("eventos_chamado").select("*, autor:perfis(id,nome)").eq("chamado_id", chamadoId).order("created_at", { ascending: false }),
      supabase.from("anexos").select("*").eq("chamado_id", chamadoId).order("created_at"),
    ]);
    setChamado((c.data as Chamado) ?? null);
    setComentarios((com.data as Comentario[]) ?? []);
    setEventos((ev.data as Evento[]) ?? []);
    setAnexos((an.data as Anexo[]) ?? []);
  }, [chamadoId]);

  useEffect(() => {
    void carregar();
    const filtro = `chamado_id=eq.${chamadoId}`;
    const canal = supabase
      .channel(`chamado-${chamadoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chamados", filter: `id=eq.${chamadoId}` }, () => void carregar())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comentarios", filter: filtro }, () => void carregar())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "eventos_chamado", filter: filtro }, () => void carregar())
      .subscribe();
    return () => void supabase.removeChannel(canal);
  }, [chamadoId, carregar]);

  async function atualizar(campos: Partial<Pick<Chamado, "status" | "prioridade" | "categoria_id" | "tecnico_id">>, aviso: string) {
    setSalvando(true);
    const { error } = await supabase.from("chamados").update(campos).eq("id", chamadoId);
    setSalvando(false);
    if (error) return toast({ tipo: "erro", titulo: "Não foi possível salvar", mensagem: mensagemErro(error) });
    toast({ tipo: "sucesso", titulo: aviso });
    void carregar();
  }

  async function enviarMensagem(e: FormEvent) {
    e.preventDefault();
    const corpo = mensagem.trim();
    if (!corpo) return;
    setEnviando(true);
    const { error } = await supabase.from("comentarios").insert({ chamado_id: chamadoId, corpo, interno: ehEquipe && interno });
    setEnviando(false);
    if (error) return toast({ tipo: "erro", titulo: "Mensagem não enviada", mensagem: mensagemErro(error) });
    setMensagem("");
    setInterno(false);
    void carregar();
  }

  async function anexar(lista: FileList | null) {
    if (!lista?.length) return;
    const arquivos = Array.from(lista);
    if (arquivos.some((f) => f.size > LIMITE_ANEXO)) toast({ tipo: "erro", titulo: "Arquivo muito grande", mensagem: "Cada anexo pode ter até 10 MB." });
    const falhas = await enviarAnexos(chamadoId, arquivos);
    if (falhas.length) toast({ tipo: "erro", titulo: "Falha ao anexar", mensagem: falhas.join(", ") });
    else toast({ tipo: "sucesso", titulo: arquivos.length > 1 ? "Arquivos anexados" : "Arquivo anexado" });
    void carregar();
  }

  async function responderSolucao(aceitar: boolean) {
    setSalvando(true);
    if (!aceitar && motivo.trim()) {
      await supabase.from("comentarios").insert({ chamado_id: chamadoId, corpo: `Reaberto: ${motivo.trim()}` });
    }
    const { error } = await supabase.rpc("responder_solucao", { p_chamado: chamadoId, p_aceitar: aceitar });
    setSalvando(false);
    setModalReabrir(false);
    setMotivo("");
    if (error) return toast({ tipo: "erro", titulo: "Não foi possível registrar", mensagem: mensagemErro(error) });
    toast({ tipo: "sucesso", titulo: aceitar ? "Obrigado! Chamado encerrado." : "Chamado reaberto", mensagem: aceitar ? undefined : "A equipe de TI foi avisada." });
    void carregar();
  }

  if (chamado === undefined) return <Carregando />;
  if (chamado === null)
    return (
      <Vazio
        titulo="Chamado não encontrado"
        texto="Ele não existe ou você não tem acesso a ele."
        acao={<Link to="/" className="fdv-btn fdv-btn--secondary">Voltar ao início</Link>}
      />
    );

  const ehSolicitante = chamado.solicitante_id === perfil?.id;
  const encerrado = chamado.status === "fechado";

  return (
    <>
      <Link to={ehEquipe ? "/painel" : "/meus"} className="voltar">
        <ArrowLeft size={16} /> {ehEquipe ? "Painel técnico" : "Meus chamados"}
      </Link>

      <div className="detalhe-cabecalho">
        <div className="detalhe-cabecalho__linha">
          <span className="ticket-num ticket-num--lg">#{chamado.id}</span>
          <StatusBadge valor={chamado.status} />
          <PrioridadeBadge valor={chamado.prioridade} />
          <CategoriaTag categoria={chamado.categoria} />
        </div>
        <h2 className="fdv-page__title detalhe-titulo">{chamado.titulo}</h2>
        <p className="fdv-page__lead">
          Aberto por {chamado.solicitante?.nome ?? "—"} em {dataHora(chamado.created_at)} · atualizado {tempoRelativo(chamado.updated_at)}
        </p>
      </div>

      {ehSolicitante && chamado.status === "resolvido" && (
        <div className="fdv-alert fdv-alert--success alerta-acao">
          <span>
            <strong>A equipe de TI marcou este chamado como resolvido.</strong> O problema foi solucionado?
          </span>
          <span className="alerta-acao__botoes">
            <button className="fdv-btn fdv-btn--secondary fdv-btn--sm" onClick={() => setModalReabrir(true)} disabled={salvando}>
              <RotateCcw /> Ainda não
            </button>
            <button className="fdv-btn fdv-btn--primary fdv-btn--sm" onClick={() => void responderSolucao(true)} disabled={salvando}>
              <CheckCircle2 /> Sim, encerrar
            </button>
          </span>
        </div>
      )}

      <div className="detalhe-grid">
        <div className="detalhe-principal">
          <section className="fdv-card">
            <div className="fdv-card__header"><h3 className="fdv-card__title">Descrição</h3></div>
            <div className="fdv-card__body descricao">{chamado.descricao || <span className="fdv-muted">Sem descrição.</span>}</div>
            <div className="anexos-bloco">
              <div className="anexos-bloco__head">
                <span className="fdv-label">Anexos {anexos.length > 0 && `(${anexos.length})`}</span>
                {!encerrado && (
                  <label className="fdv-btn fdv-btn--ghost fdv-btn--sm">
                    <Paperclip /> Anexar
                    <input type="file" multiple hidden onChange={(e) => void anexar(e.target.files)} />
                  </label>
                )}
              </div>
              {anexos.length === 0 ? (
                <p className="fdv-help">Nenhum arquivo anexado.</p>
              ) : (
                <ul className="arquivos-lista">
                  {anexos.map((a) => (
                    <li key={a.id}>
                      <Paperclip size={14} aria-hidden="true" />
                      <button className="link-btn arquivo-nome" onClick={() => abrirAnexo(a.caminho).catch((e) => toast({ tipo: "erro", titulo: "Erro ao abrir", mensagem: mensagemErro(e) }))}>
                        {a.nome}
                      </button>
                      <span className="fdv-help">{tamanhoArquivo(a.tamanho)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="fdv-card" aria-labelledby="conversa">
            <div className="fdv-card__header"><h3 className="fdv-card__title" id="conversa">Conversa</h3></div>
            <div className="fdv-card__body">
              {comentarios.length === 0 ? (
                <p className="fdv-help">Nenhuma mensagem ainda. Use o campo abaixo para falar com {ehSolicitante ? "a equipe de TI" : "o solicitante"}.</p>
              ) : (
                <ol className="conversa">
                  {comentarios.map((c) => {
                    const meu = c.autor_id === perfil?.id;
                    return (
                      <li key={c.id} className={`msg${meu ? " msg--minha" : ""}${c.interno ? " msg--interna" : ""}`}>
                        <Avatar nome={c.autor?.nome ?? "?"} />
                        <div className="msg__balao">
                          <div className="msg__meta">
                            <strong>{c.autor?.nome ?? "Usuário"}</strong>
                            {c.interno && (
                              <span className="msg__interna"><Lock size={12} /> Nota interna</span>
                            )}
                            <span title={dataHora(c.created_at)}>{tempoRelativo(c.created_at)}</span>
                          </div>
                          <div className="msg__corpo">{c.corpo}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {!encerrado ? (
                <form className="msg-form" onSubmit={enviarMensagem}>
                  <label className="sr-only" htmlFor="nova-msg">Nova mensagem</label>
                  <textarea
                    id="nova-msg"
                    className="fdv-textarea"
                    rows={3}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder={ehEquipe ? "Responder ao solicitante ou registrar nota interna…" : "Escreva uma mensagem para a equipe de TI…"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
                    }}
                  />
                  <div className="msg-form__acoes">
                    {ehEquipe && (
                      <label className="check">
                        <input type="checkbox" checked={interno} onChange={(e) => setInterno(e.target.checked)} />
                        <Lock size={14} aria-hidden="true" /> Nota interna (só a TI vê)
                      </label>
                    )}
                    <button className="fdv-btn fdv-btn--primary" disabled={enviando || !mensagem.trim()}>
                      <Send /> {enviando ? "Enviando…" : "Enviar"}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="fdv-help encerrado-aviso">Chamado encerrado. Para um novo problema, abra outro chamado.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="detalhe-lateral">
          <section className="fdv-card">
            <div className="fdv-card__header"><h3 className="fdv-card__title">Atendimento</h3></div>
            <div className="fdv-card__body fdv-form compacto">
              {ehEquipe ? (
                <>
                  <div className="fdv-field">
                    <label className="fdv-label" htmlFor="sel-tecnico">Técnico responsável</label>
                    <select
                      id="sel-tecnico"
                      className="fdv-select"
                      value={chamado.tecnico_id ?? ""}
                      disabled={salvando}
                      onChange={(e) => void atualizar({ tecnico_id: e.target.value || null }, e.target.value ? "Técnico atribuído" : "Atribuição removida")}
                    >
                      <option value="">Não atribuído</option>
                      {equipe.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                    {chamado.tecnico_id !== perfil?.id && (
                      <button className="fdv-btn fdv-btn--secondary fdv-btn--sm" disabled={salvando} onClick={() => void atualizar({ tecnico_id: perfil!.id }, "Chamado assumido")}>
                        <UserCheck /> Assumir chamado
                      </button>
                    )}
                  </div>
                  <div className="fdv-field">
                    <label className="fdv-label" htmlFor="sel-status">Status</label>
                    <select id="sel-status" className="fdv-select" value={chamado.status} disabled={salvando} onChange={(e) => void atualizar({ status: e.target.value as Status }, "Status atualizado")}>
                      {STATUS.map((s) => (
                        <option key={s.valor} value={s.valor}>{s.rotulo}</option>
                      ))}
                    </select>
                  </div>
                  <div className="fdv-field">
                    <label className="fdv-label" htmlFor="sel-prioridade">Prioridade</label>
                    <select id="sel-prioridade" className="fdv-select" value={chamado.prioridade} disabled={salvando} onChange={(e) => void atualizar({ prioridade: e.target.value as Prioridade }, "Prioridade atualizada")}>
                      {PRIORIDADES.map((p) => (
                        <option key={p.valor} value={p.valor}>{p.rotulo}</option>
                      ))}
                    </select>
                  </div>
                  <div className="fdv-field">
                    <label className="fdv-label" htmlFor="sel-categoria">Categoria</label>
                    <select id="sel-categoria" className="fdv-select" value={chamado.categoria_id} disabled={salvando} onChange={(e) => void atualizar({ categoria_id: Number(e.target.value) }, "Categoria atualizada")}>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <dl className="dados">
                  <div><dt>Status</dt><dd><StatusBadge valor={chamado.status} /></dd></div>
                  <div><dt>Técnico</dt><dd>{chamado.tecnico?.nome ?? "Aguardando atribuição"}</dd></div>
                  <div><dt>Prioridade</dt><dd><PrioridadeBadge valor={chamado.prioridade} /></dd></div>
                </dl>
              )}
            </div>
          </section>

          <section className="fdv-card">
            <div className="fdv-card__header"><h3 className="fdv-card__title">Detalhes</h3></div>
            <div className="fdv-card__body">
              <dl className="dados">
                <div><dt>Solicitante</dt><dd>{chamado.solicitante?.nome ?? "—"}</dd></div>
                {ehEquipe && chamado.solicitante?.email && <div><dt>E-mail</dt><dd><a href={`mailto:${chamado.solicitante.email}`}>{chamado.solicitante.email}</a></dd></div>}
                {chamado.solicitante?.setor && <div><dt>Setor</dt><dd>{chamado.solicitante.setor}</dd></div>}
                {chamado.solicitante?.ramal && <div><dt>Ramal</dt><dd>{chamado.solicitante.ramal}</dd></div>}
                <div><dt>Local</dt><dd>{chamado.local || "—"}</dd></div>
                <div><dt>Patrimônio</dt><dd>{chamado.patrimonio || "—"}</dd></div>
                <div><dt>Abertura</dt><dd>{dataHora(chamado.created_at)}</dd></div>
                {chamado.resolvido_em && <div><dt>Resolvido em</dt><dd>{dataHora(chamado.resolvido_em)}</dd></div>}
                {chamado.fechado_em && <div><dt>Encerrado em</dt><dd>{dataHora(chamado.fechado_em)}</dd></div>}
              </dl>
            </div>
          </section>

          <section className="fdv-card">
            <div className="fdv-card__header"><h3 className="fdv-card__title">Histórico</h3></div>
            <div className="fdv-card__body">
              <ul className="fdv-timeline">
                {eventos.map((e) => (
                  <li key={e.id}>
                    {descreverEvento(e)}
                    <div className="fdv-timeline__when">
                      {dataHora(e.created_at)}
                      {e.autor?.nome ? ` · ${e.autor.nome}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </aside>
      </div>

      <Modal
        titulo="O problema continua?"
        aberto={modalReabrir}
        aoFechar={() => setModalReabrir(false)}
        rodape={
          <>
            <button className="fdv-btn fdv-btn--secondary" onClick={() => setModalReabrir(false)}>Cancelar</button>
            <button className="fdv-btn fdv-btn--primary" onClick={() => void responderSolucao(false)} disabled={salvando}>
              <RotateCcw /> Reabrir chamado
            </button>
          </>
        }
      >
        <div className="fdv-field">
          <label className="fdv-label" htmlFor="motivo">Conte o que ainda não está funcionando</label>
          <textarea id="motivo" className="fdv-textarea" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}
