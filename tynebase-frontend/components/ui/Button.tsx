import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)] focus-visible:ring-[var(--brand)]",
        secondary: "bg-[var(--surface-card)] text-[var(--dash-text-primary)] border border-[var(--dash-border-default)] hover:bg-[var(--surface-ground)] focus-visible:ring-[var(--dash-border-strong)]",
        outline: "border border-[var(--dash-border-strong)] bg-transparent hover:bg-[var(--surface-ground)] text-[var(--dash-text-primary)] focus-visible:ring-[var(--dash-border-strong)]",
        ghost: "hover:bg-[var(--surface-ground)] text-[var(--dash-text-primary)]",
        destructive: "bg-[var(--status-error)] text-white hover:bg-[#991B1B] focus-visible:ring-[var(--status-error)]",
        gradient: "bg-[var(--brand-gradient)] text-white hover:opacity-90",
      },
      size: {
        sm: "h-8 px-4 text-sm rounded-[var(--radius-sm)]",
        md: "h-10 px-6 text-sm rounded-[var(--radius-md)]",
        lg: "h-12 px-7 text-base rounded-[var(--radius-md)]",
        icon: "h-10 w-10 rounded-[var(--radius-md)]",
        "icon-sm": "h-8 w-8 rounded-[var(--radius-sm)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(node);
      } else {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
}

type SlotProps = {
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>;

const Slot = React.forwardRef<HTMLElement, SlotProps>(({ children, className, ...props }, forwardedRef) => {
  if (!React.isValidElement(children)) return null;

  const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>;
  const mergedClassName = cn(child.props?.className, className);
  const childRef = (child as any).ref;
  const ref = composeRefs(childRef, forwardedRef);

  return React.cloneElement(child, {
    ...props,
    className: mergedClassName,
    ref,
  });
});
Slot.displayName = "Slot";

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button" as React.ElementType;
    // When using asChild, don't pass button-specific props (onClick, disabled, type, etc.) to Slot
    // as they don't apply to the child element (like Link)
    const slotProps = asChild ? {} : props;
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref as React.Ref<HTMLButtonElement>} {...slotProps}>
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
