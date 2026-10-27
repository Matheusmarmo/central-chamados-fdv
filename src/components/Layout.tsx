import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  FolderCog,
  Gauge,
  House,
  ListChecks,
  LogOut,
  Menu,
  PlusCircle,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import logoFdv from "../assets/logo-fdv.png";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useNotificacoes } from "../hooks/useNotificacoes";
import { rotuloPapel, tempoRelativo } from "../lib/format";
import { Avatar } from "./Ui";

function tituloDaRota(path: string): string {
  if (path.startsWith("/chamados/")) return `Chamado #${path.split("/")[2]}`;
  const mapa: Record<string, string> = {
    "/inicio": "Início",
    "/novo": "Abrir chamado",
    "/meus": "Meus chamados",
    "/painel": "Painel técnico",
    "/admin/usuarios": "Usuários",
    "/admin/categorias": "Categorias",
    "/perfil": "Meu perfil",
  };
  return mapa[path] ?? "Central de Chamados de TI";
}

export default function Layout() {
  const { perfil, ehEquipe, ehAdmin, sair } = useAuth();
  const toast = useToast();
  const navegar = useNavigate();
  const local = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const [notifAberto, setNotifAberto] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { itens, naoLidas, marcarLida, marcarTodas } = useNotificacoes(perfil?.id, (n) =>
    toast({ tipo: "info", titulo: n.titulo, mensagem: n.mensagem ?? undefined }),
  );

  // Fecha o menu lateral ao navegar (celular) e atualiza o título da aba
  useEffect(() => {
    setMenuAberto(false);
    setNotifAberto(false);
    document.title = `${tituloDaRota(local.pathname)} · Central de Chamados de TI · FDV`;
  }, [local.pathname]);

  useEffect(() => {
    if (!notifAberto) return;
    const clique = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifAberto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setNotifAberto(false);
    document.addEventListener("mousedown", clique);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", clique);
      document.removeEventListener("keydown", tecla);
    };
  }, [notifAberto]);

  const nome = perfil?.nome || perfil?.email || "";

  return (
    <div className="app-shell">
      <aside className={`fdv-sidebar${menuAberto ? " open" : ""}`} aria-label="Navegação principal">
        <div className="fdv-sidebar__header sidebar-head">
          <Link className="fdv-brand" to="/">
            <img className="fdv-brand__logo" src={logoFdv} width={100} height={111} alt="FDV – Faculdade de Direito de Vitória" />
            <span className="fdv-brand__name">
              <span className="fdv-brand__subtitle">Faculdade de Direito de Vitória</span>
              <span className="fdv-brand__title">Central de Chamados de TI</span>
            </span>
          </Link>
          <button className="fdv-icon-btn sidebar-close" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">
            <X />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="fdv-sidebar__section">Solicitações</div>
          <NavLink className="fdv-nav-item" to="/inicio">
            <House /> Início
          </NavLink>
          <NavLink className="fdv-nav-item" to="/novo">
            <PlusCircle /> Abrir chamado
          </NavLink>
          <NavLink className="fdv-nav-item" to="/meus">
            <ListChecks /> Meus chamados
          </NavLink>

          {ehEquipe && (
            <>
              <div className="fdv-sidebar__section">Equipe de TI</div>
              <NavLink className="fdv-nav-item" to="/painel">
                <Gauge /> Painel técnico
              </NavLink>
            </>
          )}

          {ehAdmin && (
            <>
              <div className="fdv-sidebar__section">Administração</div>
              <NavLink className="fdv-nav-item" to="/admin/usuarios">
                <UsersRound /> Usuários
              </NavLink>
              <NavLink className="fdv-nav-item" to="/admin/categorias">
                <FolderCog /> Categorias
              </NavLink>
            </>
          )}
        </nav>

        <div className="fdv-sidebar__footer">
          <NavLink className="fdv-nav-item" to="/perfil" style={{ margin: 0 }}>
            <UserRound /> Meu perfil
          </NavLink>
          <button className="fdv-nav-item nav-button" onClick={() => void sair()} style={{ margin: 0 }}>
            <LogOut /> Sair
          </button>
        </div>
      </aside>
      {menuAberto && <div className="drawer-overlay" onClick={() => setMenuAberto(false)} aria-hidden="true" />}

      <div className="app-main">
        <header className="fdv-topbar">
          <button className="fdv-icon-btn fdv-menu-toggle" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
            <Menu />
          </button>
          <h1 className="fdv-topbar__title">{tituloDaRota(local.pathname)}</h1>
          <div className="fdv-topbar__actions">
            <div className="notif-wrap" ref={notifRef}>
              <button
                className="fdv-icon-btn"
                onClick={() => setNotifAberto((v) => !v)}
                aria-label={naoLidas ? `Notificações: ${naoLidas} não lidas` : "Notificações"}
                aria-expanded={notifAberto}
              >
                <Bell />
                {naoLidas > 0 && <span className="fdv-icon-btn__dot">{naoLidas > 9 ? "9+" : naoLidas}</span>}
              </button>
              {notifAberto && (
                <div className="notif-panel" role="dialog" aria-label="Notificações">
                  <div className="notif-panel__head">
                    <strong>Notificações</strong>
                    {naoLidas > 0 && (
                      <button className="fdv-btn fdv-btn--ghost fdv-btn--sm" onClick={() => void marcarTodas()}>
                        <CheckCheck /> Marcar todas como lidas
                      </button>
                    )}
                  </div>
                  <div className="notif-panel__list">
                    {itens.length === 0 && <p className="notif-empty">Nenhuma notificação por enquanto.</p>}
                    {itens.map((n) => (
                      <button
                        key={n.id}
                        className={`fdv-notification notif-item${n.lida ? "" : " unread"}`}
                        onClick={() => {
                          void marcarLida(n.id);
                          setNotifAberto(false);
                          if (n.chamado_id) navegar(`/chamados/${n.chamado_id}`);
                        }}
                      >
                        <span>
                          <span className="notif-item__title">{n.titulo}</span>
                          {n.mensagem && <span className="notif-item__msg">{n.mensagem}</span>}
                          <span className="fdv-notification__time">{tempoRelativo(n.created_at)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Link to="/perfil" className="fdv-user" aria-label="Meu perfil">
              <Avatar nome={nome} />
              <span>
                <span className="fdv-user__name">{nome}</span>
                <span className="fdv-user__role">{rotuloPapel(perfil?.papel)}</span>
              </span>
            </Link>
          </div>
        </header>
        <main className="fdv-page app-page" id="conteudo">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
