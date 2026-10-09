// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { comLink, InserirLink, TextoComLinks } from './Links'

afterEach(cleanup)

describe('TextoComLinks', () => {
  it('mostra vários links clicáveis, em nova aba, e o resto como texto', () => {
    render(<TextoComLinks texto={'Veja [a apostila](https://exemplo.com/a.pdf) e https://exemplo.com/video.\nAté sexta.'} />)

    const links = screen.getAllByRole('link')
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['a apostila', 'https://exemplo.com/a.pdf'],
      ['https://exemplo.com/video', 'https://exemplo.com/video'],
    ])
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    }
    expect(screen.getByText(/Até sexta\./)).toBeTruthy()
  })

  it('não interpreta HTML nem cria link para outros esquemas', () => {
    const { container } = render(<TextoComLinks texto={'<img src=x onerror=alert(1)> [x](javascript:alert(1))'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })
})

describe('InserirLink', () => {
  function Campo() {
    const [texto, setTexto] = useState('Material:')
    return (
      <>
        <output aria-label="texto">{texto}</output>
        <InserirLink aoInserir={(trecho) => setTexto((atual) => comLink(atual, trecho))} />
      </>
    )
  }

  it('acrescenta o link ao texto e permite inserir outro', async () => {
    render(<Campo />)
    await userEvent.click(screen.getByRole('button', { name: 'Inserir link' }))
    await userEvent.type(screen.getByLabelText('Endereço'), 'exemplo.com/um')
    await userEvent.type(screen.getByLabelText('Texto do link (opcional)'), 'primeiro')
    await userEvent.click(screen.getByRole('button', { name: 'Inserir' }))

    await userEvent.click(screen.getByRole('button', { name: 'Inserir link' }))
    await userEvent.type(screen.getByLabelText('Endereço'), 'https://exemplo.com/dois')
    await userEvent.click(screen.getByRole('button', { name: 'Inserir' }))

    expect(screen.getByLabelText('texto').textContent).toBe('Material: [primeiro](https://exemplo.com/um) https://exemplo.com/dois')
  })

  it('recusa endereço inválido sem mexer no texto', async () => {
    render(<Campo />)
    await userEvent.click(screen.getByRole('button', { name: 'Inserir link' }))
    await userEvent.type(screen.getByLabelText('Endereço'), 'sem dominio')
    await userEvent.click(screen.getByRole('button', { name: 'Inserir' }))
    expect(screen.getByRole('alert').textContent).toContain('Informe um endereço válido')
    expect(screen.getByLabelText('texto').textContent).toBe('Material:')
  })
})

describe('comLink', () => {
  it('separa com espaço só quando precisa', () => {
    expect(comLink('', 'https://a.com')).toBe('https://a.com')
    expect(comLink('Veja', 'https://a.com')).toBe('Veja https://a.com')
    expect(comLink('Veja\n', 'https://a.com')).toBe('Veja\nhttps://a.com')
  })
})
