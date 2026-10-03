import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-md border-2 border-transparent px-[10px] py-[5px] text-[10px] leading-[1.4] font-bold tracking-[0.14em] whitespace-nowrap uppercase [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground",
        secondary: "border-secondary bg-secondary text-secondary-foreground",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground",
        outline:
          "border-foreground text-foreground",
        // Acentos como preenchimento, sempre com texto em Tinta (regra de contraste do PRD).
        orange: "border-orange bg-orange text-tinta",
        green: "border-green bg-green text-tinta",
        // Roxo nunca é sólido com texto: fundo tingido a 12 % e borda roxa.
        violet: "border-violet bg-violet-tint text-foreground",
        neutro: "border-neutro bg-neutro text-tinta",
        margem: "hachura border-neutro text-tinta",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
