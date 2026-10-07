import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { carregarFuncao } from './ambiente'

const valido = {
  nome: ' Ana Souza ',
  email: ' Ana@Empresa.com ',
  assunto: 'treinamento',
  assunto_outro: '',
  mensagem: 'Gostaria de um treinamento de Excel para a equipe.',
  aceitou_privacidade: true,
}

let amb: Awaited<ReturnType<typeof carregarFuncao>>

beforeEach(async () => {
  amb = await carregarFuncao('contato')
})

afterEach(() => vi.unstubAllGlobals())

describe('contato', () => {
  it('grava a mensagem com os campos limpos', async () => {
    const r = await amb.chamar(valido)
    expect(r.status).toBe(201)
    expect(amb.banco.linhas('contato_mensagem')).toHaveLength(1)
    expect(amb.banco.linhas('contato_mensagem')[0]).toMatchObject({
      nome: 'Ana Souza',
      email: 'ana@empresa.com',
      assunto: 'treinamento',
      assunto_outro: null,
      mensagem: 'Gostaria de um treinamento de Excel para a equipe.',
    })
  })

  it('o cliente não consegue marcar a mensagem como lida nem escolher o id', async () => {
    await amb.chamar({ ...valido, lida: true, id: 'escolhido-pelo-cliente' })
    const [mensagem] = amb.banco.linhas('contato_mensagem')
    expect(mensagem.lida).toBeUndefined()
    expect(mensagem.id).not.toBe('escolhido-pelo-cliente')
  })

  it('exige o texto livre quando o assunto é "outro"', async () => {
    expect((await amb.chamar({ ...valido, assunto: 'outro' })).status).toBe(422)
    const r = await amb.chamar({ ...valido, assunto: 'outro', assunto_outro: 'Mentoria' })
    expect(r.status).toBe(201)
    expect(amb.banco.linhas('contato_mensagem')[0].assunto_outro).toBe('Mentoria')
  })

  it.each([
    ['nome vazio', { nome: '   ' }],
    ['e-mail mal formado', { email: 'ana@empresa' }],
    ['assunto fora da lista', { assunto: 'spam' }],
    ['mensagem curta', { mensagem: 'curta' }],
    ['mensagem longa demais', { mensagem: 'a'.repeat(2001) }],
    ['sem aceite da política', { aceitou_privacidade: false }],
    ['aceite que não é booleano', { aceitou_privacidade: 'true' }],
  ])('recusa %s e não grava nada', async (_caso, mudanca) => {
    const r = await amb.chamar({ ...valido, ...mudanca })
    expect(r.status).toBe(422)
    expect(r.corpo.codigo).toBe('validacao')
    expect(amb.banco.linhas('contato_mensagem')).toHaveLength(0)
    // Envio inválido não gasta o limite do IP.
    expect(amb.banco.linhas('limite_tentativa')).toHaveLength(0)
  })

  it('limita a 3 envios por IP por hora', async () => {
    for (let i = 0; i < 3; i++) expect((await amb.chamar(valido)).status).toBe(201)
    const quarto = await amb.chamar(valido)
    expect(quarto.status).toBe(429)
    expect(quarto.corpo.codigo).toBe('limite')
    expect(amb.banco.linhas('contato_mensagem')).toHaveLength(3)
    // Outro IP não é afetado.
    expect((await amb.chamar(valido, { ip: '198.51.100.20' })).status).toBe(201)
  })

  it('libera de novo quando as tentativas saem da janela de uma hora', async () => {
    for (let i = 0; i < 3; i++) await amb.chamar(valido)
    const duasHorasAtras = new Date(Date.now() - 2 * 3_600_000).toISOString()
    amb.banco.linhas('limite_tentativa').forEach((t) => (t.created_at = duasHorasAtras))
    expect((await amb.chamar(valido)).status).toBe(201)
  })

  it('responde ao preflight com os cabeçalhos de CORS e recusa GET', async () => {
    const preflight = await amb.chamar(null, { metodo: 'OPTIONS' })
    expect(preflight.status).toBe(200)
    expect(preflight.cabecalhos.get('access-control-allow-methods')).toContain('POST')
    expect((await amb.chamar(null, { metodo: 'GET' })).status).toBe(405)
  })

  it('com lista de origens configurada, só devolve uma origem permitida', async () => {
    amb = await carregarFuncao('contato', { ORIGENS_PERMITIDAS: 'https://vitorramos.com' })
    const r = await amb.chamar(valido)
    // O teste chama de http://localhost:5173, que não está na lista.
    expect(r.cabecalhos.get('access-control-allow-origin')).toBe('https://vitorramos.com')
  })
})
