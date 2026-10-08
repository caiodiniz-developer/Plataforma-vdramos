import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { carregarFuncao, inscrever, semearTurma, SENHA_DE_TESTE } from './ambiente'

const CREDENCIAIS = 'ID, turma ou senha incorretos.'
const NAO_ENCONTRADO = 'Não encontramos essa combinação. Confira com o professor.'
const BLOQUEADA = 'Sua conta está temporariamente bloqueada. Entre em contato com seu professor.'
const IDS = { matricula: 'ALUNO-0001', codigo_turma: 'EXCIA-CPS-2610' }
const SENHA = SENHA_DE_TESTE
const OUTRA = SENHA + 'x'
const SO_LETRAS = 'apenasletras'
const SO_NUMEROS = '1234567890'

type Ambiente = Awaited<ReturnType<typeof carregarFuncao>>
let amb: Ambiente
let turma: ReturnType<typeof semearTurma>

beforeEach(async () => {
  amb = await carregarFuncao('acesso-aluno')
  turma = semearTurma(amb.banco)
})

afterEach(() => vi.unstubAllGlobals())

const entrar = (extra: Record<string, unknown> = {}, opcoes = {}) =>
  amb.chamar({ acao: 'entrar', ...IDS, senha: SENHA, ...extra }, opcoes)

describe('acesso-aluno · entrar', () => {
  beforeEach(() => inscrever(amb.banco, turma.a1, 'aluno-interno@alunos.vitorramos.invalid'))

  it('ID, turma e senha corretos devolvem a sessão e gravam o último acesso', async () => {
    const r = await entrar()
    expect(r.status).toBe(200)
    expect(r.corpo.codigo_turma).toBe('EXCIA-CPS-2610')
    expect(Object.keys(r.corpo.sessao as object)).toEqual(['access_token', 'refresh_token'])
    expect(amb.banco.linhas('inscricao')[0].ultimo_acesso_em).toEqual(expect.any(String))
  })

  it('o e-mail interno da conta nunca aparece na resposta', async () => {
    const r = await entrar()
    // Só os dois tokens e o código da turma saem do servidor.
    expect(Object.keys(r.corpo).sort()).toEqual(['codigo_turma', 'sessao'])
    expect(JSON.stringify(Object.keys(r.corpo))).not.toContain('email')
  })

  it('normaliza espaços e minúsculas nos IDs, mas não mexe na senha', async () => {
    expect((await entrar({ matricula: '  aluno-0001 ', codigo_turma: ' excia-cps-2610' })).status).toBe(200)
    expect((await entrar({ senha: ' ' + SENHA })).status).toBe(401)
  })

  it('dá a mesma mensagem para senha errada, ID inexistente, turma errada e ID sem conta', async () => {
    const casos = [
      { senha: OUTRA },
      { senha: '' },
      { matricula: 'NAO-EXISTE' },
      { codigo_turma: 'TURMA-ERRADA' },
      { matricula: 'ALUNO-0002' }, // autorizado, mas ainda sem conta
      { codigo_turma: 'FUTURA-2701' }, // turma planejada
    ]
    for (const [i, caso] of casos.entries()) {
      const r = await entrar(caso, { ip: `198.51.100.${i}` })
      expect(r.status, JSON.stringify(caso)).toBe(401)
      expect(r.corpo.erro).toBe(CREDENCIAIS)
    }
  })

  it('aluno bloqueado com a senha certa recebe o aviso de bloqueio e a sessão é encerrada', async () => {
    turma.a1.ativo = false
    const r = await entrar()
    expect(r.status).toBe(403)
    expect(r.corpo.erro).toBe(BLOQUEADA)
    expect(r.corpo.sessao).toBeUndefined()
    expect(amb.banco.sessoesEncerradas).toHaveLength(1)
  })

  it('aluno bloqueado com a senha errada não fica sabendo que a conta existe', async () => {
    turma.a1.ativo = false
    const r = await entrar({ senha: OUTRA })
    expect(r.status).toBe(401)
    expect(r.corpo.erro).toBe(CREDENCIAIS)
  })

  it('não trava por número de tentativas: depois de errar várias vezes, a senha certa entra', async () => {
    for (let i = 0; i < 12; i++) expect((await entrar({ senha: OUTRA })).status).toBe(401)
    expect((await entrar()).status).toBe(200)
    // Nada sobre quem tentou é guardado.
    expect(amb.banco.linhas('limite_tentativa')).toHaveLength(0)
  })

  it('turma encerrada: quem já tem conta ainda entra', async () => {
    turma.turma.status = 'encerrada'
    expect((await entrar()).status).toBe(200)
  })
})

describe('acesso-aluno · cadastrar', () => {
  const cadastro = { acao: 'cadastrar', ...IDS, nome: ' Ana Souza ', senha: SENHA, aceite_termo: true }

  it('cria a conta, a inscrição e o aceite do termo, e já devolve a sessão', async () => {
    const r = await amb.chamar(cadastro)
    expect(r.status).toBe(201)
    expect(r.corpo.codigo_turma).toBe('EXCIA-CPS-2610')
    expect(r.corpo.sessao).toBeDefined()

    const [perfil] = amb.banco.linhas('perfil')
    expect(perfil).toMatchObject({ nome: 'Ana Souza', papel: 'aluno' })
    expect(String(perfil.email)).toBe(`aluno-${turma.a1.id}@alunos.vitorramos.invalid`)
    expect(amb.banco.linhas('inscricao')[0]).toMatchObject({
      aluno_autorizado_id: turma.a1.id,
      turma_id: turma.turma.id,
      perfil_id: perfil.id,
    })
    expect(amb.banco.linhas('consentimento').map((c) => [c.finalidade, c.concedido, c.origem, c.versao_termo])).toEqual([
      ['uso_dados_pedagogicos', true, 'cadastro', '2026-10-v1'],
    ])
  })

  it('depois do cadastro o aluno entra com a senha que escolheu', async () => {
    await amb.chamar(cadastro)
    expect((await entrar()).status).toBe(200)
    expect((await entrar({ senha: OUTRA })).status).toBe(401)
  })

  it('a senha não é gravada em nenhuma tabela', async () => {
    await amb.chamar(cadastro)
    expect(JSON.stringify(amb.banco.tabelas)).not.toContain(SENHA)
  })

  it('só cria conta para ID autorizado, desbloqueado e de turma ativa', async () => {
    const casos = [
      { matricula: 'NAO-EXISTE' },
      { codigo_turma: 'TURMA-ERRADA' },
      { matricula: 'ALUNO-0009' }, // ID bloqueado
      { codigo_turma: 'FUTURA-2701' }, // turma planejada
    ]
    for (const [i, caso] of casos.entries()) {
      const r = await amb.chamar({ ...cadastro, ...caso }, { ip: `198.51.100.${i}` })
      expect(r.status, JSON.stringify(caso)).toBe(404)
      expect(r.corpo.erro).toBe(NAO_ENCONTRADO)
    }
    turma.turma.status = 'encerrada'
    expect((await amb.chamar(cadastro, { ip: '198.51.100.50' })).status).toBe(404)
    expect(amb.banco.linhas('perfil')).toHaveLength(0)
  })

  it('não cria uma segunda conta para o mesmo ID', async () => {
    await amb.chamar(cadastro)
    const r = await amb.chamar({ ...cadastro, nome: 'Outra Pessoa', senha: OUTRA })
    expect(r.status).toBe(409)
    expect(r.corpo.codigo).toBe('ja_existe')
    expect(amb.banco.linhas('perfil')).toHaveLength(1)
    // A senha da conta original não mudou.
    expect((await entrar()).status).toBe(200)
  })

  it('valida nome, senha e aceite do termo antes de criar qualquer coisa', async () => {
    expect((await amb.chamar({ ...cadastro, nome: ' A ' })).corpo.codigo).toBe('validacao')
    expect((await amb.chamar({ ...cadastro, senha: 'curta1' })).corpo.codigo).toBe('senha')
    expect((await amb.chamar({ ...cadastro, senha: SO_LETRAS })).corpo.codigo).toBe('senha')
    expect((await amb.chamar({ ...cadastro, senha: SO_NUMEROS })).corpo.codigo).toBe('senha')
    expect((await amb.chamar({ ...cadastro, senha: 'A1' + 'x'.repeat(80) })).corpo.codigo).toBe('senha')
    expect((await amb.chamar({ ...cadastro, aceite_termo: false })).corpo.codigo).toBe('termo')
    expect((await amb.chamar({ ...cadastro, aceite_termo: 'sim' })).corpo.codigo).toBe('termo')
    expect(amb.banco.linhas('perfil')).toHaveLength(0)
    expect(amb.banco.senhas.size).toBe(0)
  })

  it('se o Auth recusar o usuário, nada fica pela metade', async () => {
    amb.banco.falharCriacaoDeUsuario = true
    const r = await amb.chamar(cadastro)
    expect(r.status).toBe(409)
    expect(amb.banco.linhas('perfil')).toHaveLength(0)
    expect(amb.banco.linhas('inscricao')).toHaveLength(0)
  })

  it('usa a versão do termo configurada no ambiente', async () => {
    amb = await carregarFuncao('acesso-aluno', { VERSAO_TERMO: '2027-01-v2' })
    semearTurma(amb.banco)
    await amb.chamar(cadastro)
    expect(amb.banco.linhas('consentimento')[0].versao_termo).toBe('2027-01-v2')
  })
})

describe('acesso-aluno · entrada inválida', () => {
  it('responde ao preflight, recusa outros métodos, ação desconhecida e corpo que não é JSON', async () => {
    expect((await amb.chamar(null, { metodo: 'OPTIONS' })).status).toBe(200)
    expect((await amb.chamar(null, { metodo: 'GET' })).status).toBe(405)
    expect((await amb.chamar({ acao: 'verificar', ...IDS })).status).toBe(400)
    expect((await amb.chamar('texto solto')).status).toBe(400)
    expect((await amb.chamar([1, 2, 3])).status).toBe(400)
  })
})
