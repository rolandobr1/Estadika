
'use client';

import Link from 'next/link';
import type { ElementType } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const actionCardVariants = cva(
  'group block w-full rounded-lg border bg-card p-6 shadow-sm transition-all duration-200 ease-in-out hover:shadow-md hover:-translate-y-1',
  {
    variants: {
      variant: {
        default: 'hover:border-primary/50',
        accent: 'border-accent/50 bg-accent/5 hover:border-accent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const iconVariants = cva(
    'h-8 w-8 transition-colors group-hover:text-primary', 
    {
        variants: {
            variant: {
                default: 'text-muted-foreground',
                accent: 'text-accent',
            }
        },
        defaultVariants: {
            variant: 'default'
        }
    }
);


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
          <h3 className="text-lg font-semibold text-card-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Icon className={cn(iconVariants({ variant }))} />
      </div>
    </Link>
  );
}
