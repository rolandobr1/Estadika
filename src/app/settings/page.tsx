
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, Minus, Plus, AlertTriangle, ChevronsUpDown } from 'lucide-react';
import type { AppSettings, GameSettings, TimeoutMode } from '@/lib/types';
import { defaultAppSettings } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LoadingModal } from '@/components/ui/loader';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { produce } from 'immer';
import { useAuth } from '@/components/layout/auth-provider';
import { updateUserProfile } from '@/lib/auth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const GameSettingInput = ({ label, value, onChange, disabled = false, min = 0 }: { label: string, value: number, onChange: (value: number) => void, disabled?: boolean, min?: number }) => (
    <div className="flex flex-col items-center space-y-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => onChange(value - 1)} disabled={disabled || value <= min}>
                <Minus className="h-4 w-4" />
            </Button>
            <Input className="text-center w-20 h-9" readOnly value={String(value)} disabled={disabled} />
            <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => onChange(value + 1)} disabled={disabled}>
                <Plus className="h-4 w-4" />
            </Button>
        </div>
    </div>
);

export default function SettingsPage() {
    const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
    const [isLoading, setIsLoading] = useState(true);
    const [showResetDialog, setShowResetDialog] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();
    const [displayName, setDisplayName] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);


    useEffect(() => {
        if (typeof window === 'undefined') {
            setIsLoading(false);
            return;
        }

        if (user) {
            setDisplayName(user.displayName || '');
        }

        const storedSettings = localStorage.getItem('appSettings');
        if (storedSettings) {
            try {
                // Deep merge to ensure new default settings are applied if not present in storage
                const parsed = JSON.parse(storedSettings);
                
                const mergedSettings = produce(defaultAppSettings, draft => {
                     // Merge top-level settings
                    Object.assign(draft, parsed);

                    // Ensure gameSettings exists and merge it
                    if (parsed.gameSettings) {
                        draft.gameSettings = {
                            ...draft.gameSettings,
                            ...parsed.gameSettings,
                        };
                    }
                    
                    // Ensure timeoutSettings exists and merge it
                    if (parsed.gameSettings?.timeoutSettings) {
                         draft.gameSettings.timeoutSettings = {
                            ...draft.gameSettings.timeoutSettings,
                            ...parsed.gameSettings.timeoutSettings
                        };
                    } else {
                        // If old settings don't have timeoutSettings, apply the default one
                        draft.gameSettings.timeoutSettings = defaultAppSettings.gameSettings.timeoutSettings;
                    }
                });

                setSettings(mergedSettings);
            } catch (e) {
                 console.error("Failed to parse settings from localStorage", e);
                 setSettings(defaultAppSettings);
            }
        }
        setIsLoading(false);
    }, [user]);

    const handleSaveProfile = async () => {
        if (user?.isAnonymous) {
            toast({ variant: 'destructive', title: 'Función no disponible para invitados' });
            return;
        }
        if (!displayName.trim()) {
            toast({ variant: 'destructive', title: 'El nombre no puede estar vacío' });
            return;
        }

        setIsSavingProfile(true);
        try {
            await updateUserProfile(displayName);
            toast({ title: 'Perfil Actualizado', description: 'Tu nombre ha sido guardado.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar tu perfil.' });
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleSaveSettings = () => {
        if(typeof window !== 'undefined') {
            localStorage.setItem('appSettings', JSON.stringify(settings));
            toast({
                title: 'Configuración Guardada',
                description: 'Tus ajustes han sido guardados correctamente.',
            });
        }
    };
    
    const handleGameSettingChange = (field: keyof GameSettings, value: any) => {
         setSettings(prev => ({
            ...prev,
            gameSettings: {
                ...prev.gameSettings,
                [field]: value
            }
        }));
    };

    const handleTimeoutSettingChange = (field: keyof GameSettings['timeoutSettings'], value: any) => {
        setSettings(prev => ({
            ...prev,
            gameSettings: {
                ...prev.gameSettings,
                timeoutSettings: {
                    ...prev.gameSettings.timeoutSettings,
                    [field]: value,
                }
            }
        }));
    };
    
    const handleResetSettings = () => {
        if(typeof window !== 'undefined') {
            localStorage.removeItem('appSettings');
            setSettings(defaultAppSettings);
            setShowResetDialog(false);
            toast({
                title: 'Configuración Restablecida',
                description: 'Todos los ajustes han vuelto a sus valores por defecto.',
                variant: 'destructive',
            });
        }
    };

    if (isLoading) {
        return <LoadingModal />;
    }
    
    const { gameSettings } = settings;

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-primary">Configuración</h1>
                <p className="text-muted-foreground">Personaliza las reglas de los partidos y la interfaz de juego.</p>
            </div>

            <div className="space-y-8">
                 <Card>
                    <CardHeader>
                        <CardTitle>Perfil de Usuario</CardTitle>
                         <CardDescription>Edita tu nombre de usuario.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">Nombre</Label>
                            <Input
                                id="displayName"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Tu nombre"
                                disabled={user?.isAnonymous || isSavingProfile}
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleSaveProfile} disabled={user?.isAnonymous || isSavingProfile}>
                                <Save className="mr-2 h-4 w-4" />
                                {isSavingProfile ? 'Guardando...' : 'Guardar Perfil'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                
                 <Card>
                    <CardHeader>
                        <CardTitle>Ajustes Generales del Partido</CardTitle>
                        <CardDescription>Estos ajustes se aplicarán por defecto a todos los nuevos partidos que crees.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>
                                  <div className="text-lg font-semibold">Tiempo de Juego</div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-4">
                                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                        <GameSettingInput label="Número de Cuartos" value={gameSettings.quarters} onChange={val => handleGameSettingChange('quarters', val)} min={1}/>
                                        <GameSettingInput label="Duración del Cuarto (min)" value={gameSettings.quarterLength} onChange={val => handleGameSettingChange('quarterLength', val)} min={1}/>
                                        <GameSettingInput label="Duración Prórroga (min)" value={gameSettings.overtimeLength} onChange={val => handleGameSettingChange('overtimeLength', val)} min={1}/>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                             <AccordionItem value="item-2">
                                <AccordionTrigger>
                                   <div className="text-lg font-semibold">Tiempos Muertos</div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-4 space-y-6">
                                    <div className='space-y-4'>
                                        <Label className="font-semibold">Modo de Tiempos Muertos</Label>
                                        <RadioGroup
                                            value={gameSettings.timeoutSettings.mode}
                                            onValueChange={(value) => handleTimeoutSettingChange('mode', value as TimeoutMode)}
                                            className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                        >
                                            <Label htmlFor="tm-per-quarter" className={cn("p-4 rounded-lg border-2 cursor-pointer", gameSettings.timeoutSettings.mode === 'per_quarter' && 'border-primary bg-primary/5')}>
                                                 <div className="flex items-center gap-3">
                                                    <RadioGroupItem value="per_quarter" id="tm-per-quarter" />
                                                    <span className="font-semibold">Por Cuarto (Igual)</span>
                                                </div>
                                            </Label>
                                            <Label htmlFor="tm-per-quarter-custom" className={cn("p-4 rounded-lg border-2 cursor-pointer", gameSettings.timeoutSettings.mode === 'per_quarter_custom' && 'border-primary bg-primary/5')}>
                                                 <div className="flex items-center gap-3">
                                                    <RadioGroupItem value="per_quarter_custom" id="tm-per-quarter-custom" />
                                                    <span className="font-semibold">Por Cuarto (Personalizado)</span>
                                                </div>
                                            </Label>
                                            <Label htmlFor="tm-per-half" className={cn("p-4 rounded-lg border-2 cursor-pointer", gameSettings.timeoutSettings.mode === 'per_half' && 'border-primary bg-primary/5')}>
                                                <div className="flex items-center gap-3">
                                                    <RadioGroupItem value="per_half" id="tm-per-half" />
                                                    <span className="font-semibold">Por Mitad</span>
                                                </div>
                                            </Label>
                                            <Label htmlFor="tm-total" className={cn("p-4 rounded-lg border-2 cursor-pointer", gameSettings.timeoutSettings.mode === 'total' && 'border-primary bg-primary/5')}>
                                                 <div className="flex items-center gap-3">
                                                    <RadioGroupItem value="total" id="tm-total" />
                                                    <span className="font-semibold">Total por Partido</span>
                                                </div>
                                            </Label>
                                        </RadioGroup>
                                    </div>
                                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-4">
                                        <div className={cn("transition-opacity", gameSettings.timeoutSettings.mode !== 'per_quarter' && 'opacity-50')}>
                                            <GameSettingInput label="Tiempos por Cuarto" value={gameSettings.timeoutSettings.timeoutsPerQuarter} onChange={val => handleTimeoutSettingChange('timeoutsPerQuarter', val)} disabled={gameSettings.timeoutSettings.mode !== 'per_quarter'} />
                                        </div>
                                        <div className={cn("transition-opacity col-span-1 sm:col-span-2 grid grid-cols-2 gap-6", gameSettings.timeoutSettings.mode !== 'per_half' && 'opacity-50')}>
                                            <GameSettingInput label="Tiempos (1ª Mitad)" value={gameSettings.timeoutSettings.timeoutsFirstHalf} onChange={val => handleTimeoutSettingChange('timeoutsFirstHalf', val)} disabled={gameSettings.timeoutSettings.mode !== 'per_half'} />
                                            <GameSettingInput label="Tiempos (2ª Mitad)" value={gameSettings.timeoutSettings.timeoutsSecondHalf} onChange={val => handleTimeoutSettingChange('timeoutsSecondHalf', val)} disabled={gameSettings.timeoutSettings.mode !== 'per_half'} />
                                        </div>
                                        <div className={cn("transition-opacity", gameSettings.timeoutSettings.mode !== 'total' && 'opacity-50')}>
                                            <GameSettingInput label="Tiempos Totales" value={gameSettings.timeoutSettings.timeoutsTotal} onChange={val => handleTimeoutSettingChange('timeoutsTotal', val)} disabled={gameSettings.timeoutSettings.mode !== 'total'} />
                                        </div>
                                        <GameSettingInput label="Tiempos (Prórroga)" value={gameSettings.timeoutsOvertime} onChange={val => handleGameSettingChange('timeoutsOvertime', val)} />
                                    </div>
                                     <div className={cn("pt-4 space-y-4", gameSettings.timeoutSettings.mode !== 'per_quarter_custom' && 'hidden')}>
                                         <Label className="font-semibold">Tiempos Muertos por Cuarto</Label>
                                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {Array.from({ length: gameSettings.quarters }).map((_, i) => (
                                                 <GameSettingInput
                                                    key={i}
                                                    label={`Cuarto ${i + 1}`}
                                                    value={gameSettings.timeoutSettings.timeoutsPerQuarterValues[i] || 0}
                                                    onChange={(val) => {
                                                        const newValues = [...gameSettings.timeoutSettings.timeoutsPerQuarterValues];
                                                        newValues[i] = val;
                                                        handleTimeoutSettingChange('timeoutsPerQuarterValues', newValues);
                                                    }}
                                                    disabled={gameSettings.timeoutSettings.mode !== 'per_quarter_custom'}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    </AccordionContent>
                            </AccordionItem>
                             <AccordionItem value="item-3" className="border-b-0">
                                <AccordionTrigger>
                                  <div className="text-lg font-semibold">Reglas de Faltas</div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-4 space-y-6">
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <GameSettingInput label="Faltas para Bonus" value={gameSettings.foulsToBonus} onChange={val => handleGameSettingChange('foulsToBonus', val)} min={1}/>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>

                 <div className="flex justify-between items-center mt-8">
                    <Button variant="destructive" onClick={() => setShowResetDialog(true)}>
                        <AlertTriangle className="mr-2 h-4 w-4" /> Restablecer Ajustes
                    </Button>
                    <Button size="lg" onClick={handleSaveSettings}>
                        <Save className="mr-2 h-4 w-4" /> Guardar Configuración
                    </Button>
                </div>
            </div>
            
            <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción restablecerá todos los ajustes a sus valores por defecto. No se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowResetDialog(false)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetSettings}>Sí, restablecer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
