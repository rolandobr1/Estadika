
import type { Metadata } from 'next';
import '../globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'CourtVision Stats - Espectador',
  description: 'Marcador en vivo del partido.',
};

// This is a new root layout specifically for the spectator section.
// It does NOT include the main <Header />, isolating this page
// to prevent hydration errors caused by conflicting layouts.
export default function SpectatorRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
       <body className={cn("min-h-screen bg-background font-body antialiased", inter.variable)}>
         <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
