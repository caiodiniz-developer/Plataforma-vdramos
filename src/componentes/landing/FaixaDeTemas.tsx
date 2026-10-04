const ITENS = [
  { texto: 'Dados', cor: 'bg-primary' },
  { texto: 'Inteligência artificial', cor: 'bg-orange' },
  { texto: 'Educação', cor: 'bg-violet' },
  { texto: 'Produto', cor: 'bg-green' },
  { texto: 'Engenharia', cor: 'bg-neutro' },
  { texto: 'Letramento em dados', cor: 'bg-primary' },
  { texto: 'Rigor técnico', cor: 'bg-orange' },
  { texto: 'Clareza didática', cor: 'bg-violet' },
]

function Sequencia() {
  return (
    <ul className="flex shrink-0 items-center gap-10 pr-10">
      {ITENS.map((item) => (
        <li key={item.texto} className="flex items-center gap-10 whitespace-nowrap">
          <span className="font-mono text-xl font-bold md:text-2xl">{item.texto}</span>
          <span className={`size-3 ${item.cor}`} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Faixa em Tinta com os temas rolando. Decorativa (aria-hidden): os mesmos
 * temas aparecem como texto no hero. Para com `prefers-reduced-motion`.
 */
export function FaixaDeTemas() {
  return (
    <div aria-hidden="true" className="overflow-hidden border-b-2 bg-secondary py-5 text-secondary-foreground">
      <div className="animar-faixa flex w-max">
        <Sequencia />
        <Sequencia />
      </div>
    </div>
  )
}
