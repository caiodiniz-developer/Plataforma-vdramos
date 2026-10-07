import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { carregarFuncao, inscrever, semearTurma } from './ambiente'

const GENERICA = 'Não encontramos essa combinação. Confira com o professor.'
const IDS = { matricula: 'ALUNO-0001', codigo_turma: 'EXCIA-CPS-2610' }

type Ambiente = Awaited<ReturnType<typeof carregarFuncao>>
let amb: Ambiente
let turma: ReturnType<typeof semearTurma>

beforeEach(async () => {
  amb = await carregarFuncao('acesso-aluno')
  turma = semearTurma(amb.banco)
})

afterEach(() => vi.unstubAllGlobals())

describe('acesso-aluno · identificação', () => {
  it('responde ao preflight de CORS e recusa outros métodos', async () => {
    expect((await amb.chamar(null, { metodo: 'OPTIONS' })).status).toBe(200)
    expect((await amb.chamar(null, { metodo: 'GET' })).status).toBe(405)
  })

  it('dá a mesma mensagem genérica para qualquer motivo de falha', async () => {
    const casos = [
      { matricula: 'NAO-EXISTE', codigo_turma: 'EXCIA-CPS-2610' }, // matrícula errada
      { matricula: 'ALUNO-0001', codigo_turma: 'TURMA-ERRADA' }, // turma errada
      { matricula: 'ALUNO-0009', codigo_turma: 'EXCIA-CPS-2610' }, // ID inativo
      { matricula: 'ALUNO-0001', codigo_turma: 'FUTURA-2701' }, // turma ainda planejada
      { matricula: '', codigo_turma: '' }, // vazio
    ]
    for (const [i, ids] of casos.entries()) {
      const r = await amb.chamar({ acao: 'verificar', ...ids }, { ip: `198.51.100.${i}` })
      expect(r.status, JSON.stringify(ids)).toBe(404)
      expect(r.corpo.erro).toBe(GENERICA)
    }
  })

  it('normaliza espaços e minúsculas nos dois IDs', async () => {
    const r = await amb.chamar({ acao: 'verificar', matricula: '  aluno-0001 ', codigo_turma: ' excia-cps-2610' })
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual({ etapa: 'cadastro' })
  })

  it('bloqueia o IP depois de 5 tentativas inválidas, mesmo com IDs corretos', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await amb.chamar({ acao: 'verificar', matricula: 'X', codigo_turma: 'Y' })).status).toBe(404)
    }
    const bloqueado = await amb.chamar({ acao: 'verificar', ...IDS })
    expect(bloqueado.status).toBe(429)
    expect(bloqueado.corpo.codigo).toBe('bloqueado')
    // Outro IP continua entrando normalmente.
    expect((await amb.chamar({ acao: 'verificar', ...IDS }, { ip: '198.51.100.99' })).status).toBe(200)
  })

  it('tentativas válidas não contam para o bloqueio', async () => {
    for (let i = 0; i < 8; i++) {
      expect((await amb.chamar({ acao: 'verificar', ...IDS })).status).toBe(200)
    }
    expect(amb.banco.linhas('limite_tentativa')).toHaveLength(0)
  })

  it('guarda só o hash do IP, nunca o IP', async () => {
    await amb.chamar({ acao: 'verificar', matricula: 'X', codigo_turma: 'Y' }, { ip: '203.0.113.50' })
    const [tentativa] = amb.banco.linhas('limite_tentativa')
    expect(String(tentativa.ip_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(amb.banco.tabelas)).not.toContain('203.0.113.50')
  })
})

describe('acesso-aluno · login recorrente (F4)', () => {
  beforeEach(() => inscrever(amb.banco, turma.a1, 'ana@empresa.com'))

  it('envia o código ao e-mail cadastrado e devolve só o e-mail mascarado', async () => {
    const r = await amb.chamar({ acao: 'verificar', ...IDS })
    expect(r.corpo).toEqual({ etapa: 'codigo', email_mascarado: 'a•••@empresa.com' })
    expect(r.texto).not.toContain('ana@empresa.com')
    expect(amb.banco.otpsEnviados).toEqual([{ email: 'ana@empresa.com', criarUsuario: false, nome: undefined }])
  })

  it('código certo devolve a sessão e grava o último acesso', async () => {
    const email = 'ana@empresa.com'
    await amb.chamar({ acao: 'verificar', ...IDS })
    const r = await amb.chamar({ acao: 'confirmar', ...IDS, codigo: '123456' })
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual({
      // Valores de mentira devolvidos pelo Auth falso para este e-mail.
      sessao: { access_token: `acesso-de-${email}`, refresh_token: `renovacao-de-${email}` },
      codigo_turma: 'EXCIA-CPS-2610',
    })
    expect(amb.banco.linhas('inscricao')[0].ultimo_acesso_em).toEqual(expect.any(String))
  })

  it('código errado é recusado e conta como tentativa', async () => {
    const r = await amb.chamar({ acao: 'confirmar', ...IDS, codigo: '000000' })
    expect(r.status).toBe(401)
    expect(r.corpo.erro).toBe('Código inválido ou expirado.')
    expect(amb.banco.linhas('limite_tentativa')).toHaveLength(1)
  })

  it('código fora do formato nem chega ao Auth', async () => {
    for (const codigo of ['12345', 'abcdef', '1234567', '']) {
      expect((await amb.chamar({ acao: 'confirmar', ...IDS, codigo })).status).toBe(422)
    }
  })

  it('ID já inscrito que tenta novo cadastro com outro e-mail segue o login recorrente', async () => {
    const r = await amb.chamar({
      acao: 'cadastrar',
      ...IDS,
      nome: 'Outra Pessoa',
      email: 'invasor@exemplo.com',
      aceite_termo: true,
    })
    expect(r.corpo).toEqual({ etapa: 'codigo', email_mascarado: 'a•••@empresa.com' })
    expect(amb.banco.otpsEnviados.map((o) => o.email)).toEqual(['ana@empresa.com'])
    expect(amb.banco.linhas('cadastro_pendente')).toHaveLength(0)
  })

  it('turma encerrada: quem já tem inscrição ainda entra; quem não tem recebe a mensagem genérica', async () => {
    turma.turma.status = 'encerrada'
    expect((await amb.chamar({ acao: 'verificar', ...IDS })).corpo.etapa).toBe('codigo')
    const semInscricao = await amb.chamar({ acao: 'verificar', matricula: 'ALUNO-0002', codigo_turma: 'EXCIA-CPS-2610' })
    expect(semInscricao.status).toBe(404)
    expect(semInscricao.corpo.erro).toBe(GENERICA)
  })

  it('avisa quando o envio do código falha', async () => {
    amb.banco.falharEnvioDeOtp = true
    const r = await amb.chamar({ acao: 'verificar', ...IDS })
    expect(r.status).toBe(502)
    expect(r.corpo.codigo).toBe('envio')
  })
})

describe('acesso-aluno · primeiro acesso (F3)', () => {
  const cadastro = { acao: 'cadastrar', ...IDS, nome: ' Ana Souza ', email: ' Ana@Empresa.com ', aceite_termo: true }

  it('sem inscrição, pede o cadastro e não envia código', async () => {
    expect((await amb.chamar({ acao: 'verificar', ...IDS })).corpo).toEqual({ etapa: 'cadastro' })
    expect(amb.banco.otpsEnviados).toHaveLength(0)
  })

  it('não conclui sem aceite do termo, nem com nome ou e-mail inválidos', async () => {
    expect((await amb.chamar({ ...cadastro, aceite_termo: false })).corpo.codigo).toBe('termo')
    expect((await amb.chamar({ ...cadastro, aceite_termo: 'sim' })).corpo.codigo).toBe('termo')
    expect((await amb.chamar({ ...cadastro, nome: '  ' })).corpo.codigo).toBe('validacao')
    expect((await amb.chamar({ ...cadastro, email: 'ana@empresa' })).corpo.codigo).toBe('validacao')
    expect(amb.banco.otpsEnviados).toHaveLength(0)
    expect(amb.banco.linhas('cadastro_pendente')).toHaveLength(0)
  })

  it('guarda o cadastro pendente e envia o código ao e-mail informado', async () => {
    const r = await amb.chamar(cadastro)
    expect(r.corpo).toEqual({ etapa: 'codigo', email_mascarado: 'a•••@empresa.com' })
    expect(amb.banco.otpsEnviados).toEqual([{ email: 'ana@empresa.com', criarUsuario: true, nome: 'Ana Souza' }])
    expect(amb.banco.linhas('cadastro_pendente')[0]).toMatchObject({
      nome: 'Ana Souza',
      email: 'ana@empresa.com',
      quer_comunicacao: false,
      versao_termo: '2026-10-v1',
    })
    // Nada de inscrição antes de o e-mail ser confirmado.
    expect(amb.banco.linhas('inscricao')).toHaveLength(0)
  })

  it('comunicação só vale true quando o aluno ligou o switch', async () => {
    await amb.chamar({ ...cadastro, quer_comunicacao: 'true' })
    expect(amb.banco.linhas('cadastro_pendente')[0].quer_comunicacao).toBe(false)
    await amb.chamar({ ...cadastro, quer_comunicacao: true })
    expect(amb.banco.linhas('cadastro_pendente')[0].quer_comunicacao).toBe(true)
    expect(amb.banco.linhas('cadastro_pendente')).toHaveLength(1)
  })

  it('com o código certo cria perfil, inscrição e os dois consentimentos, e limpa o pendente', async () => {
    await amb.chamar({ ...cadastro, quer_comunicacao: true })
    const r = await amb.chamar({ acao: 'confirmar', ...IDS, codigo: '123456' })
    expect(r.status).toBe(200)
    expect(r.corpo.codigo_turma).toBe('EXCIA-CPS-2610')

    const [perfil] = amb.banco.linhas('perfil')
    expect(perfil).toMatchObject({ nome: 'Ana Souza', email: 'ana@empresa.com', papel: 'aluno' })
    expect(amb.banco.linhas('inscricao')[0]).toMatchObject({
      aluno_autorizado_id: turma.a1.id,
      turma_id: turma.turma.id,
      perfil_id: perfil.id,
    })
    expect(
      amb.banco.linhas('consentimento').map((c) => [c.finalidade, c.concedido, c.origem, c.versao_termo]),
    ).toEqual([
      ['uso_dados_pedagogicos', true, 'cadastro', '2026-10-v1'],
      ['comunicacao_professor', true, 'cadastro', '2026-10-v1'],
    ])
    expect(amb.banco.linhas('cadastro_pendente')).toHaveLength(0)
  })

  it('e-mail já usado em outra turma reaproveita o perfil e mantém o nome', async () => {
    const id = amb.banco.idDoUsuario('ana@empresa.com')
    amb.banco.inserir('perfil', { id, nome: 'Ana Souza (nome antigo)', email: 'ana@empresa.com', papel: 'aluno' })

    await amb.chamar({ ...cadastro, nome: 'Ana S.' })
    await amb.chamar({ acao: 'confirmar', ...IDS, codigo: '123456' })

    expect(amb.banco.linhas('perfil')).toHaveLength(1)
    expect(amb.banco.linhas('perfil')[0].nome).toBe('Ana Souza (nome antigo)')
    expect(amb.banco.linhas('inscricao')[0].perfil_id).toBe(id)
  })

  it('cadastro expirado pede para começar de novo', async () => {
    await amb.chamar(cadastro)
    amb.banco.linhas('cadastro_pendente')[0].expira_em = new Date(Date.now() - 60_000).toISOString()
    const r = await amb.chamar({ acao: 'confirmar', ...IDS, codigo: '123456' })
    expect(r.status).toBe(410)
    expect(r.corpo.codigo).toBe('expirado')
    expect(amb.banco.linhas('inscricao')).toHaveLength(0)
  })

  it('confirmar duas vezes não duplica inscrição nem consentimento', async () => {
    await amb.chamar(cadastro)
    await amb.chamar({ acao: 'confirmar', ...IDS, codigo: '123456' })
    const segunda = await amb.chamar({ acao: 'confirmar', ...IDS, codigo: '123456' })
    expect(segunda.status).toBe(200)
    expect(amb.banco.linhas('inscricao')).toHaveLength(1)
    expect(amb.banco.linhas('consentimento')).toHaveLength(2)
  })

  it('usa a versão do termo configurada no ambiente', async () => {
    amb = await carregarFuncao('acesso-aluno', { VERSAO_TERMO: '2027-01-v2' })
    semearTurma(amb.banco)
    await amb.chamar(cadastro)
    expect(amb.banco.linhas('cadastro_pendente')[0].versao_termo).toBe('2027-01-v2')
  })
})

describe('acesso-aluno · entrada inválida', () => {
  it('recusa ação desconhecida e corpo que não é JSON', async () => {
    expect((await amb.chamar({ acao: 'apagar-tudo', ...IDS })).status).toBe(400)
    expect((await amb.chamar('texto solto')).status).toBe(400)
    expect((await amb.chamar([1, 2, 3])).status).toBe(400)
  })
})
