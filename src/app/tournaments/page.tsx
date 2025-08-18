
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, ChevronsRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { type Tournament } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingModal } from '@/components/ui/loader';

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
    }
    const storedTournaments = localStorage.getItem('tournaments');
    if (storedTournaments) {
      setTournaments(JSON.parse(storedTournaments));
    }
    setIsLoading(false);
  }, []);

  const handleDeleteAll = () => {
    localStorage.removeItem('tournaments');
    setTournaments([]);
    toast({
      title: 'Torneos Eliminados',
      description: 'Todos los torneos han sido eliminados.',
      variant: 'destructive'
    });
  };

  if (isLoading) {
    return <LoadingModal />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Modo Torneo</h1>
          <p className="text-muted-foreground">Crea y gestiona tus competiciones de baloncesto.</p>
        </div>
        <Button asChild>
          <Link href="/tournaments/create">
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Torneo
          </Link>
        </Button>
      </div>

      {tournaments.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay torneos todavía</CardTitle>
            <CardDescription>¡Comienza creando tu primer torneo para empezar a competir!</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/tournaments/create">
                <PlusCircle className="mr-2 h-4 w-4" /> Crear tu Primer Torneo
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <Card key={tournament.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{tournament.name}</CardTitle>
                  <CardDescription>{tournament.teams.length} equipos participantes</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex items-end justify-end">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/stats?tournamentId=${tournament.id}`}>
                      Gestionar <ChevronsRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end pt-4">
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar Todos los Torneos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Esto eliminará permanentemente todos los datos de los torneos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll}>Sí, eliminar todo</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}
