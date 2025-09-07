
'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useOnlineStatus } from '@/hooks/use-online-status';

export function OnlineStatusIndicator() {
  const isOnline = useOnlineStatus();
  const { toast, dismiss } = useToast();
  const [offlineToastId, setOfflineToastId] = useState<string | null>(null);

  useEffect(() => {
    if (isOnline) {
      if (offlineToastId) {
        // Dismiss the "offline" toast
        dismiss(offlineToastId);
        setOfflineToastId(null);

        // Show a "back online" toast
        toast({
          title: 'Estás en línea de nuevo',
          description: 'Tus datos se han sincronizado con la nube.',
        });
      }
    } else {
      // We are offline, show a persistent toast
      const { id } = toast({
        variant: 'destructive',
        title: 'Estás sin conexión',
        description: 'No te preocupes, los cambios se guardarán localmente y se sincronizarán cuando vuelvas a conectarte.',
        duration: Infinity, // Keep it open until dismissed
      });
      setOfflineToastId(id);
    }

    // Cleanup on component unmount
    return () => {
      if (offlineToastId) {
        dismiss(offlineToastId);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]); // We only want to run this effect when `isOnline` changes.

  return null; // This component doesn't render anything itself
}
