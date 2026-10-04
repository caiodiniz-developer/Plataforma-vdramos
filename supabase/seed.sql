-- Dados de exemplo para desenvolvimento local (`supabase db reset` roda este
-- arquivo depois das migrations). Não contém usuários nem senhas: o admin e o
-- aluno de exemplo são criados por `npm run usuarios:exemplo`.
--
-- Turma de referência do PRD: "Excel Básico com IA Generativa", SENAI
-- Campinas, 5 encontros de 14/10 a 28/10/2026, 18:45–22:45, 20 vagas.
-- As datas intermediárias, os títulos e os blocos são EXEMPLO: ajuste ao
-- cronograma oficial da turma.

do $$
declare
  v_curso uuid;
  v_turma uuid;
  v_encontro uuid;
  v_sessao uuid;
  v_atividade uuid;
  v_item uuid;
  v_dia record;
begin
  -- Perfil público com o texto do Brand Style Guide. Contatos ficam em branco
  -- até o professor preencher no admin.
  insert into public.perfil_publico (nome_exibicao, titulo, bio, email_contato, linkedin_url, cidade)
  values (
    'Vitor Ramos',
    'Dados · IA · Educação',
    'Construindo produtos e educação em dados e inteligência artificial — do modelo ao letramento, com rigor técnico e clareza didática.',
    'contato@exemplo.com',
    'https://www.linkedin.com/',
    'Campinas, SP'
  )
  on conflict (unico) do nothing;

  insert into public.curso
    (nome, tipo_formacao, carga_horaria_h, objetivo, ementa_md, publico_alvo, pre_requisitos, criterios_avaliacao_md)
  values (
    'Excel Básico com IA Generativa',
    'FIC Aperfeiçoamento',
    20,
    'Organizar, analisar e apresentar dados no Excel, usando ferramentas de IA generativa com critério e ética.',
    E'- Estruturação de dados em tabelas\n- Fórmulas e referências de célula\n- Funções de busca (PROCV, PROCX)\n- Tabelas dinâmicas e gráficos\n- IA generativa como apoio: pedidos, revisão e limites\n- Uso ético e responsável da IA',
    'Profissionais e estudantes que usam planilhas no dia a dia.',
    'Noções básicas de uso do computador.',
    E'Avaliação por situações de aprendizagem (SA), com entregas práticas em cada encontro.\n\n**Nível mínimo:** atingir as capacidades técnicas CT1 a CT3.'
  )
  returning id into v_curso;

  insert into public.capacidade (curso_id, codigo, tipo, descricao) values
    (v_curso, 'CT1', 'tecnica', 'Estruturar dados em tabelas consistentes para análise.'),
    (v_curso, 'CT2', 'tecnica', 'Aplicar fórmulas, referências e funções de busca.'),
    (v_curso, 'CT3', 'tecnica', 'Resumir dados com tabelas dinâmicas e gráficos.'),
    (v_curso, 'CT4', 'tecnica', 'Usar IA generativa para apoiar tarefas em planilhas, revisando o resultado.'),
    (v_curso, 'CS1.1', 'socioemocional', 'Agir com ética no uso de dados e de ferramentas de IA.'),
    (v_curso, 'CS1.2', 'socioemocional', 'Comunicar resultados com clareza.');

  insert into public.turma
    (curso_id, codigo, instituicao, cidade, modalidade, data_inicio, data_fim, vagas, status)
  values (v_curso, 'EXCIA-CPS-2610', 'SENAI', 'Campinas', 'presencial', '2026-10-14', '2026-10-28', 20, 'ativa')
  returning id into v_turma;

  for v_dia in
    select * from (values
      (1, date '2026-10-14', 'SA1 · Estruturação de Dados e IA Ética'),
      (2, date '2026-10-19', 'SA2 · Fórmulas e Referências'),
      (3, date '2026-10-21', 'SA3 · Funções de Busca'),
      (4, date '2026-10-26', 'SA4 · Tabelas Dinâmicas e Gráficos'),
      (5, date '2026-10-28', 'SA5 · Projeto Final com IA Generativa')
    ) as d (numero, data, titulo)
  loop
    insert into public.encontro (turma_id, numero, data, hora_inicio, hora_fim, titulo, local)
    values (v_turma, v_dia.numero, v_dia.data, '18:45', '22:45', v_dia.titulo, 'Laboratório de informática')
    returning id into v_encontro;

    -- 240 min: 15 + 60 + 15 + 90 + 30 + 30.
    insert into public.bloco_encontro (encontro_id, ordem, hora_inicio, duracao_min, tipo, titulo) values
      (v_encontro, 1, '18:45', 15, 'abertura', 'Abertura e combinados'),
      (v_encontro, 2, '19:00', 60, 'teoria', 'Conceitos do encontro'),
      (v_encontro, 3, '20:00', 15, 'intervalo', 'Intervalo'),
      (v_encontro, 4, '20:15', 90, 'pratica', 'Prática guiada na planilha'),
      (v_encontro, 5, '21:45', 30, 'perguntas', 'Perguntas da turma'),
      (v_encontro, 6, '22:15', 30, 'margem', 'Margem para fechamento');

    insert into public.material (turma_id, encontro_id, titulo, tipo, url, ordem)
    values (v_turma, v_encontro, format('Planilha do encontro %s', v_dia.numero), 'exercicio',
            format('https://exemplo.com/excel/encontro-%s.xlsx', v_dia.numero), 0);

    if v_dia.numero = 1 then
      select s.id into v_sessao from public.sessao_ao_vivo s where s.encontro_id = v_encontro;
    end if;
  end loop;

  insert into public.material (turma_id, titulo, tipo, url, ordem) values
    (v_turma, 'Apostila do curso', 'slides', 'https://exemplo.com/excel/apostila.pdf', 0),
    (v_turma, 'Guia de uso ético da IA', 'link', 'https://exemplo.com/excel/ia-etica', 1);

  -- Quiz em rascunho, ligado à sessão do encontro 1.
  insert into public.atividade (turma_id, sessao_ao_vivo_id, tipo, titulo, tempo_limite_s, mostrar_resultado)
  values (v_turma, v_sessao, 'quiz', 'Quiz — referências de célula', 60, 'apos_encerrar')
  returning id into v_atividade;

  insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta, explicacao)
  values (v_atividade, 1, 'Qual símbolo fixa uma referência de célula?', 'escolha_unica',
          'O cifrão ($) trava a linha, a coluna ou as duas.')
  returning id into v_item;
  insert into public.atividade_opcao (atividade_item_id, ordem, texto, correta) values
    (v_item, 1, '$', true),
    (v_item, 2, '#', false),
    (v_item, 3, '&', false);

  -- Pesquisa "Satisfação — teoria" (modelo do PRD F19), em rascunho.
  insert into public.atividade (turma_id, sessao_ao_vivo_id, tipo, titulo, alvo, anonima, mostrar_resultado)
  values (v_turma, v_sessao, 'pesquisa_satisfacao', 'Satisfação — teoria', 'teoria', true, 'nunca')
  returning id into v_atividade;
  insert into public.atividade_item (atividade_id, ordem, enunciado, tipo_resposta, obrigatorio) values
    (v_atividade, 1, 'Clareza: a explicação foi fácil de acompanhar?', 'escala_1_5', true),
    (v_atividade, 2, 'Ritmo: o tempo dedicado a esta parte foi adequado?', 'escala_1_5', true),
    (v_atividade, 3, 'Utilidade: você consegue aplicar o que viu no seu trabalho?', 'escala_1_5', true),
    (v_atividade, 4, 'O que podemos melhorar nesta parte?', 'texto_livre', false);

  -- IDs autorizados de exemplo. ALUNO-0001 é usado pelo aluno de exemplo.
  insert into public.aluno_autorizado (turma_id, matricula, nome_referencia) values
    (v_turma, 'ALUNO-0001', 'Aluno de exemplo'),
    (v_turma, 'ALUNO-0002', null),
    (v_turma, 'ALUNO-0003', null);
end;
$$;
