import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TRAJETORIA, type MomentoDeCarreira } from "@/conteudo/marca";
import { varianteDaTag } from "@/dominio/experiencia";
import {
  deBloco,
  deRegua,
  gsap,
  ScrollTrigger,
  useMovimento,
} from "@/lib/movimento";
import { cn } from "@/lib/utils";
import { COR_DE_FUNDO } from "./cores";

function Momento({ momento }: { momento: MomentoDeCarreira }) {
  return (
    <div className="flex flex-col gap-(--espaco-miolo)">
      <div data-entra className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="font-mono text-sm font-bold">{momento.periodo}</p>
        <ul className="flex flex-wrap gap-2.5" aria-label="Temas deste momento">
          {momento.temas.map((tema) => (
            <li key={tema}>
              <Badge variant={varianteDaTag(tema)}>{tema}</Badge>
            </li>
          ))}
        </ul>
      </div>

      <ol>
        {momento.atuacoes.map((a) => (
          <li key={a.organizacao} data-atuacao>
            <span
              aria-hidden="true"
              data-regua
              className="block h-0.5 origin-left bg-foreground"
            />
            <article
              data-conteudo
              className="flex flex-col gap-4 py-(--espaco-item)"
            >
              <h3 className="text-[clamp(24px,2.8vw,44px)] leading-[1.05]">
                {a.papel}
              </h3>
              <p className="font-bold">{a.organizacao}</p>
              <p className="max-w-[52ch] text-lg leading-normal md:text-xl">
                {a.resumo}
              </p>
              {a.pontos.length > 0 && (
                <ul className="flex max-w-[64ch] flex-col gap-2.5 text-[15px] leading-[1.6] text-muted-foreground">
                  {a.pontos.map((ponto) => (
                    <li key={ponto} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-[0.6em] size-2 shrink-0",
                          COR_DE_FUNDO[momento.cor],
                        )}
                      />
                      {ponto}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </li>
        ))}
        <li aria-hidden="true" className="h-0.5 bg-foreground" />
      </ol>
    </div>
  );
}

/**
 * Trajetória por momento de carreira: uma linha do tempo com três momentos à
 * esquerda e, à direita, o que fiz em cada um. O conteúdo vem de
 * `src/conteudo/marca.ts`.
 *
 * É um conjunto de abas (Radix): setas do teclado trocam de momento e cada
 * momento tem o seu painel. Movimento: as réguas se desenham e os blocos
 * sobem quando a seção entra na tela e a cada troca de momento.
 */
export function Trajetoria() {
  const raiz = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState(TRAJETORIA[0].id);
  const montado = useRef(ativo);

  useMovimento(
    raiz,
    (_condicoes, q) => {
      const trocou = montado.current !== ativo;
      montado.current = ativo;
      // Na troca de momento a seção já está na tela: a entrada toca na hora.
      const gatilho = trocou
        ? undefined
        : { trigger: raiz.current, start: "top 80%" };

      const linha = gsap.timeline({ scrollTrigger: gatilho });
      if (!trocou)
        linha.from(q("[data-momento]"), { ...deBloco(24), stagger: 0.08 }, 0);
      linha.from(q("[data-entra]"), deBloco(20), 0.1);
      q("[data-atuacao]").forEach((item, i) => {
        const dentro = (seletor: string) =>
          Array.from(item.querySelectorAll<HTMLElement>(seletor));
        linha
          .from(dentro("[data-regua]"), deRegua(), 0.15 + i * 0.1)
          .from(dentro("[data-conteudo]"), deBloco(32), 0.2 + i * 0.1);
      });
      // A altura da seção muda com o momento: quem vem depois precisa se remedir.
      if (trocou) ScrollTrigger.refresh();
    },
    [ativo],
  );

  return (
    <div ref={raiz}>
      <Tabs
        value={ativo}
        onValueChange={setAtivo}
        orientation="vertical"
        className="grid gap-(--espaco-bloco) lg:grid-cols-12 lg:gap-x-6"
      >
        <TabsList
          aria-label="Momentos da carreira"
          className="h-auto w-full flex-col items-stretch gap-0 rounded-none bg-transparent p-0 lg:sticky lg:top-24 lg:col-span-4 lg:self-start"
        >
          {TRAJETORIA.map((m, i) => (
            <TabsTrigger
              key={m.id}
              value={m.id}
              data-cursor="Ver"
              className={cn(
                "group h-auto flex-none rounded-none border-0 border-t-2 border-foreground px-0 py-5 text-left whitespace-normal",
                "data-[state=active]:border-foreground data-[state=active]:bg-transparent",
                i === TRAJETORIA.length - 1 && "border-b-2",
              )}
            >
              {/* A entrada anima este miolo, não o botão: a transição de cor do botão não pode competir com ela. */}
              <span data-momento className="flex w-full items-start gap-4">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 size-3.5 shrink-0 origin-left transition-transform duration-300 group-data-[state=active]:scale-x-[2.4]",
                    COR_DE_FUNDO[m.cor],
                  )}
                />
                <span className="flex min-w-0 flex-col gap-1.5 pl-3 transition-transform duration-300 group-data-[state=active]:translate-x-3">
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {m.periodo}
                  </span>
                  <span className="font-mono text-[clamp(19px,1.9vw,26px)] leading-[1.15] font-bold">
                    {m.titulo}
                  </span>
                </span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TRAJETORIA.map((m) => (
          <TabsContent
            key={m.id}
            value={m.id}
            className="lg:col-span-7 lg:col-start-6"
          >
            <Momento momento={m} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
