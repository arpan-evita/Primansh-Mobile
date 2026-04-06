import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:-translate-y-0.5 active:translate-y-0 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background hover:bg-foreground/90 rounded-xl",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl",
        outline: "border border-border bg-background text-foreground hover:bg-muted/50 hover:border-accent/30 hover:shadow-soft rounded-xl",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl shadow-soft",
        ghost: "hover:bg-muted/50 hover:text-foreground rounded-xl",
        link: "text-accent underline-offset-4 hover:underline",
        accent: "text-accent-foreground rounded-xl font-bold bg-[image:var(--gradient-electric)] shadow-[0_4px_14px_hsl(var(--accent)/0.4)] hover:shadow-[0_8px_30px_hsl(var(--accent)/0.6)] hover:brightness-110 relative overflow-hidden group-hover:after:translate-x-full after:absolute after:inset-0 after:-translate-x-[150%] after:skew-x-[45deg] after:bg-white/20 after:transition-transform after:duration-1000",
        hot: "text-primary-foreground rounded-xl font-bold bg-[image:var(--gradient-hot)] shadow-[0_4px_14px_hsl(224_62%_52%/0.4)] hover:shadow-[0_8px_30px_hsl(224_62%_52%/0.6)] hover:brightness-110 relative overflow-hidden group-hover:after:translate-x-full after:absolute after:inset-0 after:-translate-x-[150%] after:skew-x-[45deg] after:bg-white/20 after:transition-transform after:duration-1000",
        glass: "bg-background/50 backdrop-blur-xl border border-border text-foreground hover:bg-background/80 hover:shadow-soft rounded-xl",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-14 px-8 text-base",
        xl: "h-16 px-12 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
