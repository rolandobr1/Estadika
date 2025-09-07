
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmail, setAuthPersistence, signInAnonymously } from '@/lib/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RiBasketballLine } from 'react-icons/ri';
import { Separator } from '@/components/ui/separator';

const loginSchema = z.object({
  email: z.string().email({ message: 'Por favor, introduce un email válido.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
  rememberMe: z.boolean().default(false).optional(),
});


export default function LoginPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loginForm = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '', rememberMe: true },
    });

    const handleGuestSignIn = async () => {
        setIsSubmitting(true);
        try {
            await signInAnonymously();
            toast({ title: '¡Bienvenido!', description: 'Has entrado como invitado. Tus datos se guardarán localmente en este dispositivo.' });
            router.push('/');
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error de Autenticación', description: "No se pudo iniciar la sesión de invitado." });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleEmailLogin = async (values: z.infer<typeof loginSchema>) => {
        setIsSubmitting(true);
        try {
            await setAuthPersistence(values.rememberMe || false);
            await signInWithEmail(values.email, values.password);
            toast({ title: '¡Bienvenido!', description: 'Has iniciado sesión correctamente.' });
            router.push('/');
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error de Autenticación', description: "Las credenciales son incorrectas. Por favor, inténtalo de nuevo." });
        } finally {
            setIsSubmitting(false);
        }
    };


  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
       <div className="absolute top-8 flex items-center gap-2 text-foreground">
            <RiBasketballLine className="h-7 w-7 text-primary"/>
            <span className="text-2xl font-bold">Estadika</span>
       </div>
        <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Iniciar Sesión</CardTitle>
              <CardDescription>Accede a tu cuenta para continuar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={loginForm.handleSubmit(handleEmailLogin)} className="space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="tu@email.com" {...loginForm.register('email')} />
                    {loginForm.formState.errors.email && <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input id="login-password" type="password" {...loginForm.register('password')} />
                    {loginForm.formState.errors.password && <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>}
                </div>
                 <div className="flex items-center space-x-2">
                    <Checkbox id="remember-me" {...loginForm.register('rememberMe')} defaultChecked={true}/>
                    <label
                        htmlFor="remember-me"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Recordarme
                    </label>
                 </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Iniciando...' : 'Iniciar Sesión'}
                </Button>
              </form>
              <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                      <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">O</span>
                  </div>
              </div>
                <Button variant="secondary" className="w-full" onClick={handleGuestSignIn} disabled={isSubmitting}>
                    Entrar como Invitado
                </Button>
            </CardContent>
        </Card>
    </main>
  );
}
