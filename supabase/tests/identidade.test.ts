import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { como, criarBanco, criarUsuario, erroDe } from './ambiente'

let db: PGlite
let admin: string
let ana: string
let bruno: string

beforeAll(async () => {
  db = await criarBanco()
  admin = await criarUsuario(db, 'professor@exemplo.com', 'admin')
  ana = await criarUsuario(db, 'ana@exemplo.com')
  bruno = await criarUsuario(db, 'bruno@exemplo.com')
})

describe('perfil (RLS)', () => {
  it('aluno lê só o próprio perfil', async () => {
    const { rows } = await como(db, { papel: 'authenticated', id: ana }, () =>
      db.query<{ email: string }>('select email from public.perfil'),
    )
    expect(rows.map((r) => r.email)).toEqual(['ana@exemplo.com'])
  })

  it('admin lê todos os perfis', async () => {
    const { rows } = await como(db, { papel: 'authenticated', id: admin }, () =>
      db.query('select id from public.perfil'),
    )
    expect(rows).toHaveLength(3)
  })

  it('visitante anônimo não lê perfis', async () => {
    const { rows } = await como(db, { papel: 'anon' }, () => db.query('select * from public.perfil'))
    expect(rows).toHaveLength(0)
  })

  it('aluno não consegue se promover a admin nem trocar o próprio e-mail', async () => {
    const promover = await erroDe(() =>
      como(db, { papel: 'authenticated', id: ana }, () =>
        db.query("update public.perfil set papel = 'admin' where id = $1", [ana]),
      ),
    )
    expect(promover).toMatch(/Somente o professor/)

    const trocar = await erroDe(() =>
      como(db, { papel: 'authenticated', id: ana }, () =>
        db.query("update public.perfil set email = 'outro@exemplo.com' where id = $1", [ana]),
      ),
    )
    expect(trocar).toMatch(/Somente o professor/)
  })

  it('aluno atualiza o próprio nome, mas não o de outro aluno', async () => {
    await como(db, { papel: 'authenticated', id: ana }, () =>
      db.query("update public.perfil set nome = 'Ana Souza' where id = $1", [ana]),
    )
    const outro = await como(db, { papel: 'authenticated', id: ana }, () =>
      db.query("update public.perfil set nome = 'Invadido' where id = $1", [bruno]),
    )
    expect(outro.affectedRows).toBe(0)

    const { rows } = await db.query<{ nome: string }>('select nome from public.perfil where id = $1', [ana])
    expect(rows[0].nome).toBe('Ana Souza')
  })
})

describe('consentimento (RLS)', () => {
  it('aluno registra o próprio consentimento pela área do aluno', async () => {
    await como(db, { papel: 'authenticated', id: ana }, () =>
      db.query(
        `insert into public.consentimento (perfil_id, finalidade, concedido, versao_termo, origem)
         values ($1, 'comunicacao_professor', true, '2026-10-v1', 'area_aluno')`,
        [ana],
      ),
    )
    const { rows } = await como(db, { papel: 'authenticated', id: ana }, () =>
      db.query('select id from public.consentimento'),
    )
    expect(rows).toHaveLength(1)
  })

  it('aluno não registra consentimento em nome de outro, nem com origem de cadastro', async () => {
    const deOutro = await erroDe(() =>
      como(db, { papel: 'authenticated', id: ana }, () =>
        db.query(
          `insert into public.consentimento (perfil_id, finalidade, concedido, versao_termo, origem)
           values ($1, 'comunicacao_professor', true, '2026-10-v1', 'area_aluno')`,
          [bruno],
        ),
      ),
    )
    expect(deOutro).toMatch(/row-level security/)

    const origemFalsa = await erroDe(() =>
      como(db, { papel: 'authenticated', id: ana }, () =>
        db.query(
          `insert into public.consentimento (perfil_id, finalidade, concedido, versao_termo, origem)
           values ($1, 'comunicacao_professor', true, '2026-10-v1', 'cadastro')`,
          [ana],
        ),
      ),
    )
    expect(origemFalsa).toMatch(/row-level security/)
  })

  it('o histórico não pode ser alterado nem apagado pelo aluno', async () => {
    const alterar = await como(db, { papel: 'authenticated', id: ana }, () =>
      db.query('update public.consentimento set concedido = false'),
    )
    const apagar = await como(db, { papel: 'authenticated', id: ana }, () =>
      db.query('delete from public.consentimento'),
    )
    expect(alterar.affectedRows).toBe(0)
    expect(apagar.affectedRows).toBe(0)
  })

  it('aluno não vê o consentimento dos colegas', async () => {
    const { rows } = await como(db, { papel: 'authenticated', id: bruno }, () =>
      db.query('select id from public.consentimento'),
    )
    expect(rows).toHaveLength(0)
  })
})
