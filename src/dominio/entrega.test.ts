import { describe, expect, it } from 'vitest'
import { problemaDosArquivos, tamanhoLegivel } from './entrega'

const LIMITES = { maximoMb: 25, porAtividade: 5 }
const MB = 1024 * 1024
const arquivo = (name: string, size = MB) => ({ name, size })

describe('problemaDosArquivos', () => {
  it('sem arquivo, ou dentro dos limites, pode enviar', () => {
    expect(problemaDosArquivos([], 5, LIMITES)).toBeNull()
    expect(problemaDosArquivos([arquivo('projeto.zip'), arquivo('notas.pdf')], 3, LIMITES)).toBeNull()
  })

  it('conta o que já foi enviado no limite por atividade', () => {
    expect(problemaDosArquivos([arquivo('a.zip'), arquivo('b.zip')], 4, LIMITES)).toBe('Dá para enviar mais 1 arquivo. Junte os demais em um .zip.')
    expect(problemaDosArquivos([arquivo('a.zip')], 5, LIMITES)).toBe('Você já enviou o limite de 5 arquivos.')
  })

  it('recusa arquivo vazio e arquivo grande demais, citando o nome', () => {
    expect(problemaDosArquivos([arquivo('vazio.txt', 0)], 0, LIMITES)).toBe('O arquivo "vazio.txt" está vazio.')
    expect(problemaDosArquivos([arquivo('video.mp4', 26 * MB)], 0, LIMITES)).toBe('O arquivo "video.mp4" passa de 25 MB. Compacte ou divida.')
    expect(problemaDosArquivos([arquivo('limite.zip', 25 * MB)], 0, LIMITES)).toBeNull()
  })
})

describe('tamanhoLegivel', () => {
  it('mostra KB e MB', () => {
    expect(tamanhoLegivel(10)).toBe('1 KB')
    expect(tamanhoLegivel(1536)).toBe('2 KB')
    expect(tamanhoLegivel(3 * MB)).toBe('3,0 MB')
  })
})
