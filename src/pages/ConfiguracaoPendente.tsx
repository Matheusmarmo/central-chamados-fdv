import logoFdv from "../assets/logo-fdv.png";

export default function ConfiguracaoPendente() {
  return (
    <div className="auth-page auth-page--single">
      <div className="fdv-card auth-card">
        <div className="fdv-card__body fdv-form">
          <div className="pessoa">
            <span className="logo-fundo"><img src={logoFdv} width={100} height={111} alt="FDV" /></span>
            <h1 className="auth-card__title">Configuração pendente</h1>
          </div>
          <p>O sistema ainda não está conectado ao Supabase.</p>
          <ol className="lista-passos">
            <li>Copie o arquivo <code>.env.example</code> para <code>.env</code>.</li>
            <li>Preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> (Supabase → Project Settings → API).</li>
            <li>Reinicie o servidor (<code>npm run dev</code>) ou publique novamente.</li>
          </ol>
          <p className="fdv-help">Passo a passo completo no README do projeto.</p>
        </div>
      </div>
    </div>
  );
}
