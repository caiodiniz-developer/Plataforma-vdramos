/**
 * Supabase em memória para testar as Edge Functions sem Deno nem rede.
 * Implementa só o que as funções usam do SDK: consultas simples, insert,
 * upsert, update, delete, a função `dentro_do_limite` e o Auth (OTP e admin).
 *
 * O que NÃO é verificado aqui: RLS e SQL de verdade (isso está em
 * `supabase/tests/*.test.ts`, com PGlite) e o envio real de e-mail.
 */
type Linha = Record<string, unknown>
type Resposta<T> = { data: T; error: { message: string; code?: string } | null }

/** Colunas únicas que as funções dependem para não duplicar registros. */
const UNICOS: Record<string, string[]> = {
  inscricao: ['aluno_autorizado_id'],
  perfil: ['id'],
  atividade_email: ['atividade_id', 'inscricao_id'],
}

export class BancoFalso {
  tabelas: Record<string, Linha[]> = {}
  /** Senha de cada conta, por e-mail (o Auth real guarda só o hash). */
  senhas = new Map<string, string>()
  sessoesEncerradas: string[] = []
  usuariosExcluidos: string[] = []
  /** Usuário devolvido pelo Auth para um e-mail (id estável por e-mail). */
  usuarios = new Map<string, string>()
  /** Usuário do JWT de quem chama (para `auth.getUser`). */
  usuarioLogado: { id: string } | null = null
  /** Arquivos do Storage, por caminho. */
  arquivos = new Map<string, Uint8Array>()
  /** Simula falha do Auth ao criar usuário. */
  falharCriacaoDeUsuario = false
  private sequencia = 0

  linhas(tabela: string): Linha[] {
    return (this.tabelas[tabela] ??= [])
  }

  inserir(tabela: string, linha: Linha): Linha {
    const completa = { id: `${tabela}-${++this.sequencia}`, created_at: new Date().toISOString(), ...linha }
    this.linhas(tabela).push(completa)
    return completa
  }

  idDoUsuario(email: string): string {
    if (!this.usuarios.has(email)) this.usuarios.set(email, `user-${this.usuarios.size + 1}`)
    return this.usuarios.get(email)!
  }
}

class Consulta implements PromiseLike<Resposta<unknown>> {
  private filtros: ((linha: Linha) => boolean)[] = []
  private acao: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
  private carga: Linha | Linha[] = {}
  private opcoes: { onConflict?: string; ignoreDuplicates?: boolean } = {}
  private unico: 'nao' | 'talvez' | 'sim' = 'nao'
  private colunas = '*'

  constructor(
    private banco: BancoFalso,
    private tabela: string,
  ) {}

  select(colunas = '*') {
    this.colunas = colunas
    return this
  }
  insert(carga: Linha | Linha[]) {
    this.acao = 'insert'
    this.carga = carga
    return this
  }
  upsert(carga: Linha | Linha[], opcoes: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.acao = 'upsert'
    this.carga = carga
    this.opcoes = opcoes
    return this
  }
  update(carga: Linha) {
    this.acao = 'update'
    this.carga = carga
    return this
  }
  delete() {
    this.acao = 'delete'
    return this
  }
  eq(coluna: string, valor: unknown) {
    this.filtros.push((l) => l[coluna] === valor)
    return this
  }
  in(coluna: string, valores: unknown[]) {
    this.filtros.push((l) => valores.includes(l[coluna]))
    return this
  }
  gt(coluna: string, valor: string) {
    this.filtros.push((l) => String(l[coluna]) > valor)
    return this
  }
  maybeSingle() {
    this.unico = 'talvez'
    return this
  }
  single() {
    this.unico = 'sim'
    return this
  }

  private casa = (linha: Linha) => this.filtros.every((f) => f(linha))

  /** Relação embutida usada pela função: `perfil:perfil_id (email)`. */
  private comEmbutidos(linha: Linha): Linha {
    if (!this.colunas.includes('perfil:perfil_id')) return linha
    const perfil = this.banco.linhas('perfil').find((p) => p.id === linha.perfil_id)
    return { ...linha, perfil: perfil ? { email: perfil.email } : null }
  }

  private executar(): Resposta<unknown> {
    const linhas = this.banco.linhas(this.tabela)
    let afetadas: Linha[] = []

    if (this.acao === 'select') {
      afetadas = linhas.filter(this.casa).map((l) => this.comEmbutidos(l))
    } else if (this.acao === 'insert' || this.acao === 'upsert') {
      const chaves = this.opcoes.onConflict?.split(',') ?? UNICOS[this.tabela] ?? []
      for (const nova of Array.isArray(this.carga) ? this.carga : [this.carga]) {
        const existente =
          chaves.length > 0 ? linhas.find((l) => chaves.every((c) => l[c] === nova[c])) : undefined
        if (existente && this.acao === 'insert') {
          return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } }
        }
        if (existente) {
          if (!this.opcoes.ignoreDuplicates) Object.assign(existente, nova)
          afetadas.push(existente)
        } else {
          afetadas.push(this.banco.inserir(this.tabela, nova))
        }
      }
    } else if (this.acao === 'update') {
      afetadas = linhas.filter(this.casa)
      afetadas.forEach((l) => Object.assign(l, this.carga))
    } else {
      afetadas = linhas.filter(this.casa)
      this.banco.tabelas[this.tabela] = linhas.filter((l) => !this.casa(l))
    }

    if (this.unico === 'nao') return { data: afetadas, error: null }
    if (afetadas.length === 0 && this.unico === 'sim') {
      return { data: null, error: { message: 'nenhuma linha', code: 'PGRST116' } }
    }
    return { data: afetadas[0] ?? null, error: null }
  }

  then<A = Resposta<unknown>, B = never>(
    ok?: ((valor: Resposta<unknown>) => A | PromiseLike<A>) | null,
    falha?: ((motivo: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.executar()).then(ok, falha)
  }
}

export function criarClienteFalso(banco: BancoFalso) {
  return {
    from: (tabela: string) => new Consulta(banco, tabela),

    storage: {
      from: () => ({
        async createSignedUrl(caminho: string) {
          return { data: { signedUrl: `https://arquivos.teste/${caminho}?assinatura=teste` }, error: null }
        },
        async download(caminho: string) {
          const bytes = banco.arquivos.get(caminho)
          return bytes ? { data: new Blob([bytes as BlobPart]), error: null } : { data: null, error: { message: 'não encontrado' } }
        },
      }),
    },

    async rpc(nome: string, args: Record<string, unknown>) {
      if (nome !== 'dentro_do_limite') return { data: null, error: { message: `rpc desconhecida: ${nome}` } }
      const janelaMs = String(args.p_janela).includes('hour') ? 3_600_000 : 15 * 60_000
      const recentes = banco
        .linhas('limite_tentativa')
        .filter(
          (l) =>
            l.acao === args.p_acao &&
            l.ip_hash === args.p_ip_hash &&
            Date.now() - new Date(String(l.created_at)).getTime() < janelaMs,
        )
      if (recentes.length >= Number(args.p_maximo)) return { data: false, error: null }
      if (args.p_registrar !== false) {
        banco.inserir('limite_tentativa', { acao: args.p_acao, ip_hash: args.p_ip_hash })
      }
      return { data: true, error: null }
    },

    auth: {
      async signInWithPassword(params: { email: string; password: string }) {
        if (!banco.senhas.has(params.email) || banco.senhas.get(params.email) !== params.password) {
          return { data: { session: null, user: null }, error: { message: 'Invalid login credentials' } }
        }
        return {
          data: {
            user: { id: banco.idDoUsuario(params.email), email: params.email },
            session: { access_token: `acesso-de-${params.email}`, refresh_token: `renovacao-de-${params.email}` },
          },
          error: null,
        }
      },
      async getUser() {
        return banco.usuarioLogado
          ? { data: { user: banco.usuarioLogado }, error: null }
          : { data: { user: null }, error: { message: 'sem sessão' } }
      },
      admin: {
        async createUser(params: { email: string; password: string }) {
          if (banco.falharCriacaoDeUsuario || banco.senhas.has(params.email)) {
            return { data: { user: null }, error: { message: 'A user with this email address has already been registered' } }
          }
          banco.senhas.set(params.email, params.password)
          return { data: { user: { id: banco.idDoUsuario(params.email), email: params.email } }, error: null }
        },
        async updateUserById(id: string, attrs: { password?: string }) {
          const email = [...banco.usuarios.entries()].find(([, uid]) => uid === id)?.[0]
          if (!email) return { data: null, error: { message: 'User not found' } }
          if (attrs.password) banco.senhas.set(email, attrs.password)
          return { data: {}, error: null }
        },
        async signOut(token: string) {
          banco.sessoesEncerradas.push(token)
          return { data: null, error: null }
        },
        async deleteUser(id: string) {
          const email = [...banco.usuarios.entries()].find(([, uid]) => uid === id)?.[0]
          if (email) banco.senhas.delete(email)
          banco.usuariosExcluidos.push(id)
          // Cascata do banco real: apagar o usuário leva perfil e inscrições.
          banco.tabelas.perfil = banco.linhas('perfil').filter((p) => p.id !== id)
          banco.tabelas.inscricao = banco.linhas('inscricao').filter((i) => i.perfil_id !== id)
          return { data: {}, error: null }
        },
      },
    },
  }
}
