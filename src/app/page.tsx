import { History, Swords, Trophy, Users } from "lucide-react";
import { ActionButton } from "@/components/action-button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 font-body text-foreground">
      <div className="text-center mb-12 sm:mb-16">
        <h1 className="font-headline text-6xl font-bold text-primary tracking-tight">
          Estadika
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-md mx-auto">
          Tu compañero para las estadísticas deportivas.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-sm sm:max-w-2xl">
        <ActionButton icon={<Swords />} text="Iniciar Partido" />
        <ActionButton icon={<Trophy />} text="Modo Torneo" />
        <ActionButton icon={<Users />} text="Gestión de Jugadores" />
        <ActionButton icon={<History />} text="Historial" />
      </div>
    </main>
  );
}
