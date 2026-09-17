import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'ConverseIQ — Academic Meeting Intelligence Platform',
  description: 'Enterprise multi-speaker academic meeting transcription, editable MoM, and strategic action tracking.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased text-[#1C251E] bg-[#F8F7F2] min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
