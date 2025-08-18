
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BasketballIcon } from '@/components/icons/basketball';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Menu, Home, Users, History, Settings, Trophy } from 'lucide-react';
import { useState } from 'react';

const navLinks = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/tournaments', label: 'Torneos', icon: Trophy },
  { href: '/roster', label: 'Plantilla', icon: Users },
  { href: '/history', label: 'Historial', icon: History },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

export function Header() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = navLinks.map((link) => (
    <Button
      key={link.href}
      asChild
      variant="ghost"
      className={cn(
        'text-sm font-medium',
        pathname === link.href ? 'text-primary' : 'text-muted-foreground'
      )}
      onClick={() => setMobileMenuOpen(false)}
    >
      <Link href={link.href}>{link.label}</Link>
    </Button>
  ));

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Desktop Navigation */}
        <div className="mr-4 hidden md:flex md:flex-1">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <BasketballIcon className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block">
              Estadika
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navItems}
          </nav>
        </div>

        {/* Mobile Navigation */}
        <div className="flex w-full items-center justify-between md:hidden">
           <Link href="/" className="flex items-center space-x-2">
             <BasketballIcon className="h-6 w-6 text-primary" />
             <span className="font-bold text-lg">Estadika</span>
           </Link>
           <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[340px]">
                <SheetHeader className="p-4 border-b">
                     <SheetTitle className="flex items-center gap-2">
                        <BasketballIcon className="h-6 w-6 text-primary" />
                        <span className="font-bold text-xl">Estadika</span>
                     </SheetTitle>
                </SheetHeader>
                <nav className="grid gap-2 p-4">
                    {navLinks.map(link => (
                         <Button 
                            asChild 
                            key={link.href} 
                            variant={pathname.startsWith(link.href) && link.href !== '/' || pathname === '/' && link.href === '/' ? "default" : "ghost"} 
                            className="justify-start text-base h-11"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Link href={link.href}>
                               <link.icon className="mr-3 h-5 w-5" />
                               {link.label}
                            </Link>
                         </Button>
                    ))}
                </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
