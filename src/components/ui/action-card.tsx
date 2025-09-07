
'use client';

import Link from 'next/link';
import type { ElementType } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const actionCardVariants = cva(
  'group block w-full rounded-lg border bg-card/80 p-6 shadow-sm transition-all duration-200 ease-in-out hover:shadow-md hover:-translate-y-1 backdrop-blur-sm',
  {
    variants: {
      variant: {
        default: 'hover:border-primary',
        accent: 'border-accent/50 bg-accent/5 hover:border-accent',
        active: 'bg-primary text-primary-foreground hover:bg-primary/90 hover:border-primary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const iconVariants = cva(
    'h-8 w-8 transition-colors', 
    {
        variants: {
            variant: {
                default: 'text-muted-foreground group-hover:text-primary',
                accent: 'text-accent group-hover:text-primary',
                active: 'text-primary-foreground/80 group-hover:text-primary-foreground',
            }
        },
        defaultVariants: {
            variant: 'default'
        }
    }
);

const titleVariants = cva('text-lg font-semibold', {
    variants: {
        variant: {
            default: 'text-card-foreground',
            accent: 'text-card-foreground',
            active: 'text-primary-foreground',
        },
    },
    defaultVariants: {
        variant: 'default'
    }
});

const descriptionVariants = cva('text-sm', {
     variants: {
        variant: {
            default: 'text-muted-foreground',
            accent: 'text-muted-foreground',
            active: 'text-primary-foreground/90',
        },
    },
    defaultVariants: {
        variant: 'default'
    }
});


export interface ActionCardProps extends VariantProps<typeof actionCardVariants> {
  href: string;
  icon: ElementType<{ className?: string }>;
  title: string;
  description: string;
}

export function ActionCard({ href, icon: Icon, title, description, variant }: ActionCardProps) {
  return (
    <Link href={href} className={cn(actionCardVariants({ variant }))}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className={cn(titleVariants({ variant }))}>{title}</h3>
          <p className={cn(descriptionVariants({ variant }))}>{description}</p>
        </div>
        <Icon className={cn(iconVariants({ variant }))} />
      </div>
    </Link>
  );
}
