-- =====================================================================
-- Central de Chamados de TI — FDV
-- Migração inicial: tipos, tabelas, funções, gatilhos, RLS, realtime e storage.
-- Execute no SQL Editor do Supabase (ou `supabase db push`).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------
create type public.papel_usuario   as enum ('solicitante', 'tecnico', 'admin');
create type public.prioridade_chamado as enum ('baixa', 'media', 'alta', 'critica');
create type public.status_chamado  as enum ('aberto', 'em_andamento', 'aguardando', 'resolvido', 'fechado');

-- ---------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------
create table public.perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null default '',
  email       text not null default '',
  setor       text,
  ramal       text,
  papel       public.papel_usuario not null default 'solicitante',
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.categorias (
  id         smallint generated always as identity primary key,
  slug       text not null unique,
  nome       text not null,
  descricao  text,
  icone      text not null default 'circle-help',
  destaque   boolean not null default false,
  ativo      boolean not null default true,
  ordem      smallint not null default 100
);

create table public.chamados (
  id             bigint generated always as identity (start with 1001) primary key,
  titulo         text not null check (char_length(titulo) between 3 and 160),
  descricao      text not null default '',
  categoria_id   smallint not null references public.categorias (id),
  prioridade     public.prioridade_chamado not null default 'media',
  status         public.status_chamado not null default 'aberto',
  local          text,
  patrimonio     text,
  solicitante_id uuid not null default auth.uid() references public.perfis (id),
  tecnico_id     uuid references public.perfis (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  resolvido_em   timestamptz,
  fechado_em     timestamptz
);
create index chamados_solicitante_idx on public.chamados (solicitante_id, created_at desc);
create index chamados_tecnico_idx     on public.chamados (tecnico_id);
create index chamados_status_idx      on public.chamados (status, prioridade);

create table public.comentarios (
  id          bigint generated always as identity primary key,
  chamado_id  bigint not null references public.chamados (id) on delete cascade,
  autor_id    uuid not null default auth.uid() references public.perfis (id),
  corpo       text not null check (char_length(corpo) between 1 and 5000),
  interno     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index comentarios_chamado_idx on public.comentarios (chamado_id, created_at);

create table public.eventos_chamado (
  id          bigint generated always as identity primary key,
  chamado_id  bigint not null references public.chamados (id) on delete cascade,
  autor_id    uuid references public.perfis (id),
  tipo        text not null,          -- criado | status | prioridade | atribuicao | categoria | comentario | anexo
  de          text,
  para        text,
  created_at  timestamptz not null default now()
);
create index eventos_chamado_idx on public.eventos_chamado (chamado_id, created_at);

create table public.notificacoes (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.perfis (id) on delete cascade,
  chamado_id  bigint references public.chamados (id) on delete cascade,
  titulo      text not null,
  mensagem    text,
  lida        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index notificacoes_usuario_idx on public.notificacoes (usuario_id, lida, created_at desc);

create table public.anexos (
  id          bigint generated always as identity primary key,
  chamado_id  bigint not null references public.chamados (id) on delete cascade,
  autor_id    uuid not null default auth.uid() references public.perfis (id),
  nome        text not null,
  caminho     text not null unique,
  tamanho     bigint,
  tipo        text,
  created_at  timestamptz not null default now()
);
create index anexos_chamado_idx on public.anexos (chamado_id);

-- ---------------------------------------------------------------------
-- 3. Funções auxiliares de permissão (security definer evita recursão de RLS)
-- ---------------------------------------------------------------------
create or replace function public.eh_equipe_ti()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and ativo and papel in ('tecnico', 'admin')
  );
$$;

create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and ativo and papel = 'admin'
  );
$$;

create or replace function public.pode_ver_chamado(p_chamado bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_equipe_ti()
      or exists (select 1 from public.chamados c where c.id = p_chamado and c.solicitante_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 4. Gatilhos
-- ---------------------------------------------------------------------

-- 4.1 Cria o perfil ao cadastrar usuário no Supabase Auth
create or replace function public.criar_perfil_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, email, setor)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'setor', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- 4.2 Impede que um usuário comum altere o próprio papel/ativo/e-mail
create or replace function public.proteger_campos_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.eh_admin() then
    if new.papel is distinct from old.papel or new.ativo is distinct from old.ativo or new.email is distinct from old.email then
      raise exception 'Somente administradores podem alterar papel, situação ou e-mail.';
    end if;
  end if;
  if auth.uid() = old.id and old.papel = 'admin' and (new.papel <> 'admin' or not new.ativo) then
    raise exception 'Você não pode remover o seu próprio acesso de administrador.';
  end if;
  return new;
end;
$$;

create trigger perfis_proteger_campos
  before update on public.perfis
  for each row execute function public.proteger_campos_perfil();

-- 4.3 Regras de criação/atualização de chamados
create or replace function public.preparar_chamado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Solicitante comum: sempre abre como "aberto", sem técnico e em seu próprio nome
    if auth.uid() is not null and not public.eh_equipe_ti() then
      new.status := 'aberto';
      new.tecnico_id := null;
      new.solicitante_id := auth.uid();
    end if;
    new.created_at := now();
  end if;

  new.updated_at := now();

  if new.status = 'resolvido' and (tg_op = 'INSERT' or old.status is distinct from 'resolvido') then
    new.resolvido_em := now();
  elsif new.status in ('aberto', 'em_andamento', 'aguardando') then
    new.resolvido_em := null;
  end if;

  if new.status = 'fechado' and (tg_op = 'INSERT' or old.status is distinct from 'fechado') then
    new.fechado_em := now();
  elsif new.status <> 'fechado' then
    new.fechado_em := null;
  end if;

  -- Ao atribuir técnico a um chamado aberto, ele passa a "em andamento"
  if tg_op = 'UPDATE' and new.tecnico_id is not null and old.tecnico_id is null
     and new.status = 'aberto' and old.status = 'aberto' then
    new.status := 'em_andamento';
  end if;

  return new;
end;
$$;

create trigger chamados_preparar
  before insert or update on public.chamados
  for each row execute function public.preparar_chamado();

-- 4.4 Histórico e notificações
create or replace function public.notificar(p_usuario uuid, p_chamado bigint, p_titulo text, p_msg text)
returns void language sql security definer set search_path = public as $$
  insert into public.notificacoes (usuario_id, chamado_id, titulo, mensagem)
  select p_usuario, p_chamado, p_titulo, p_msg
  where p_usuario is not null and p_usuario is distinct from auth.uid();
$$;

create or replace function public.notificar_equipe(p_chamado bigint, p_titulo text, p_msg text)
returns void language sql security definer set search_path = public as $$
  insert into public.notificacoes (usuario_id, chamado_id, titulo, mensagem)
  select p.id, p_chamado, p_titulo, p_msg
  from public.perfis p
  where p.ativo and p.papel in ('tecnico', 'admin') and p.id is distinct from auth.uid();
$$;

create or replace function public.rotulo_status(s public.status_chamado)
returns text language sql immutable as $$
  select case s
    when 'aberto' then 'Aberto' when 'em_andamento' then 'Em andamento'
    when 'aguardando' then 'Aguardando' when 'resolvido' then 'Resolvido'
    when 'fechado' then 'Fechado' end;
$$;

create or replace function public.registrar_alteracoes_chamado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ator uuid := auth.uid();
  v_nome text;
begin
  if tg_op = 'INSERT' then
    insert into public.eventos_chamado (chamado_id, autor_id, tipo, para)
    values (new.id, coalesce(v_ator, new.solicitante_id), 'criado', new.status::text);

    perform public.notificar_equipe(
      new.id,
      format('Novo chamado #%s', new.id),
      format('%s · prioridade %s', new.titulo, new.prioridade)
    );
    if new.tecnico_id is not null then
      perform public.notificar(new.tecnico_id, new.id, format('Chamado #%s atribuído a você', new.id), new.titulo);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.eventos_chamado (chamado_id, autor_id, tipo, de, para)
    values (new.id, v_ator, 'status', old.status::text, new.status::text);
    -- Na atribuição o solicitante já recebe o aviso "em atendimento" (abaixo)
    if new.tecnico_id is not distinct from old.tecnico_id then
      perform public.notificar(new.solicitante_id, new.id,
        format('Chamado #%s: %s', new.id, public.rotulo_status(new.status)), new.titulo);
    end if;
  end if;

  if new.prioridade is distinct from old.prioridade then
    insert into public.eventos_chamado (chamado_id, autor_id, tipo, de, para)
    values (new.id, v_ator, 'prioridade', old.prioridade::text, new.prioridade::text);
  end if;

  if new.categoria_id is distinct from old.categoria_id then
    insert into public.eventos_chamado (chamado_id, autor_id, tipo, de, para)
    select new.id, v_ator, 'categoria',
           (select nome from public.categorias where id = old.categoria_id),
           (select nome from public.categorias where id = new.categoria_id);
  end if;

  if new.tecnico_id is distinct from old.tecnico_id then
    select nome into v_nome from public.perfis where id = new.tecnico_id;
    insert into public.eventos_chamado (chamado_id, autor_id, tipo, de, para)
    values (new.id, v_ator, 'atribuicao',
            (select nome from public.perfis where id = old.tecnico_id), v_nome);
    perform public.notificar(new.tecnico_id, new.id, format('Chamado #%s atribuído a você', new.id), new.titulo);
    if new.tecnico_id is not null then
      perform public.notificar(new.solicitante_id, new.id,
        format('Chamado #%s em atendimento', new.id), format('Técnico responsável: %s', v_nome));
    end if;
  end if;

  return new;
end;
$$;

create trigger chamados_registrar
  after insert or update on public.chamados
  for each row execute function public.registrar_alteracoes_chamado();

-- 4.5 Comentários: histórico + notificação da outra parte
create or replace function public.registrar_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.chamados;
begin
  select * into c from public.chamados where id = new.chamado_id;

  insert into public.eventos_chamado (chamado_id, autor_id, tipo, para)
  values (new.chamado_id, new.autor_id, 'comentario', case when new.interno then 'interno' else 'publico' end);

  if new.autor_id = c.solicitante_id then
    if c.tecnico_id is not null then
      perform public.notificar(c.tecnico_id, c.id, format('Nova mensagem no chamado #%s', c.id), left(new.corpo, 140));
    else
      perform public.notificar_equipe(c.id, format('Nova mensagem no chamado #%s', c.id), left(new.corpo, 140));
    end if;
  elsif not new.interno then
    perform public.notificar(c.solicitante_id, c.id, format('Resposta da TI no chamado #%s', c.id), left(new.corpo, 140));
  end if;

  update public.chamados set updated_at = now() where id = new.chamado_id;
  return new;
end;
$$;

create trigger comentarios_registrar
  after insert on public.comentarios
  for each row execute function public.registrar_comentario();

-- 4.6 Anexos: histórico
create or replace function public.registrar_anexo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.eventos_chamado (chamado_id, autor_id, tipo, para)
  values (new.chamado_id, new.autor_id, 'anexo', new.nome);
  return new;
end;
$$;

create trigger anexos_registrar
  after insert on public.anexos
  for each row execute function public.registrar_anexo();

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
alter table public.perfis          enable row level security;
alter table public.categorias      enable row level security;
alter table public.chamados        enable row level security;
alter table public.comentarios     enable row level security;
alter table public.eventos_chamado enable row level security;
alter table public.notificacoes    enable row level security;
alter table public.anexos          enable row level security;

-- Perfis: cada um vê o próprio; todos veem a equipe de TI (nome do técnico); a TI vê todos
create policy "perfis: leitura" on public.perfis for select to authenticated
  using (id = auth.uid() or papel in ('tecnico', 'admin') or public.eh_equipe_ti());
create policy "perfis: editar o próprio" on public.perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "perfis: admin edita todos" on public.perfis for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Categorias: leitura para todos; manutenção pelo admin
create policy "categorias: leitura" on public.categorias for select to authenticated using (true);
create policy "categorias: admin gerencia" on public.categorias for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Chamados
create policy "chamados: leitura" on public.chamados for select to authenticated
  using (solicitante_id = auth.uid() or public.eh_equipe_ti());
create policy "chamados: abrir" on public.chamados for insert to authenticated
  with check (solicitante_id = auth.uid() or public.eh_equipe_ti());
create policy "chamados: TI atualiza" on public.chamados for update to authenticated
  using (public.eh_equipe_ti()) with check (public.eh_equipe_ti());
create policy "chamados: admin exclui" on public.chamados for delete to authenticated
  using (public.eh_admin());

-- Comentários: notas internas só para a TI
create policy "comentarios: leitura" on public.comentarios for select to authenticated
  using (public.eh_equipe_ti() or (not interno and public.pode_ver_chamado(chamado_id)));
create policy "comentarios: escrever" on public.comentarios for insert to authenticated
  with check (
    autor_id = auth.uid()
    and (public.eh_equipe_ti() or (not interno and public.pode_ver_chamado(chamado_id)))
  );

-- Histórico: somente leitura (gravado pelos gatilhos)
create policy "eventos: leitura" on public.eventos_chamado for select to authenticated
  using (public.pode_ver_chamado(chamado_id));

-- Notificações: cada um as suas
create policy "notificacoes: leitura" on public.notificacoes for select to authenticated
  using (usuario_id = auth.uid());
create policy "notificacoes: marcar lida" on public.notificacoes for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "notificacoes: excluir" on public.notificacoes for delete to authenticated
  using (usuario_id = auth.uid());

-- Anexos
create policy "anexos: leitura" on public.anexos for select to authenticated
  using (public.pode_ver_chamado(chamado_id));
create policy "anexos: enviar" on public.anexos for insert to authenticated
  with check (autor_id = auth.uid() and public.pode_ver_chamado(chamado_id));

-- Permissões de coluna: usuário comum só altera nome/setor/ramal e "lida"
revoke update on public.perfis from authenticated;
grant update (nome, setor, ramal, papel, ativo) on public.perfis to authenticated;
revoke update on public.notificacoes from authenticated;
grant update (lida) on public.notificacoes to authenticated;

-- ---------------------------------------------------------------------
-- 6. Indicadores do painel (respeita RLS: chamado por quem é da TI)
-- ---------------------------------------------------------------------
create or replace function public.indicadores_painel()
returns table (
  em_aberto bigint, sem_tecnico bigint, criticos bigint, em_andamento bigint,
  aguardando bigint, resolvidos_hoje bigint, tempo_medio_horas numeric
) language sql stable security invoker set search_path = public as $$
  select
    count(*) filter (where status in ('aberto', 'em_andamento', 'aguardando')),
    count(*) filter (where status in ('aberto', 'em_andamento', 'aguardando') and tecnico_id is null),
    count(*) filter (where prioridade = 'critica' and status in ('aberto', 'em_andamento', 'aguardando')),
    count(*) filter (where status = 'em_andamento'),
    count(*) filter (where status = 'aguardando'),
    count(*) filter (where resolvido_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),
    round((avg(extract(epoch from (resolvido_em - created_at)) / 3600)
          filter (where resolvido_em >= now() - interval '30 days'))::numeric, 1)
  from public.chamados;
$$;

-- Solicitante confirma a solução (fecha) ou reabre um chamado resolvido
create or replace function public.responder_solucao(p_chamado bigint, p_aceitar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.chamados;
begin
  select * into c from public.chamados where id = p_chamado;
  if c.id is null or c.solicitante_id is distinct from auth.uid() then
    raise exception 'Chamado não encontrado.';
  end if;
  if c.status <> 'resolvido' then
    raise exception 'Só é possível responder a um chamado marcado como resolvido.';
  end if;
  update public.chamados
     set status = case when p_aceitar then 'fechado'::public.status_chamado
                       else (case when tecnico_id is null then 'aberto' else 'em_andamento' end)::public.status_chamado end
   where id = p_chamado;
  if not p_aceitar then
    perform public.notificar(c.tecnico_id, c.id, format('Chamado #%s reaberto pelo solicitante', c.id), c.titulo);
  end if;
end;
$$;
revoke execute on function public.responder_solucao(bigint, boolean) from public, anon;
grant execute on function public.responder_solucao(bigint, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Dados iniciais: categorias
-- ---------------------------------------------------------------------
insert into public.categorias (slug, nome, descricao, icone, destaque, ordem) values
  ('hardware',  'Hardware',          'Computadores, projetores, monitores e periféricos', 'monitor',   true,  10),
  ('totvs',     'TOTVS',             'Sistema acadêmico, financeiro e RM',                'database',  true,  20),
  ('rede',      'Rede e internet',   'Wi-Fi, cabeamento e conexão',                       'wifi',      false, 30),
  ('acesso',    'Acesso e senhas',   'Contas, e-mail institucional e permissões',         'key-round', false, 40),
  ('software',  'Software',          'Instalação e problemas em programas',               'app-window',false, 50),
  ('impressao', 'Impressão',         'Impressoras e digitalização',                       'printer',   false, 60),
  ('outros',    'Outros',            'Demandas que não se encaixam acima',                'circle-help', false, 90);

-- ---------------------------------------------------------------------
-- 8. Tempo real
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.chamados;
alter publication supabase_realtime add table public.comentarios;
alter publication supabase_realtime add table public.eventos_chamado;
alter publication supabase_realtime add table public.notificacoes;

-- ---------------------------------------------------------------------
-- 9. Storage: anexos (bucket privado, pasta = número do chamado)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 10485760)
on conflict (id) do nothing;

create policy "anexos storage: leitura" on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and public.pode_ver_chamado(((storage.foldername(name))[1])::bigint));
create policy "anexos storage: envio" on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and public.pode_ver_chamado(((storage.foldername(name))[1])::bigint));
