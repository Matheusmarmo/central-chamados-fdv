import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import logoFdv from "../assets/logo-fdv.png";
import { useAuth } from "../context/AuthContext";
import { mensagemErro, supabase } from "../lib/supabase";

type Modo = "entrar" | "cadastrar" | "recuperar";

const DOMINIO = (import.meta.env.VITE_DOMINIO_EMAIL as string | undefined)?.trim();

export default function Login() {
  const { session } = useAuth();
  const [modo, setModo] = useState<Modo>("entrar");
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  if (session) return <Navigate to="/" replace />;

  const trocar = (m: Modo) => {
    setModo(m);
    setErro("");
    setAviso("");
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    const emailLimpo = email.trim().toLowerCase();
    if (modo === "cadastrar" && DOMINIO && !emailLimpo.endsWith(`@${DOMINIO}`)) {
      setErro(`Use seu e-mail institucional (@${DOMINIO}).`);
      return;
    }
    setEnviando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: emailLimpo, password: senha });
        if (error) throw error;
      } else if (modo === "cadastrar") {
        const { data, error } = await supabase.auth.signUp({
          email: emailLimpo,
          password: senha,
          options: { data: { nome: nome.trim(), setor: setor.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setAviso("Conta criada. Enviamos um link de confirmação para o seu e-mail.");
          setModo("entrar");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(emailLimpo, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (error) throw error;
        setAviso("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
      }
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <img src={logoFdv} width={100} height={111} alt="FDV – Faculdade de Direito de Vitória" className="auth-brand__logo" />
        <div>
          <p className="auth-brand__kicker">Faculdade de Direito de Vitória</p>
          <h1 className="auth-brand__title">Central de Chamados de TI</h1>
          <p className="auth-brand__text">
            Registre e acompanhe solicitações de suporte para equipamentos, sistemas TOTVS, rede e acessos.
          </p>
        </div>
      </div>

      <div className="auth-panel">
        <form className="fdv-card auth-card" onSubmit={enviar} noValidate>
          <div className="fdv-card__body fdv-form">
            <div>
              <h2 className="auth-card__title">
                {modo === "entrar" ? "Entrar" : modo === "cadastrar" ? "Criar conta" : "Recuperar senha"}
              </h2>
              <p className="fdv-help">
                {modo === "entrar"
                  ? "Acesse com seu e-mail e senha."
                  : modo === "cadastrar"
                    ? DOMINIO
                      ? `Use seu e-mail institucional @${DOMINIO}.`
                      : "Use seu e-mail institucional."
                    : "Informe o e-mail da sua conta."}
              </p>
            </div>

            {erro && <div className="fdv-alert fdv-alert--danger" role="alert">{erro}</div>}
            {aviso && <div className="fdv-alert fdv-alert--success" role="status">{aviso}</div>}

            {modo === "cadastrar" && (
              <>
                <div className="fdv-field">
                  <label className="fdv-label" htmlFor="nome">Nome completo</label>
                  <input id="nome" className="fdv-input" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" />
                </div>
                <div className="fdv-field">
                  <label className="fdv-label" htmlFor="setor">Setor</label>
                  <input id="setor" className="fdv-input" value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex.: Secretaria acadêmica" autoComplete="organization-title" />
                </div>
              </>
            )}

            <div className="fdv-field">
              <label className="fdv-label" htmlFor="email">E-mail</label>
              <input id="email" type="email" className="fdv-input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>

            {modo !== "recuperar" && (
              <div className="fdv-field">
                <label className="fdv-label" htmlFor="senha">Senha</label>
                <input
                  id="senha"
                  type="password"
                  className="fdv-input"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                />
                {modo === "cadastrar" && <span className="fdv-help">Mínimo de 6 caracteres.</span>}
              </div>
            )}

            <button className="fdv-btn fdv-btn--primary auth-submit" disabled={enviando}>
              {enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : modo === "cadastrar" ? "Criar conta" : "Enviar link"}
            </button>

            <div className="auth-links">
              {modo === "entrar" ? (
                <>
                  <button type="button" className="link-btn" onClick={() => trocar("recuperar")}>Esqueci minha senha</button>
                  <button type="button" className="link-btn" onClick={() => trocar("cadastrar")}>Criar conta</button>
                </>
              ) : (
                <button type="button" className="link-btn" onClick={() => trocar("entrar")}>Voltar para o login</button>
              )}
            </div>
          </div>
        </form>
        <p className="auth-foot">Dúvidas sobre o acesso? Procure a equipe de TI da FDV.</p>
      </div>
    </div>
  );
}
