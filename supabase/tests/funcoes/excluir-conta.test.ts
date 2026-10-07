import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { carregarFuncao, inscrever, semearTurma } from './ambiente'

let amb: Awaited<ReturnType<typeof carregarFuncao>>

beforeEach(async () => {
  amb = await carregarFuncao('excluir-conta')
})

afterEach(() => vi.unstubAllGlobals())

describe('excluir-conta', () => {
  it('sem sessão válida, recusa e não apaga nada', async () => {
    const r = await amb.chamar({})
    expect(r.status).toBe(401)
    expect(amb.banco.usuariosExcluidos).toEqual([])
  })

  it('a conta do professor não é excluída por esta função', async () => {
    amb.banco.inserir('perfil', { id: 'admin-1', papel: 'admin', nome: 'Vitor Ramos', email: 'prof@exemplo.com' })
    amb.banco.usuarioLogado = { id: 'admin-1' }
    const r = await amb.chamar({}, { autorizacao: 'Bearer token' })
    expect(r.status).toBe(403)
    expect(amb.banco.usuariosExcluidos).toEqual([])
    expect(amb.banco.linhas('perfil')).toHaveLength(1)
  })

  it('apaga as perguntas do aluno, inclusive as anônimas, e depois a conta', async () => {
    const turma = semearTurma(amb.banco)
    const deAna = inscrever(amb.banco, turma.a1, 'ana@empresa.com')
    const deBruno = inscrever(amb.banco, turma.a2, 'bruno@empresa.com', 'Bruno Lima')

    const p1 = amb.banco.inserir('pergunta', { texto: 'Pergunta da Ana', anonima: false })
    const p2 = amb.banco.inserir('pergunta', { texto: 'Pergunta anônima da Ana', anonima: true })
    const p3 = amb.banco.inserir('pergunta', { texto: 'Pergunta do Bruno', anonima: false })
    amb.banco.inserir('pergunta_autoria', { pergunta_id: p1.id, inscricao_id: deAna.id })
    amb.banco.inserir('pergunta_autoria', { pergunta_id: p2.id, inscricao_id: deAna.id })
    amb.banco.inserir('pergunta_autoria', { pergunta_id: p3.id, inscricao_id: deBruno.id })

    const idDaAna = amb.banco.idDoUsuario('ana@empresa.com')
    amb.banco.usuarioLogado = { id: idDaAna }

    const r = await amb.chamar({}, { autorizacao: 'Bearer token' })
    expect(r.status).toBe(200)
    expect(amb.banco.linhas('pergunta').map((p) => p.texto)).toEqual(['Pergunta do Bruno'])
    expect(amb.banco.usuariosExcluidos).toEqual([idDaAna])
    // O colega continua com perfil e inscrição.
    expect(amb.banco.linhas('perfil').map((p) => p.email)).toEqual(['bruno@empresa.com'])
    expect(amb.banco.linhas('inscricao')).toHaveLength(1)
  })

  it('aluno sem nenhuma pergunta também é excluído', async () => {
    const turma = semearTurma(amb.banco)
    inscrever(amb.banco, turma.a1, 'ana@empresa.com')
    amb.banco.usuarioLogado = { id: amb.banco.idDoUsuario('ana@empresa.com') }
    expect((await amb.chamar({}, { autorizacao: 'Bearer token' })).status).toBe(200)
    expect(amb.banco.usuariosExcluidos).toHaveLength(1)
  })

  it('só aceita POST', async () => {
    expect((await amb.chamar(null, { metodo: 'GET' })).status).toBe(405)
    expect((await amb.chamar(null, { metodo: 'OPTIONS' })).status).toBe(200)
  })
})
