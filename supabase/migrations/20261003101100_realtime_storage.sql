-- Realtime e Storage.

-- PRD, seção 2: Postgres Changes em pergunta, mensagem, atividade e
-- atividade_resposta. `sessao_ao_vivo` entra também: é por ela que o aluno
-- recebe abertura, encerramento e os avisos de moderação.
alter publication supabase_realtime add table public.sessao_ao_vivo;
alter publication supabase_realtime add table public.pergunta;
alter publication supabase_realtime add table public.mensagem;
alter publication supabase_realtime add table public.atividade;
alter publication supabase_realtime add table public.atividade_resposta;

-- Buckets: `publico` (foto da landing) e `materiais` (privado, URL assinada).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('publico', 'publico', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('materiais', 'materiais', false, 52428800, null)
on conflict (id) do nothing;

create policy publico_ler on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'publico');

create policy publico_admin_inserir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'publico' and public.eh_admin());

create policy publico_admin_atualizar on storage.objects
  for update to authenticated
  using (bucket_id = 'publico' and public.eh_admin())
  with check (bucket_id = 'publico' and public.eh_admin());

create policy publico_admin_excluir on storage.objects
  for delete to authenticated
  using (bucket_id = 'publico' and public.eh_admin());

create policy materiais_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'materiais' and public.eh_admin())
  with check (bucket_id = 'materiais' and public.eh_admin());

-- O aluno só baixa o arquivo de um material que ele pode ler: a subconsulta
-- roda com a RLS de `material` (turma do aluno e material já liberado).
create policy materiais_aluno_ler on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materiais'
    and exists (select 1 from public.material m where m.arquivo_path = objects.name)
  );
