import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ActionButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
  icon: React.ReactNode;
  text: string;
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ icon, text, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="default"
        className={cn(
          'h-40 w-full text-lg font-semibold flex flex-col items-center justify-center gap-2 transition-all duration-300 ease-in-out hover:scale-[1.03] hover:shadow-xl active:scale-95 shadow-lg rounded-xl p-4 text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
          className
        )}
        {...props}
      >
        <div className="[&>svg]:w-12 [&>svg]:h-12 text-primary-foreground">{icon}</div>
        <span className="text-center">{text}</span>
      </Button>
    );
  }
);
ActionButton.displayName = 'ActionButton';

export { ActionButton };
