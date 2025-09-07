
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Menu, Home, Users, History, Settings, Trophy, LogOut, Zap } from 'lucide-react';
import { useState } from 'react';
import { RiBasketballLine } from 'react-icons/ri';
import { useAuth } from './auth-provider';
import { signOut } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Separator } from '@/components/ui/separator';


const navLinks = [
  { href: '/tournaments', label: 'Torneos', icon: Trophy },
  { href: '/roster', label: 'Plantilla', icon: Users },
  { href: '/history', label: 'Historial', icon: History },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

export function Header() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isGameInProgress } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({ title: 'Sesión Cerrada', description: 'Has cerrado sesión correctamente.' });
    router.push('/login');
  };
  
  if (pathname === '/' || !user) {
    return null; // Don't render header on home page or while loading/logged out
  }
  
  const isGuest = user.isAnonymous;
  
  const getNavLinks = (isMobile = false) => {
    let finalLinks: { href: string; label: string; icon: React.ElementType; variant?: any; className?: string; }[] = [];
    
    if (isGameInProgress) {
        finalLinks.push({
            href: '/game/live',
            label: 'Juego en Curso',
            icon: Zap,
            variant: isMobile ? 'default' : 'special',
            className: isMobile ? '' : 'text-primary-foreground animate-pulse bg-gradient-to-r from-primary to-orange-400'
        });
    } else {
        finalLinks.push({
            href: '/',
            label: 'Inicio',
            icon: Home
        });
    }
    
    finalLinks = finalLinks.concat(navLinks);

    return finalLinks.map(link => {
        const isActive = pathname === link.href;
        
        // Handle special desktop button for active game
        if (link.variant === 'special' && !isMobile) {
            return (
                <Button key={link.href} asChild size="sm" className={link.className}>
                    <Link href={link.href}>
                        <Zap className="mr-2 h-4 w-4" /> {link.label}
                    </Link>
                </Button>
            );
        }

        return (
          <Button
            key={link.href}
            asChild
            variant={isMobile ? (isActive ? "default" : "ghost") : "ghost"}
            className={cn(
                isMobile ? 'justify-start text-base h-11' : 'text-sm font-medium',
                isActive && !isMobile ? 'text-primary' : 'text-muted-foreground',
                isMobile && isActive ? '' : 'text-muted-foreground'
            )}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Link href={link.href}>
              {isMobile && <link.icon className="mr-3 h-5 w-5" />}
              {link.label}
            </Link>
          </Button>
        );
    });
  };

  const UserMenu = () => (
     <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
                <AvatarFallback>{isGuest ? 'I' : user.displayName?.[0] || user.email?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {isGuest ? 'Invitado' : (user.displayName || user.email)}
              </p>
              {!isGuest && user.displayName && (
                 <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                 </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex md:flex-1">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <RiBasketballLine className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block">
              Estadika
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {getNavLinks()}
          </nav>
        </div>
        <div className="hidden md:flex flex-1 justify-end">
             <UserMenu />
        </div>


        {/* Mobile Navigation */}
        <div className="flex w-full items-center justify-between md:hidden">
           <div className="flex items-center gap-2">
             <Link href="/" className="flex items-center space-x-2">
               <RiBasketballLine className="h-6 w-6 text-primary" />
               <span className="font-bold text-lg">Estadika</span>
             </Link>
              {isGameInProgress && (
                <Button asChild size="sm" variant="outline" className="h-8 animate-pulse border-primary text-primary">
                  <Link href="/game/live">
                    <Zap className="h-4 w-4"/>
                    <span className="ml-1.5">En Curso</span>
                  </Link>
                </Button>
              )}
           </div>
           <div className="flex items-center gap-2">
            <UserMenu />
            <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[340px] p-0">
                  <div className="p-4 border-b">
                     <div className="flex flex-col space-y-1">
                        <p className="text-base font-semibold leading-none">
                            {isGuest ? 'Invitado' : (user.displayName || user.email)}
                        </p>
                        {!isGuest && user.displayName && (
                            <p className="text-sm leading-none text-muted-foreground">
                                {user.email}
                            </p>
                        )}
                        </div>
                  </div>
                  <nav className="grid gap-2 p-4">
                      {getNavLinks(true)}
                      <Separator className="my-2" />
                      <Button 
                          variant="ghost" 
                          className="justify-start text-base h-11"
                          onClick={() => {
                              setMobileMenuOpen(false);
                              handleSignOut();
                          }}
                        >
                          <LogOut className="mr-3 h-5 w-5" />
                          Cerrar Sesión
                      </Button>
                  </nav>
              </SheetContent>
            </Sheet>
           </div>
        </div>
      </div>
    </header>
  );
}
