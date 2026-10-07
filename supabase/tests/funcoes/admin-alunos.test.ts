import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { carregarFuncao, inscrever, semearTurma, SENHA_DE_TESTE } from './ambiente'

const SENHA = SENHA_DE_TESTE
const NOVA = 'Nova' + SENHA
const AUTORIZACAO = { autorizacao: 'Bearer token' }

type Ambiente = Awaited<ReturnType<typeof carregarFuncao>>
let amb: Ambiente
let turma: ReturnType<typeof semearTurma>

beforeEach(async () => {
  amb = await carregarFuncao('admin-alunos')
  turma = semearTurma(amb.banco)
  amb.banco.inserir('perfil', { id: 'admin-1', papel: 'admin', nome: 'Vitor Ramos', email: 'prof@exemplo.com' })
  amb.banco.usuarioLogado = { id: 'admin-1' }
})

afterEach(() => vi.unstubAllGlobals())

const chamar = (corpo: Record<string, unknown>) => amb.chamar(corpo, AUTORIZACAO)

describe('admin-alunos · permissão', () => {
  it('sem sessão é recusada', async () => {
    amb.banco.usuarioLogado = null
    expect((await amb.chamar({ acao: 'criar' })).status).toBe(401)
  })

  it('aluno logado não gerencia alunos, nem a própria conta', async () => {
    const insc = inscrever(amb.banco, turma.a1, 'ana@interno.invalid')
    amb.banco.usuarioLogado = { id: String(insc.perfil_id) }
    for (const corpo of [
      { acao: 'criar', turma_id: turma.turma.id, matricula: 'NOVO-1', nome: 'Invasor' },
      { acao: 'redefinir_senha', aluno_autorizado_id: turma.a2.id, senha: NOVA },
      { acao: 'remover', aluno_autorizado_id: turma.a2.id },
    ]) {
      const r = await chamar(corpo)
      expect(r.status, corpo.acao).toBe(403)
    }
    expect(amb.banco.linhas('aluno_autorizado')).toHaveLength(4)
  })
})

describe('admin-alunos · criar', () => {
  it('sem senha, só autoriza o ID (o aluno cria a conta depois)', async () => {
    const r = await chamar({ acao: 'criar', turma_id: turma.turma.id, matricula: ' novo-10 ', nome: 'João Silva' })
    expect(r.status).toBe(201)
    expect(r.corpo.conta_criada).toBe(false)
    const novo = amb.banco.linhas('aluno_autorizado').find((a) => a.matricula === 'NOVO-10')
    expect(novo).toMatchObject({ turma_id: turma.turma.id, nome_referencia: 'João Silva' })
    expect(amb.banco.linhas('inscricao')).toHaveLength(0)
  })

  it('com senha, já cria a conta pronta para entrar, sem consentimento em nome do aluno', async () => {
    const r = await chamar({ acao: 'criar', turma_id: turma.turma.id, matricula: 'NOVO-11', nome: 'Maria Lima', senha: SENHA })
    expect(r.corpo.conta_criada).toBe(true)
    expect(amb.banco.linhas('perfil').find((p) => p.nome === 'Maria Lima')).toMatchObject({ papel: 'aluno' })
    expect(amb.banco.linhas('inscricao')).toHaveLength(1)
    // O termo é aceito pelo próprio aluno no primeiro acesso.
    expect(amb.banco.linhas('consentimento')).toHaveLength(0)
  })

  it('recusa ID repetido na turma, ID inválido, nome curto, senha fraca e turma inexistente', async () => {
    const base = { acao: 'criar', turma_id: turma.turma.id, matricula: 'NOVO-12', nome: 'Pedro Alves' }
    expect((await chamar({ ...base, matricula: 'aluno-0001' })).status).toBe(409)
    expect((await chamar({ ...base, matricula: 'com espaço' })).status).toBe(422)
    expect((await chamar({ ...base, nome: 'Pe' })).status).toBe(422)
    expect((await chamar({ ...base, senha: 'fraca1' })).corpo.codigo).toBe('senha')
    expect((await chamar({ ...base, turma_id: 'nao-existe' })).status).toBe(404)
    expect(amb.banco.linhas('aluno_autorizado')).toHaveLength(4)
  })

  it('se a conta falhar, o ID autorizado também não fica', async () => {
    amb.banco.falharCriacaoDeUsuario = true
    const r = await chamar({ acao: 'criar', turma_id: turma.turma.id, matricula: 'NOVO-13', nome: 'Lucas Reis', senha: SENHA })
    expect(r.status).toBe(500)
    expect(amb.banco.linhas('aluno_autorizado').some((a) => a.matricula === 'NOVO-13')).toBe(false)
  })
})

describe('admin-alunos · redefinir senha e remover', () => {
  it('redefine a senha de quem já tem conta', async () => {
    const email = 'ana@interno.invalid'
    inscrever(amb.banco, turma.a1, email)
    const r = await chamar({ acao: 'redefinir_senha', aluno_autorizado_id: turma.a1.id, senha: NOVA })
    expect(r.status).toBe(200)
    expect(amb.banco.senhas.get(email)).toBe(NOVA)
  })

  it('não redefine senha fraca nem de quem ainda não criou a conta', async () => {
    inscrever(amb.banco, turma.a1, 'ana@interno.invalid')
    expect((await chamar({ acao: 'redefinir_senha', aluno_autorizado_id: turma.a1.id, senha: 'fraca1' })).status).toBe(422)
    expect((await chamar({ acao: 'redefinir_senha', aluno_autorizado_id: turma.a2.id, senha: NOVA })).status).toBe(409)
    expect((await chamar({ acao: 'redefinir_senha', aluno_autorizado_id: 'nao-existe', senha: NOVA })).status).toBe(404)
  })

  it('remover apaga a conta, as perguntas do aluno e o ID autorizado', async () => {
    const deAna = inscrever(amb.banco, turma.a1, 'ana@interno.invalid')
    const deBruno = inscrever(amb.banco, turma.a2, 'bruno@interno.invalid', 'Bruno Lima')
    const p1 = amb.banco.inserir('pergunta', { texto: 'Pergunta da Ana' })
    const p2 = amb.banco.inserir('pergunta', { texto: 'Pergunta do Bruno' })
    amb.banco.inserir('pergunta_autoria', { pergunta_id: p1.id, inscricao_id: deAna.id })
    amb.banco.inserir('pergunta_autoria', { pergunta_id: p2.id, inscricao_id: deBruno.id })

    const r = await chamar({ acao: 'remover', aluno_autorizado_id: turma.a1.id })
    expect(r.status).toBe(200)
    expect(amb.banco.usuariosExcluidos).toEqual([deAna.perfil_id])
    expect(amb.banco.linhas('pergunta').map((p) => p.texto)).toEqual(['Pergunta do Bruno'])
    expect(amb.banco.linhas('aluno_autorizado').some((a) => a.id === turma.a1.id)).toBe(false)
    // O colega continua intacto.
    expect(amb.banco.linhas('perfil').some((p) => p.nome === 'Bruno Lima')).toBe(true)
  })

  it('remover um ID sem conta só tira o ID da lista', async () => {
    const r = await chamar({ acao: 'remover', aluno_autorizado_id: turma.a2.id })
    expect(r.status).toBe(200)
    expect(amb.banco.usuariosExcluidos).toEqual([])
    expect(amb.banco.linhas('aluno_autorizado').some((a) => a.id === turma.a2.id)).toBe(false)
  })

  it('aluno em duas turmas: remover de uma mantém a conta', async () => {
    const insc = inscrever(amb.banco, turma.a1, 'ana@interno.invalid')
    const outra = amb.banco.inserir('aluno_autorizado', { turma_id: turma.planejada.id, matricula: 'ALUNO-0777', ativo: true })
    amb.banco.inserir('inscricao', { aluno_autorizado_id: outra.id, turma_id: turma.planejada.id, perfil_id: insc.perfil_id })

    await chamar({ acao: 'remover', aluno_autorizado_id: turma.a1.id })
    expect(amb.banco.usuariosExcluidos).toEqual([])
    expect(amb.banco.linhas('perfil').some((p) => p.id === insc.perfil_id)).toBe(true)
  })

  it('recusa ação desconhecida', async () => {
    expect((await chamar({ acao: 'promover', aluno_autorizado_id: turma.a1.id })).status).toBe(400)
  })
})
