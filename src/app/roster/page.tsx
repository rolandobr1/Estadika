

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PlusCircle, Upload, Download, Trash2, X, Users, Save, Search, Edit, Share2 } from 'lucide-react';
import type { Player, Team } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { LoadingModal } from '@/components/ui/loader';
import { getPlayers, savePlayer, deletePlayers as deletePlayersFromDb, importPlayers, getTeams, saveTeam, deleteTeams as deleteTeamsFromDb, importTeams } from '@/lib/db';
import { useAuth } from '@/components/layout/auth-provider';
import * as htmlToImage from 'html-to-image';
import { PlayerShareCard } from '@/components/player-share-card';


const playerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }),
  number: z.coerce.number().min(0, { message: 'El número no puede ser negativo.' }).optional(),
  position: z.string().optional(),
});

const teamSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(2, { message: "El nombre del equipo debe tener al menos 2 caracteres." }),
    playerIds: z.array(z.string()).min(1, { message: "Debes seleccionar al menos un jugador." }),
});

const PlayerFormModal = ({
    player,
    onSave,
    onCancel
}: {
    player: Player | null,
    onSave: (player: z.infer<typeof playerSchema>) => void,
    onCancel: () => void
}) => {
    const form = useForm<z.infer<typeof playerSchema>>({
        resolver: zodResolver(playerSchema),
        defaultValues: player || { name: '', number: undefined, position: '' },
    });

    useEffect(() => {
        form.reset(player || { name: '', number: undefined, position: '' });
    }, [player, form]);

    return (
        <Dialog open={!!player} onOpenChange={(isOpen) => !isOpen && onCancel()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Jugador</DialogTitle>
                    <DialogDescription>Modifica los detalles del jugador.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSave)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre del Jugador</FormLabel>
                                    <FormControl><Input placeholder="Nombre del Jugador" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Número</FormLabel>
                                        <FormControl><Input type="number" placeholder="Ej: 7, 23" {...field} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="position"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Posición</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ''} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="-- Seleccionar --" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Base">Base</SelectItem>
                                                <SelectItem value="Escolta">Escolta</SelectItem>
                                                <SelectItem value="Alero">Alero</SelectItem>
                                                <SelectItem value="Ala-Pívot">Ala-Pívot</SelectItem>
                                                <SelectItem value="Pívot">Pívot</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
                            <Button type="submit"><Save className="mr-2 h-4 w-4" /> Guardar Cambios</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};


const TeamForm = ({
    team,
    players,
    allTeams,
    onSave,
    onCancel
}: {
    team: Team | null,
    players: Player[],
    allTeams: Team[],
    onSave: (team: Team) => void,
    onCancel: () => void
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const form = useForm<z.infer<typeof teamSchema>>({
        resolver: zodResolver(teamSchema),
        defaultValues: {
            id: team?.id || undefined,
            name: team?.name || '',
            playerIds: team?.playerIds || [],
        },
    });

    const { toast } = useToast();

    const assignedPlayerIds = useMemo(() => {
        const otherTeams = allTeams.filter(t => t.id !== team?.id);
        const ids = new Set<string>();
        otherTeams.forEach(t => {
            t.playerIds.forEach(pId => ids.add(pId));
        });
        return ids;
    }, [allTeams, team]);


    const availablePlayers = useMemo(() => {
        const currentSelectedIds = new Set(form.watch('playerIds'));
        return players.filter(player => {
            const isAssignedToAnotherTeam = assignedPlayerIds.has(player.id);
            const isCurrentlySelectedInThisForm = currentSelectedIds.has(player.id);
            // Show player if they are not assigned to another team, OR if they are already selected in this specific team form.
            return !isAssignedToAnotherTeam || isCurrentlySelectedInThisForm;
        });
    }, [players, assignedPlayerIds, form.watch('playerIds')]);

     const filteredPlayers = useMemo(() => 
        availablePlayers.filter(player => player.name.toLowerCase().includes(searchTerm.toLowerCase()))
    , [availablePlayers, searchTerm]);

    async function onSubmit(values: z.infer<typeof teamSchema>) {
        const teamToSave: Team = {
            id: values.id || `team_${Date.now()}`,
            name: values.name,
            playerIds: values.playerIds,
        };
        await saveTeam(teamToSave);
        onSave(teamToSave);
        toast({
            title: "Equipo Guardado",
            description: `El equipo "${teamToSave.name}" ha sido guardado correctamente.`,
        });
    }

    return (
        <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onCancel()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{team?.id ? 'Editar Equipo' : 'Crear Nuevo Equipo'}</DialogTitle>
                    <DialogDescription>
                        {team?.id ? 'Modifica el nombre y la selección de jugadores.' : 'Asigna un nombre y selecciona los jugadores para tu nuevo equipo.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre del Equipo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Titanes" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="playerIds"
                            render={({ field: { value: selectedPlayerIds, onChange } }) => (
                                <FormItem>
                                     <div className="mb-4 space-y-2">
                                        <FormLabel className="text-base">Seleccionar Jugadores</FormLabel>
                                         <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Buscar jugador..."
                                                className="pl-8"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                     </div>
                                    <ScrollArea className="h-60 rounded-md border">
                                      <div className="p-4">
                                        {filteredPlayers.map((player) => (
                                            <FormItem
                                                key={player.id}
                                                className="flex flex-row items-center space-x-3 space-y-0 mb-3 rounded-md p-2 hover:bg-muted/50"
                                            >
                                                <FormControl>
                                                    <Checkbox
                                                        checked={selectedPlayerIds?.includes(player.id)}
                                                        onCheckedChange={(checked) => {
                                                            const currentIds = selectedPlayerIds || [];
                                                            if (checked) {
                                                                onChange([...currentIds, player.id]);
                                                            } else {
                                                                onChange(currentIds.filter((id) => id !== player.id));
                                                            }
                                                        }}
                                                        id={`team-player-${player.id}`}
                                                    />
                                                </FormControl>
                                                <Label htmlFor={`team-player-${player.id}`} className="font-normal w-full cursor-pointer">
                                                    <div className="flex justify-between items-center">
                                                         <span>#{player.number || '-'} {player.name}</span>
                                                         <span className="text-xs text-muted-foreground">{player.position}</span>
                                                    </div>
                                                </Label>
                                            </FormItem>
                                        ))}
                                        </div>
                                    </ScrollArea>
                                     <FormMessage />
                                </FormItem>
                            )}
                        />
                         <DialogFooter>
                            <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
                            <Button type="submit"><Save className="mr-2 h-4 w-4" /> Guardar Equipo</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

const ImportDialog = ({
    isOpen,
    onClose,
    onConfirm,
    itemCount,
    itemType
}: {
    isOpen: boolean,
    onClose: () => void,
    onConfirm: () => void,
    itemCount: number,
    itemType: 'jugadores' | 'equipos'
}) => (
     <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirmar Importación</DialogTitle>
                <DialogDescription>
                    Has cargado un archivo con {itemCount} {itemType}. Los nuevos elementos se añadirán a tu base de datos. Se omitirán los duplicados por ID.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button onClick={onConfirm}>Importar {itemCount} {itemType}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);


export default function RosterPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [importDialog, setImportDialog] = useState<{ type: 'players' | 'teams'; data: any[] } | null>(null);
  
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [playerToShare, setPlayerToShare] = useState<Player | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const playerFileInputRef = useRef<HTMLInputElement>(null);
  const teamFileInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuth();
  const isGuest = user?.isAnonymous;

  useEffect(() => {
    async function loadData() {
        try {
            const [playersFromDb, teamsFromDb] = await Promise.all([getPlayers(), getTeams()]);
            setPlayers(playersFromDb);
            setTeams(teamsFromDb);
        } catch (error) {
            console.error("Error loading data from Firestore:", error);
            toast({
                variant: 'destructive',
                title: 'Error al cargar datos',
                description: 'No se pudieron obtener los datos de la base de datos.',
            });
        } finally {
            setIsLoading(false);
        }
    }
    loadData();
  }, [toast]);

  const playerForm = useForm<z.infer<typeof playerSchema>>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      id: undefined,
      name: '',
      number: undefined,
      position: '',
    },
  });
  
  useEffect(() => {
    if (playerToShare && shareCardRef.current) {
        setIsSharing(true);
        htmlToImage.toPng(shareCardRef.current, { cacheBust: true, pixelRatio: 2 })
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `jugador_${playerToShare.name.replace(/\s+/g, '_')}.png`;
                link.href = dataUrl;
                link.click();
                setPlayerToShare(null);
            })
            .catch((err) => {
                console.error('Oops, something went wrong!', err);
                toast({
                    variant: 'destructive',
                    title: 'Error al generar imagen',
                    description: 'No se pudo crear la imagen para compartir.',
                });
            })
            .finally(() => {
                setIsSharing(false);
            });
    }
  }, [playerToShare, toast]);

  const filteredPlayers = useMemo(() => 
    players.filter(p => p.name.toLowerCase().includes(playerSearch.toLowerCase()))
  , [players, playerSearch]);

  async function onPlayerSubmit(values: z.infer<typeof playerSchema>) {
    const isEditing = !!values.id;
    const playerToSave: Player = {
        ...values,
        id: values.id || `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
    
    await savePlayer(playerToSave);
    
    if (isEditing) {
        setPlayers(prev => prev.map(p => p.id === playerToSave.id ? playerToSave : p));
        toast({
            title: "Jugador Actualizado",
            description: `Los datos de "${values.name}" han sido actualizados.`,
        });
    } else {
        setPlayers(prev => [...prev, playerToSave]);
        toast({
            title: "Jugador Añadido",
            description: `"${playerToSave.name}" ha sido añadido a tu plantilla.`,
        });
    }
    setEditingPlayer(null);
    playerForm.reset({ name: '', number: undefined, position: '' });
  }

  async function deletePlayers(ids: string[]) {
    await deletePlayersFromDb(ids);
    setPlayers(prev => prev.filter(p => !ids.includes(p.id)));
    setTeams(prev => prev.map(team => ({
        ...team,
        playerIds: team.playerIds.filter(playerId => !ids.includes(playerId))
    })));
    setSelectedPlayerIds(new Set());
    toast({
        title: ids.length > 1 ? "Jugadores eliminados" : "Jugador eliminado",
        description: `${ids.length} ${ids.length > 1 ? 'jugadores han' : 'jugador ha'} sido eliminado de tu plantilla.`
    });
  }
  
  const handleTogglePlayerSelection = (id: string, selectAll?: boolean, allPlayerIds?: string[]) => {
      if (selectAll) {
          if (selectedPlayerIds.size === allPlayerIds?.length) {
              setSelectedPlayerIds(new Set());
          } else {
              setSelectedPlayerIds(new Set(allPlayerIds));
          }
      } else {
          setSelectedPlayerIds(prev => {
              const newSelection = new Set(prev);
              if (newSelection.has(id)) newSelection.delete(id);
              else newSelection.add(id);
              return newSelection;
          });
      }
  }

  const handleCreateTeam = () => {
    setEditingTeam({ id: `team_${Date.now()}`, name: '', playerIds: [] });
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
  };
    
  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
  };

  const handleSaveTeam = (team: Team) => {
    setTeams(prev => {
        const teamIndex = prev.findIndex(t => t.id === team.id);
        if (teamIndex > -1) {
            const newTeams = [...prev];
            newTeams[teamIndex] = team;
            return newTeams;
        }
        return [...prev, team];
    });
    setEditingTeam(null);
  };

  async function deleteTeams(ids: string[]) {
    await deleteTeamsFromDb(ids);
    setTeams(prev => prev.filter(t => !ids.includes(t.id)));
    setSelectedTeamIds(new Set());
    toast({
        title: ids.length > 1 ? "Equipos eliminados" : "Equipo eliminado",
        description: `${ids.length} ${ids.length > 1 ? 'equipos han' : 'equipo ha'} sido eliminado.`
    });
  }
  
  const handleToggleTeamSelection = (id: string, selectAll?: boolean, allTeamIds?: string[]) => {
      if (selectAll) {
          if (selectedTeamIds.size === allTeamIds?.length) {
              setSelectedTeamIds(new Set());
          } else {
              setSelectedTeamIds(new Set(allTeamIds));
          }
      } else {
          setSelectedTeamIds(prev => {
              const newSelection = new Set(prev);
              if (newSelection.has(id)) newSelection.delete(id);
              else newSelection.add(id);
              return newSelection;
          });
      }
  }
  
  const parseCsv = (content: string, headers: string[]): any[] => {
    const rows = content.trim().split('\n').slice(1);
    return rows.map(row => {
        const values = row.split(',');
        const obj: any = {};
        headers.forEach((header, index) => {
            let value: any = values[index] ? values[index].trim() : '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            if (header === 'number' && value) {
                obj[header] = parseInt(value, 10);
            } else if (header === 'playerIds' && value) {
                obj[header] = value.split(';').filter((id: string) => id);
            } else {
                obj[header] = value;
            }
        });
        return obj;
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'players' | 'teams') => {
      const file = event.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
              try {
                  const content = e.target?.result as string;
                  let data;
                  if (file.name.endsWith('.csv')) {
                      if (type === 'players') {
                          data = parseCsv(content, ['id', 'name', 'number', 'position']);
                      } else {
                          data = parseCsv(content, ['id', 'name', 'playerIds']);
                      }
                  } else {
                      data = JSON.parse(content);
                  }
                  
                  if (!Array.isArray(data)) throw new Error("El archivo debe contener un array de elementos.");
                  setImportDialog({ type, data });
              } catch (error) {
                  toast({ variant: 'destructive', title: 'Error de Importación', description: (error as Error).message });
              }
          };
          reader.readAsText(file);
          event.target.value = '';
      }
  };

  const convertToCsv = (data: any[], headers: string[]): string => {
        const csvRows = [];
        csvRows.push(headers.join(','));

        for (const row of data) {
            const values = headers.map(header => {
                let value = row[header];
                if (header === 'playerIds' && Array.isArray(value)) {
                    value = value.join(';');
                }
                if (value === null || value === undefined) {
                    value = '';
                }
                const stringValue = String(value);
                if (stringValue.includes(',')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            });
            csvRows.push(values.join(','));
        }
        return csvRows.join('\n');
    }

    const downloadFile = (content: string, filename: string, contentType: string) => {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

  const handleExportPlayers = () => {
        const headers = ['id', 'name', 'number', 'position'];
        const csv = convertToCsv(players, headers);
        downloadFile(csv, 'players.csv', 'text/csv;charset=utf-8;');
        toast({ title: 'Jugadores exportados a CSV' });
  };
  
  const handleExportTeam = (team: Team) => {
    const headers = ['id', 'name', 'playerIds'];
    const csv = convertToCsv([team], headers);
    const filename = `equipo_${team.name.replace(/\s/g, '_')}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
    toast({ title: `Equipo "${team.name}" exportado a CSV` });
  }

  async function confirmImport() {
    if (!importDialog) return;
    const { type, data } = importDialog;
    let newItemsCount = 0;

    if (type === 'players') {
        const typedData = data as Player[];
        newItemsCount = await importPlayers(typedData);
        const updatedPlayers = await getPlayers();
        setPlayers(updatedPlayers);
    } else {
        const typedData = data as Team[];
        newItemsCount = await importTeams(typedData);
        const updatedTeams = await getTeams();
        setTeams(updatedTeams);
    }
    toast({ title: '¡Importación completada!', description: `${newItemsCount} nuevos elementos añadidos a la base de datos.` });
    setImportDialog(null);
  };
  
  if (isLoading) {
    return <LoadingModal />;
  }


  return (
    <>
    {(isSharing || playerToShare) && <LoadingModal text="Generando imagen..." />}
    <div className="fixed -left-[9999px] top-0">
      {playerToShare && <PlayerShareCard ref={shareCardRef} player={playerToShare} />}
    </div>

    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Gestión de Plantilla</h1>
          <p className="text-muted-foreground">Gestiona tus jugadores y crea equipos para el día del partido.</p>
        </div>
      </div>

      <Tabs defaultValue="players" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="players">Jugadores</TabsTrigger>
          <TabsTrigger value="teams">Equipos</TabsTrigger>
        </TabsList>
        <TabsContent value="players" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
                <CardTitle>Añadir Nuevo Jugador</CardTitle>
            </CardHeader>
            <CardContent>
                <Form {...playerForm}>
                    <form onSubmit={playerForm.handleSubmit(onPlayerSubmit)} className="space-y-3">
                        <FormField
                        control={playerForm.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Nombre del Jugador</FormLabel>
                            <FormControl>
                                <Input placeholder="Nombre del Jugador" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <FormField
                            control={playerForm.control}
                            name="number"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Número</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="Ej: 7, 23 (opcional)" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={playerForm.control}
                            name="position"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Posición</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="-- Seleccionar Posición (Opcional) --" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Base">Base</SelectItem>
                                        <SelectItem value="Escolta">Escolta</SelectItem>
                                        <SelectItem value="Alero">Alero</SelectItem>
                                        <SelectItem value="Ala-Pívot">Ala-Pívot</SelectItem>
                                        <SelectItem value="Pívot">Pívot</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                           <Button type="button" variant="ghost" onClick={() => playerForm.reset({ name: '', number: undefined, position: '' })}>
                               <X className="mr-2 h-4 w-4" /> Limpiar
                            </Button>
                            <Button type="submit">
                                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Jugador
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
          </Card>
          
          <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
            <AccordionItem value="item-1" className="border rounded-lg">
                <AccordionTrigger className="px-6 py-4">
                    <div className="flex flex-col items-start">
                        <span className="text-lg font-semibold">Plantilla de Jugadores ({players.length})</span>
                        <span className="text-sm font-normal text-muted-foreground">Añade, edita o importa tu lista de jugadores.</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="px-6 pb-6 pt-2 space-y-4">
                        <div className="flex gap-2">
                            <input type="file" ref={playerFileInputRef} className="hidden" accept=".csv,.json" onChange={(e) => handleFileChange(e, 'players')} />
                            <Button variant="outline" size="sm" onClick={() => playerFileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Importar</Button>
                            <Button variant="outline" size="sm" onClick={handleExportPlayers}><Download className="mr-2 h-4 w-4" /> Exportar (CSV)</Button>
                        </div>
                        {selectedPlayerIds.size > 0 && (
                            <div className="flex items-center justify-between p-2 bg-secondary rounded-md">
                                <span className="text-sm font-medium">{selectedPlayerIds.size} jugador{selectedPlayerIds.size > 1 ? 'es' : ''} seleccionado{selectedPlayerIds.size > 1 ? 's' : ''}</span>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" disabled={isGuest}><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción eliminará a {selectedPlayerIds.size} jugador{selectedPlayerIds.size > 1 ? 'es' : ''} de tu plantilla y de todos los equipos.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deletePlayers(Array.from(selectedPlayerIds))}>Eliminar Jugadores</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        )}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar por nombre..." 
                                className="pl-8"
                                value={playerSearch}
                                onChange={(e) => setPlayerSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="p-0">
                        <div className="divide-y divide-border border-t">
                            <div className="flex items-center justify-between py-3 px-6 font-medium bg-muted/50">
                                <div className="flex items-center gap-4">
                                    <Checkbox 
                                        id="select-all-players"
                                        checked={selectedPlayerIds.size === filteredPlayers.length && filteredPlayers.length > 0}
                                        onCheckedChange={() => handleTogglePlayerSelection('', true, filteredPlayers.map(p => p.id))}
                                    />
                                    <Label htmlFor="select-all-players">Jugador</Label>
                                </div>
                                <span>Acciones</span>
                            </div>
                            {filteredPlayers.length > 0 ? filteredPlayers.map(player => (
                            <div key={player.id} className="flex items-center justify-between py-3 px-6 hover:bg-muted/50">
                                <div className="flex items-center gap-4">
                                    <Checkbox 
                                        id={`player-${player.id}`}
                                        checked={selectedPlayerIds.has(player.id)}
                                        onCheckedChange={() => handleTogglePlayerSelection(player.id)}
                                    />
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-bold text-lg">
                                        {player.number ?? '-'}
                                    </div>
                                    <div>
                                        <span className="font-medium text-base">{player.name}</span>
                                        {player.position && <p className="text-sm text-muted-foreground">{player.position}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => setPlayerToShare(player)}>
                                        <Share2 className="h-4 w-4" />
                                        <span className="sr-only">Compartir {player.name}</span>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleEditPlayer(player)}>
                                        <Edit className="h-4 w-4 text-primary" />
                                        <span className="sr-only">Editar {player.name}</span>
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" disabled={isGuest}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                <span className="sr-only">Eliminar {player.name}</span>
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción es permanente y eliminará a <strong>{player.name}</strong> de tu plantilla y de todos los equipos.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => deletePlayers([player.id])}>Eliminar Jugador</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                            )) : (
                                <p className="py-4 px-6 text-muted-foreground">No se encontraron jugadores. ¡Añade uno arriba!</p>
                            )}
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
        </TabsContent>
        <TabsContent value="teams" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
               <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Equipos ({teams.length})</CardTitle>
                    <CardDescription>Crea equipos y asigna jugadores de tu plantilla.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                       <input type="file" ref={teamFileInputRef} className="hidden" accept=".csv,.json" onChange={(e) => handleFileChange(e, 'teams')} />
                      <Button variant="outline" size="sm" onClick={() => teamFileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Importar</Button>
                  </div>
              </div>
                {selectedTeamIds.size > 0 && (
                <div className="flex items-center justify-between p-2 mt-4 bg-secondary rounded-md">
                    <span className="text-sm font-medium">{selectedTeamIds.size} equipo{selectedTeamIds.size > 1 ? 's' : ''} seleccionado{selectedTeamIds.size > 1 ? 's' : ''}</span>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="sm" disabled={isGuest}><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción eliminará {selectedTeamIds.size} equipo{selectedTeamIds.size > 1 ? 's' : ''}.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteTeams(Array.from(selectedTeamIds))}>Eliminar Equipos</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
               )}
               <div className="pt-4">
                <Button onClick={handleCreateTeam}><PlusCircle className="mr-2 h-4 w-4" /> Crear Equipo</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                 {teams.length === 0 && (
                    <p className="py-4 text-center text-muted-foreground">No has creado ningún equipo todavía.</p>
                )}
                {teams.map(team => (
                  <Card key={team.id} className="p-4">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <Checkbox
                                id={`team-${team.id}`}
                                checked={selectedTeamIds.has(team.id)}
                                onCheckedChange={() => handleToggleTeamSelection(team.id)}
                            />
                            <div>
                                <h3 className="font-semibold text-lg">{team.name}</h3>
                                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                    <Users className="h-4 w-4"/>
                                    {team.playerIds.length} jugador{team.playerIds.length !== 1 ? 'es' : ''}
                                </p>
                            </div>
                         </div>
                         <div className="flex gap-2">
                             <Button variant="outline" size="sm" onClick={() => handleEditTeam(team)}>Editar</Button>
                             <Button variant="outline" size="sm" onClick={() => handleExportTeam(team)}><Download className="mr-2 h-4 w-4" />Exportar</Button>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" disabled={isGuest}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                        <span className="sr-only">Eliminar {team.name}</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                           Esta acción es permanente y eliminará el equipo <strong>{team.name}</strong>. Los jugadores permanecerán en tu plantilla global.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteTeams([team.id])}>Eliminar Equipo</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                         </div>
                      </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    {editingPlayer && (
        <PlayerFormModal
            player={editingPlayer}
            onSave={onPlayerSubmit}
            onCancel={() => setEditingPlayer(null)}
        />
    )}
    {editingTeam && (
        <TeamForm 
            team={editingTeam}
            players={players}
            allTeams={teams}
            onSave={handleSaveTeam}
            onCancel={() => setEditingTeam(null)}
        />
    )}
    {importDialog && (
        <ImportDialog
            isOpen={!!importDialog}
            onClose={() => setImportDialog(null)}
            onConfirm={confirmImport}
            itemCount={importDialog.data.length}
            itemType={importDialog.type === 'players' ? 'jugadores' : 'equipos'}
        />
    )}
    </>
  );
}
