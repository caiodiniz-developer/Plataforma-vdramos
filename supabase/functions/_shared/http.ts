// Utilitários HTTP comuns às Edge Functions.

const ORIGENS_PERMITIDAS = (Deno.env.get('ORIGENS_PERMITIDAS') ?? '')
  .split(',')
  .map((origem) => origem.trim())
  .filter((origem) => origem !== '')

export function cabecalhosCors(req: Request): Record<string, string> {
  const origem = req.headers.get('origin') ?? ''
  // Sem lista configurada (desenvolvimento local), aceita qualquer origem.
  const liberada =
    ORIGENS_PERMITIDAS.length === 0 ? '*' : ORIGENS_PERMITIDAS.includes(origem) ? origem : ORIGENS_PERMITIDAS[0]
  return {
    'Access-Control-Allow-Origin': liberada,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function responder(req: Request, status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cabecalhosCors(req), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function erro(req: Request, status: number, mensagem: string, codigo?: string): Response {
  return responder(req, status, { erro: mensagem, codigo })
}

/** Lê o corpo JSON; devolve null se não for um objeto JSON válido. */
export async function lerCorpo(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const corpo = await req.json()
    return corpo !== null && typeof corpo === 'object' && !Array.isArray(corpo) ? corpo : null
  } catch {
    return null
  }
}

export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

/**
 * Hash do IP de origem. O IP nunca é gravado em claro: o limite por IP só
 * precisa comparar igualdade.
 */
export async function hashDoIp(req: Request): Promise<string> {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido'
  const sal = Deno.env.get('SAL_HASH_IP') ?? Deno.env.get('SUPABASE_URL') ?? ''
  const bytes = new TextEncoder().encode(`${sal}:${ip}`)
  const resumo = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(resumo), (b) => b.toString(16).padStart(2, '0')).join('')
}
