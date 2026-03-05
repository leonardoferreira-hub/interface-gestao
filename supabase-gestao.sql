-- =============================================
-- SQL completo para Interface Gestão
-- Rodar no Supabase Dashboard > SQL Editor
-- Projeto: gthtvpujwukbfgokghne.supabase.co
-- =============================================

-- =============================================
-- 1. Tabela tarefas_gestao (Kanban)
-- =============================================

CREATE TABLE public.tarefas_gestao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.usuarios(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'validating', 'done')),
  posicao INTEGER NOT NULL DEFAULT 0,
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  id_emissao TEXT,
  mencionados UUID[] NOT NULL DEFAULT '{}',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefas_gestao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tarefas_gestao_select" ON public.tarefas_gestao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tarefas_gestao_insert" ON public.tarefas_gestao
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tarefas_gestao_update" ON public.tarefas_gestao
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.role IN ('admin', 'coordenador_gestao', 'coordenador_rh')
    )
  );

CREATE POLICY "tarefas_gestao_delete" ON public.tarefas_gestao
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.role IN ('admin', 'coordenador_gestao', 'coordenador_rh')
    )
  );

-- =============================================
-- 2. Tabela tarefa_gestao_status_log (KPI trigger)
-- =============================================

CREATE TABLE public.tarefa_gestao_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID NOT NULL REFERENCES public.tarefas_gestao(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  transicao_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES public.usuarios(id)
);

CREATE INDEX idx_gestao_status_log_tarefa ON public.tarefa_gestao_status_log(tarefa_id, transicao_em);

ALTER TABLE public.tarefa_gestao_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestao_log_select" ON public.tarefa_gestao_status_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "gestao_log_insert" ON public.tarefa_gestao_status_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_tarefa_gestao_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tarefa_gestao_status_log (tarefa_id, status_anterior, status_novo, user_id)
    VALUES (NEW.id, NULL, NEW.status, NEW.user_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.tarefa_gestao_status_log (tarefa_id, status_anterior, status_novo, user_id)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_tarefa_gestao_status
  AFTER INSERT OR UPDATE ON public.tarefas_gestao
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tarefa_gestao_status();

-- =============================================
-- 3. Tabela rotinas_gestao
-- =============================================

CREATE TABLE public.rotinas_gestao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  dia_util_regra INTEGER NOT NULL DEFAULT 5,
  responsavel_id UUID REFERENCES public.usuarios(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rotinas_gestao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rotinas_gestao_select" ON public.rotinas_gestao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "rotinas_gestao_insert" ON public.rotinas_gestao
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.role IN ('admin', 'coordenador_gestao', 'coordenador_rh')
    )
  );

CREATE POLICY "rotinas_gestao_update" ON public.rotinas_gestao
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.role IN ('admin', 'coordenador_gestao', 'coordenador_rh')
    )
  );

CREATE POLICY "rotinas_gestao_delete" ON public.rotinas_gestao
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.role IN ('admin', 'coordenador_gestao', 'coordenador_rh')
    )
  );

-- =============================================
-- 4. Tabela rotina_gestao_cumprimentos
-- =============================================

CREATE TABLE public.rotina_gestao_cumprimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id UUID NOT NULL REFERENCES public.rotinas_gestao(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  data_esperada DATE NOT NULL,
  data_cumprimento TIMESTAMPTZ,
  cumprida_por UUID REFERENCES public.usuarios(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'cumprida', 'atrasada')),
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rotina_id, mes_referencia)
);

ALTER TABLE public.rotina_gestao_cumprimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestao_cumprimentos_select" ON public.rotina_gestao_cumprimentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "gestao_cumprimentos_insert" ON public.rotina_gestao_cumprimentos
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "gestao_cumprimentos_update" ON public.rotina_gestao_cumprimentos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        usuarios.role IN ('admin', 'coordenador_gestao', 'coordenador_rh')
        OR usuarios.id = (
          SELECT responsavel_id FROM public.rotinas_gestao WHERE rotinas_gestao.id = rotina_gestao_cumprimentos.rotina_id
        )
      )
    )
  );

-- =============================================
-- 5. Inserir coordenadores (se não existirem)
-- =============================================

INSERT INTO public.usuarios (nome_completo, email, role, ativo)
SELECT 'Rafael Barichello', 'rafael.barichello@grupotravessia.com', 'coordenador_gestao', true
WHERE NOT EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'rafael.barichello@grupotravessia.com');

INSERT INTO public.usuarios (nome_completo, email, role, ativo)
SELECT 'Yuri Inokuti', 'yuri.inokuti@grupotravessia.com', 'coordenador_gestao', true
WHERE NOT EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'yuri.inokuti@grupotravessia.com');

INSERT INTO public.usuarios (nome_completo, email, role, ativo)
SELECT 'Diego Bomfim', 'diego.bomfim@grupotravessia.com', 'coordenador_gestao', true
WHERE NOT EXISTS (SELECT 1 FROM public.usuarios WHERE email = 'diego.bomfim@grupotravessia.com');

-- Camila já existe como coordenador_rh, não altera o role

-- =============================================
-- 6. Inserir interface Gestão no portal
-- =============================================

INSERT INTO public.interfaces (slug, nome, descricao, url, icone, cor, ordem)
SELECT 'gestao', 'Gestão', 'Rotinas, KPIs e pendências da Gestão', 'https://interface-gestao.vercel.app', 'BarChart3', '340 75% 32%', 6
WHERE NOT EXISTS (SELECT 1 FROM public.interfaces WHERE slug = 'gestao');

-- =============================================
-- 7. Conceder acesso no portal
-- =============================================

INSERT INTO public.usuario_interface_acesso (usuario_id, interface_id)
SELECT u.id, i.id
FROM public.usuarios u, public.interfaces i
WHERE u.email = 'rafael.barichello@grupotravessia.com' AND i.slug = 'gestao'
AND NOT EXISTS (SELECT 1 FROM public.usuario_interface_acesso a WHERE a.usuario_id = u.id AND a.interface_id = i.id);

INSERT INTO public.usuario_interface_acesso (usuario_id, interface_id)
SELECT u.id, i.id
FROM public.usuarios u, public.interfaces i
WHERE u.email = 'yuri.inokuti@grupotravessia.com' AND i.slug = 'gestao'
AND NOT EXISTS (SELECT 1 FROM public.usuario_interface_acesso a WHERE a.usuario_id = u.id AND a.interface_id = i.id);

INSERT INTO public.usuario_interface_acesso (usuario_id, interface_id)
SELECT u.id, i.id
FROM public.usuarios u, public.interfaces i
WHERE u.email = 'diego.bomfim@grupotravessia.com' AND i.slug = 'gestao'
AND NOT EXISTS (SELECT 1 FROM public.usuario_interface_acesso a WHERE a.usuario_id = u.id AND a.interface_id = i.id);

INSERT INTO public.usuario_interface_acesso (usuario_id, interface_id)
SELECT u.id, i.id
FROM public.usuarios u, public.interfaces i
WHERE u.email = 'camila.oliveira@grupotravessia.com' AND i.slug = 'gestao'
AND NOT EXISTS (SELECT 1 FROM public.usuario_interface_acesso a WHERE a.usuario_id = u.id AND a.interface_id = i.id);

-- =============================================
-- 8. Tabela equipe_vinculos (coordenador → analista)
-- =============================================

CREATE TABLE public.equipe_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenador_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  membro_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coordenador_id, membro_id)
);

CREATE INDEX idx_equipe_vinculos_coordenador ON public.equipe_vinculos(coordenador_id);
CREATE INDEX idx_equipe_vinculos_membro ON public.equipe_vinculos(membro_id);

ALTER TABLE public.equipe_vinculos ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado pode ver os vínculos
CREATE POLICY "equipe_vinculos_select" ON public.equipe_vinculos
  FOR SELECT TO authenticated USING (true);

-- INSERT: admin pode tudo; coordenador_gestao/coordenador_rh pode vincular a si próprio
CREATE POLICY "equipe_vinculos_insert" ON public.equipe_vinculos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        usuarios.role = 'admin'
        OR (usuarios.role IN ('coordenador_gestao', 'coordenador_rh') AND equipe_vinculos.coordenador_id = auth.uid())
      )
    )
  );

-- DELETE: admin pode tudo; coordenador pode remover seus próprios vínculos
CREATE POLICY "equipe_vinculos_delete" ON public.equipe_vinculos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        usuarios.role = 'admin'
        OR (usuarios.role IN ('coordenador_gestao', 'coordenador_rh') AND equipe_vinculos.coordenador_id = auth.uid())
      )
    )
  );

-- =============================================
-- 9. Policy para admin atualizar role de usuarios
-- =============================================

CREATE POLICY "usuarios_update_role_admin" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );
