import { useCallback, useEffect, useRef, useState } from 'react'

export type Consulta<T> = {
  dados: T | null
  carregando: boolean
  erro: string | null
  recarregar: () => void
}

/**
 * Carrega dados assíncronos com os três estados que o PRD exige em toda
 * lista: carregando (Skeleton), erro (com "Tentar de novo") e pronto.
 * `dependencias` funciona como em `useEffect`.
 */
export function useConsulta<T>(buscar: () => Promise<T>, dependencias: unknown[]): Consulta<T> {
  const [dados, setDados] = useState<T | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  const buscarAtual = useRef(buscar)
  buscarAtual.current = buscar

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(null)
    buscarAtual
      .current()
      .then((resultado) => {
        if (ativo) setDados(resultado)
      })
      .catch((falha: Error) => {
        if (ativo) setErro(falha.message)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao, ...dependencias])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  return { dados, carregando, erro, recarregar }
}
