import type { Page, Request, Route } from '@playwright/test'

/**
 * Simula a API do Supabase na rede para os testes de ponta a ponta das áreas
 * com login. O app roda de verdade (build de produção + `src/dados`); só as
 * respostas HTTP e o WebSocket do Realtime são fabricados aqui.
 *
 * Limite honesto: as respostas imitam o formato do PostgREST, mas são escritas
 * à mão. RLS, SQL e Edge Functions são verificados em `supabase/tests`.
 */
export const URL_SUPABASE = 'http://localhost:54399'
export const CHAVE_PUBLICA = 'chave-publica-de-teste'

// Valores de mentira, usados só dentro da simulação (não existem em nenhum servidor).
export const SENHA_DE_TESTE = 'senha-correta-de-teste'
const RENOVACAO_DE_TESTE = 'renovacao'

export type Usuario = { id: string; email: string; papel: 'aluno' | 'admin'; nome: string }

export const ANA: Usuario = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@empresa.com', papel: 'aluno', nome: 'Ana Souza' }
export const PROFESSOR: Usuario = { id: '99999999-9999-4999-8999-999999999999', email: 'professor@exemplo.com', papel: 'admin', nome: 'Vitor Ramos' }

function base64url(valor: unknown): string {
  return Buffer.from(JSON.stringify(valor)).toString('base64url')
}

/** Sessão com um JWT de mentira, mas decodificável e válido por 1 hora. */
export function sessaoDe(usuario: Usuario) {
  const expira = Math.floor(Date.now() / 1000) + 3600
  const jwt = [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({ sub: usuario.id, email: usuario.email, role: 'authenticated', exp: expira }),
    'assinatura',
  ].join('.')
  return {
    access_token: jwt,
    refresh_token: RENOVACAO_DE_TESTE,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expira,
    user: {
      id: usuario.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: usuario.email,
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-10-01T12:00:00Z',
    },
  }
}

export type Chamada = { metodo: string; caminho: string; busca: URLSearchParams; corpo: unknown }

type Linhas = Record<string, unknown>[]
type Resposta = Linhas | { status: number; corpo: unknown } | Record<string, unknown> | null

export type Respostas = {
  /** GET/HEAD em /rest/v1/<tabela>: devolve as linhas (a contagem do HEAD sai do tamanho). */
  tabelas?: Record<string, (chamada: Chamada) => Linhas>
  /** POST em /rest/v1/rpc/<nome>. */
  rpc?: Record<string, (chamada: Chamada) => Resposta>
  /** POST em /functions/v1/<nome>. */
  funcoes?: Record<string, (chamada: Chamada) => Resposta>
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD,OPTIONS',
  'access-control-expose-headers': 'content-range',
}

function corpoDe(request: Request): unknown {
  try {
    return request.postDataJSON()
  } catch {
    return request.postData()
  }
}

function responder(route: Route, status: number, corpo: unknown, extras: Record<string, string> = {}) {
  return route.fulfill({
    status,
    headers: { ...CORS, 'content-type': 'application/json', ...extras },
    body: corpo === undefined ? '' : JSON.stringify(corpo),
  })
}

export type Simulacao = {
  /** Tudo o que o app enviou (exceto preflight), na ordem. */
  chamadas: Chamada[]
  /** Requisições para as quais o teste não definiu resposta. Deve ficar vazio. */
  naoTratadas: string[]
  /** Escritas (POST/PATCH/DELETE) numa tabela ou chamadas de uma rpc/função. */
  enviadas: (trecho: string) => Chamada[]
  /** Passa a responder como este usuário (o que o Auth faz depois de um login). */
  entrarComo: (usuario: Usuario) => void
  /** Empurra um evento do Realtime para os canais abertos. */
  emitirMudanca: (tabela: string) => void
  canaisAbertos: () => number
}

/**
 * Liga a simulação na página. Com `usuario`, a sessão já começa instalada no
 * navegador (como depois de um login).
 */
export async function simularSupabase(page: Page, respostas: Respostas, usuario?: Usuario): Promise<Simulacao> {
  const chamadas: Chamada[] = []
  const naoTratadas: string[] = []
  const sockets: { enviar: (topico: string, evento: string, payload: unknown, ref?: string | null, joinRef?: string | null) => void; topicos: Map<string, number[]> }[] = []
  let atual = usuario

  if (usuario) {
    // Instala a sessão uma vez por aba: se o app fizer logout, ela não volta
    // sozinha na navegação seguinte.
    await page.addInitScript((sessao) => {
      if (window.sessionStorage.getItem('sessao-de-teste-instalada')) return
      window.sessionStorage.setItem('sessao-de-teste-instalada', '1')
      window.localStorage.setItem('sb-localhost-auth-token', JSON.stringify(sessao))
    }, sessaoDe(usuario))
  }

  await page.route(`${URL_SUPABASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const metodo = request.method()
    if (metodo === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })

    const chamada: Chamada = { metodo, caminho: url.pathname, busca: url.searchParams, corpo: corpoDe(request) }
    chamadas.push(chamada)
    const [, area, , ...resto] = url.pathname.split('/')

    if (area === 'auth') {
      if (resto[0] === 'user') {
        return atual
          ? responder(route, 200, sessaoDe(atual).user)
          : responder(route, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' })
      }
      if (resto[0] === 'logout') return responder(route, 204, undefined)
      if (resto[0] === 'token') {
        const corpo = chamada.corpo as { email?: string; password?: string }
        const candidato = [ANA, PROFESSOR].find((u) => u.email === corpo?.email)
        // Senha de teste fixa: qualquer outra é recusada, como no Auth real.
        if (candidato && corpo.password === SENHA_DE_TESTE) return responder(route, 200, sessaoDe(candidato))
        return responder(route, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
      }
    }

    if (area === 'rest' && resto[0] === 'rpc') {
      const tratador = respostas.rpc?.[resto[1]]
      if (tratador) {
        const r = tratador(chamada)
        if (r && typeof r === 'object' && 'status' in r && 'corpo' in r) {
          return responder(route, (r as { status: number }).status, (r as { corpo: unknown }).corpo)
        }
        return responder(route, 200, r)
      }
    } else if (area === 'rest') {
      const tabela = resto[0]
      if (metodo === 'GET' || metodo === 'HEAD') {
        const tratador = respostas.tabelas?.[tabela]
        if (tratador) {
          const linhas = tratador(chamada)
          const faixa = { 'content-range': linhas.length ? `0-${linhas.length - 1}/${linhas.length}` : `*/0` }
          if (metodo === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, ...faixa } })
          // `.single()` pede um objeto; `.maybeSingle()` e listas pedem array.
          const querObjeto = (request.headers().accept ?? '').includes('vnd.pgrst.object')
          if (querObjeto && linhas.length === 0) {
            return responder(route, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })
          }
          return responder(route, 200, querObjeto ? linhas[0] : linhas, faixa)
        }
      } else {
        // Escritas: aceitas e registradas; o teste confere o que foi enviado.
        return responder(route, metodo === 'POST' ? 201 : 204, metodo === 'POST' ? [] : undefined)
      }
    }

    if (area === 'functions') {
      const tratador = respostas.funcoes?.[resto[0]]
      if (tratador) {
        const r = tratador(chamada)
        if (r && typeof r === 'object' && 'status' in r && 'corpo' in r) {
          return responder(route, (r as { status: number }).status, (r as { corpo: unknown }).corpo)
        }
        return responder(route, 200, r)
      }
    }

    naoTratadas.push(`${metodo} ${url.pathname}${url.search}`)
    return responder(route, 404, { message: 'sem resposta definida no teste' })
  })

  // Realtime: protocolo Phoenix (vsn 2.0.0), em que cada mensagem é a lista
  // [join_ref, ref, topic, event, payload]. Aceita a entrada no canal e o heartbeat.
  await page.routeWebSocket(new RegExp('localhost:54399/realtime'), (ws) => {
    const topicos = new Map<string, number[]>()
    const enviar = (topico: string, evento: string, payload: unknown, ref: string | null = null, joinRef: string | null = null) =>
      ws.send(JSON.stringify([joinRef, ref, topico, evento, payload]))
    sockets.push({ enviar, topicos })

    ws.onMessage((bruta) => {
      const [joinRef, ref, topico, evento, payload] = JSON.parse(String(bruta)) as [string | null, string | null, string, string, Record<string, unknown>]
      if (evento === 'phx_join') {
        const config = (payload.config ?? {}) as { postgres_changes?: Record<string, unknown>[] }
        // O cliente confere se o servidor devolveu os mesmos filtros que ele pediu.
        const mudancas = (config.postgres_changes ?? []).map((b, i) => ({ ...b, id: i + 1 }))
        topicos.set(topico, mudancas.map((b) => b.id))
        enviar(topico, 'phx_reply', { status: 'ok', response: { postgres_changes: mudancas } }, ref, joinRef)
        enviar(topico, 'system', { status: 'ok', message: 'Subscribed to PostgreSQL', channel: topico, extension: 'postgres_changes' })
      } else {
        // heartbeat, access_token, phx_leave…
        enviar(topico, 'phx_reply', { status: 'ok', response: {} }, ref, joinRef)
      }
    })
  })

  return {
    chamadas,
    naoTratadas,
    enviadas: (trecho) => chamadas.filter((c) => c.metodo !== 'GET' && c.metodo !== 'HEAD' && c.caminho.includes(trecho)),
    canaisAbertos: () => sockets.reduce((total, s) => total + s.topicos.size, 0),
    entrarComo: (novo) => {
      atual = novo
    },
    emitirMudanca: (tabela) => {
      for (const socket of sockets) {
        for (const [topico, ids] of socket.topicos) {
          socket.enviar(topico, 'postgres_changes', {
            ids,
            data: { type: 'INSERT', schema: 'public', table: tabela, commit_timestamp: new Date().toISOString(), columns: [], record: {}, errors: null },
          })
        }
      }
    },
  }
}
