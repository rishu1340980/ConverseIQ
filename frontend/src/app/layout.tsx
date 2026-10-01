import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';
import ThemeProvider from '@/components/ThemeProvider';

export const metadata: Metadata = {
  metadataBase: new URL('https://converse-iq.vercel.app'),
  title: {
    default: 'ConverseIQ — Academic Meeting Intelligence Platform',
    template: '%s | ConverseIQ',
  },
  description: 'Enterprise multi-speaker academic meeting transcription, automated editable MoM generation, decision tracking, and strategic action items.',
  keywords: [
    'academic meeting transcription',
    'minutes of meeting generator',
    'higher education intelligence',
    'MoM automation',
    'meeting summary AI',
    'faculty action tracker',
  ],
  authors: [{ name: 'ConverseIQ Team' }],
  creator: 'ConverseIQ',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://converse-iq.vercel.app',
    siteName: 'ConverseIQ',
    title: 'ConverseIQ — Academic Meeting Intelligence Platform',
    description: 'Transform academic faculty and department meetings into structured Minutes of Meeting, verified decisions, and action trackers using AI.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ConverseIQ — Academic Meeting Intelligence Platform',
    description: 'Automate MoM, speaker diarization, and strategic follow-ups for academic institutions.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#78A98F' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1A15' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Prevent dark mode flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('converseiq_theme');
            if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.classList.add('dark');
            }
          } catch(e) {}
        `}} />
      </head>
      <body className="antialiased min-h-screen bg-[#F5FAF8] dark:bg-[#0F1A15] text-[#173A2C] dark:text-[#E8F0EC]">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
