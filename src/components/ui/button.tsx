import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-transparent text-[13px] font-bold tracking-[0.04em] whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // "Acento" do guia: azul com texto branco (4,55:1).
        default:
          "border-primary bg-primary text-primary-foreground hover:border-foreground hover:bg-foreground hover:text-background",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground hover:border-foreground hover:bg-foreground hover:text-background",
        outline:
          "border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background",
        // "Primário" do guia: fundo Tinta.
        secondary:
          "border-secondary bg-secondary text-secondary-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        // "Texto" do guia: neutro sublinhado (azul não passa em AA no corpo).
        link: "text-muted-foreground underline underline-offset-[3px] hover:text-foreground",
      },
      size: {
        default: "min-h-11 px-6 py-[11px] has-[>svg]:px-5",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "min-h-9 gap-1.5 px-4 py-1.5 text-xs has-[>svg]:px-3",
        lg: "min-h-12 px-8 py-3 text-sm has-[>svg]:px-6",
        icon: "size-11",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
