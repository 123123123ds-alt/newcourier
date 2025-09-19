import * as React from 'react';
import { cn } from '@/lib/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  requiredMark?: boolean;
};

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, requiredMark, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
      {...props}
    >
      {children}
      {requiredMark ? <span className="ml-1 text-destructive">*</span> : null}
    </label>
  )
);
Label.displayName = 'Label';
