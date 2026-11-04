import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-medium select-none " +
    "transition-[transform,background-color,box-shadow] duration-150 ease-out-quint " +
    "active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0/0.2),inset_0_1px_0_rgb(255_255_255/0.15)] hover:bg-primary/90",
        ghost: "bg-foreground/5 text-foreground hover:bg-foreground/10",
      },
      size: { md: "h-10 px-5 text-sm", lg: "h-12 px-6 text-base" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
