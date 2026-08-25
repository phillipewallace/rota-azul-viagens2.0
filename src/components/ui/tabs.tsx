import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

/* ----------------------------------------------------------------------------
 * Tabs — Navy Trust
 * Três variantes para casar com diferentes densidades:
 *   • pill        → padrão, cápsula suave (default shadcn-like, premium)
 *   • underline   → linhas sutis, ideal para conteúdo denso / dashboards
 *   • segmented   → controle segmentado com fundo translúcido
 * -------------------------------------------------------------------------- */

const tabsListVariants = cva(
  "inline-flex items-center text-muted-foreground transition-colors",
  {
    variants: {
      variant: {
        pill:
          "h-11 gap-1 rounded-xl bg-muted/60 p-1 backdrop-blur supports-[backdrop-filter]:bg-muted/50 ring-1 ring-border/60",
        underline:
          "h-11 gap-6 border-b border-border bg-transparent px-0 rounded-none",
        segmented:
          "h-10 gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-sm",
      },
    },
    defaultVariants: { variant: "pill" },
  }
)

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        pill:
          "rounded-lg px-4 py-1.5 text-muted-foreground hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border/60",
        underline:
          "relative h-11 rounded-none px-1 py-0 text-muted-foreground hover:text-foreground data-[state=active]:text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary after:origin-center after:scale-x-0 data-[state=active]:after:scale-x-100 after:transition-transform after:duration-200",
        segmented:
          "rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
      },
    },
    defaultVariants: { variant: "pill" },
  }
)

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

type TabsTriggerProps = React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Trigger
> &
  VariantProps<typeof tabsTriggerVariants>

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-fade-in",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants }
