import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

type Props = { children: string; className?: string }

/**
 * Markdown do professor (ementa, critérios) e da política de privacidade.
 * O `react-markdown` não renderiza HTML bruto, então o conteúdo não injeta
 * marcação; links externos abrem em nova aba com `noopener noreferrer`.
 */
export function Markdown({ children, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-4 leading-[1.6]', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="mt-4 text-[22px]">{children}</h2>,
          h2: ({ children }) => <h2 className="mt-4 text-[22px]">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-2 text-lg">{children}</h3>,
          ul: ({ children }) => <ul className="flex list-disc flex-col gap-2 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="flex list-decimal flex-col gap-2 pl-6">{children}</ol>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} className="font-bold underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto border-2">
              <table className="w-full text-left text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b-2 bg-muted px-3 py-2 font-bold">{children}</th>,
          td: ({ children }) => <td className="border-t border-divisor px-3 py-2 align-top">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
