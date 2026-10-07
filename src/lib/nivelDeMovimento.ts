import { useSyncExternalStore } from 'react'

/**
 * Nível de movimento da interface, em três degraus:
 *
 *  - `completo`  — tudo: seção fixada, parallax, rolagem suave, cursor.
 *  - `essencial` — a página continua viva (fades, deslocamentos curtos,
 *                  réguas que se desenham, recortes curtos), sem o que pode
 *                  causar desconforto: nada fixado, sem parallax, sem zoom.
 *  - `nenhum`    — nada se move.
 *
 * O padrão vem do sistema: `prefers-reduced-motion: reduce` dá `essencial`
 * (muita gente desliga as animações do Windows só por desempenho e não espera
 * um site parado); sem esse pedido, `completo`. A escolha explícita da pessoa
 * no controle de animações vence o sistema e fica guardada no navegador.
 *
 * O nível vigente é espelhado em `<html data-movimento="…">`, de onde o CSS lê.
 */
export const NIVEIS = ['completo', 'essencial', 'nenhum'] as const
export type Nivel = (typeof NIVEIS)[number]

export const CHAVE_DA_ESCOLHA = 'vr:movimento'
const CONSULTA_REDUZ = '(prefers-reduced-motion: reduce)'

type Guarda = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function ehNivel(valor: unknown): valor is Nivel {
  return typeof valor === 'string' && (NIVEIS as readonly string[]).includes(valor)
}

/** A escolha da pessoa vence; sem escolha, vale o pedido do sistema. */
export function resolverNivel(escolha: Nivel | null, sistemaPedeReducao: boolean): Nivel {
  if (escolha) return escolha
  return sistemaPedeReducao ? 'essencial' : 'completo'
}

/** Escolha guardada, ou `null` se não há (ou se o valor guardado é inválido). */
export function lerEscolha(guarda: Guarda | undefined): Nivel | null {
  try {
    const valor = guarda?.getItem(CHAVE_DA_ESCOLHA)
    return ehNivel(valor) ? valor : null
  } catch {
    // Armazenamento bloqueado (modo privado, política do navegador): segue sem escolha.
    return null
  }
}

function gravarEscolha(guarda: Guarda | undefined, escolha: Nivel | null) {
  try {
    if (escolha) guarda?.setItem(CHAVE_DA_ESCOLHA, escolha)
    else guarda?.removeItem(CHAVE_DA_ESCOLHA)
  } catch {
    // Sem armazenamento, a escolha vale só enquanto a página estiver aberta.
  }
}

const temJanela = typeof window !== 'undefined'
const guardaDoNavegador = (): Guarda | undefined => {
  try {
    return temJanela ? window.localStorage : undefined
  } catch {
    return undefined
  }
}
const sistemaPedeReducao = () => temJanela && typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA_REDUZ).matches

let escolha: Nivel | null = null
let nivel: Nivel = 'completo'
const ouvintes = new Set<() => void>()

function atualizar() {
  const novo = resolverNivel(escolha, sistemaPedeReducao())
  if (temJanela) document.documentElement.dataset.movimento = novo
  nivel = novo
  // Avisa sempre: quem mostra "veio do sistema ou foi escolhido" também precisa saber.
  ouvintes.forEach((avisar) => avisar())
}

/**
 * Lê a escolha guardada e marca o `<html>`. É chamada no início de `main.tsx`,
 * antes do primeiro render: o atributo já existe na primeira pintura.
 */
export function iniciarNivelDeMovimento() {
  escolha = lerEscolha(guardaDoNavegador())
  atualizar()
  if (temJanela && typeof window.matchMedia === 'function') {
    window.matchMedia(CONSULTA_REDUZ).addEventListener?.('change', atualizar)
  }
}

export function nivelDeMovimento(): Nivel {
  return nivel
}

/** `true` quando o nível vigente veio de uma escolha da pessoa, não do sistema. */
export function nivelFoiEscolhido(): boolean {
  return escolha !== null
}

/** Define a escolha da pessoa (ou `null` para voltar a seguir o sistema). */
export function escolherNivel(novo: Nivel | null) {
  escolha = novo
  gravarEscolha(guardaDoNavegador(), novo)
  atualizar()
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar)
  return () => {
    ouvintes.delete(avisar)
  }
}

/** `true` quando a pessoa já escolheu um nível; re-renderiza quando isso muda. */
export function useNivelFoiEscolhido(): boolean {
  return useSyncExternalStore(assinar, nivelFoiEscolhido, () => false)
}

/** Nível de movimento vigente; o componente re-renderiza quando ele muda. */
export function useNivelDeMovimento(): Nivel {
  return useSyncExternalStore(assinar, nivelDeMovimento, () => 'completo' as Nivel)
}
