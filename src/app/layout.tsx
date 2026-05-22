import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ThemeProvider from '../components/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CineFilme — Recomendações de Cinema',
  description: 'Sistema de recomendação de filmes baseado em grafos e filtragem colaborativa.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Anti-FOUC: apply dark class before paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('cinefilme-theme');if(t!=='light')document.documentElement.classList.add('dark');}catch(e){}})();` }} />

        {/* Google Fonts: Fraunces italic 700 + JetBrains Mono 500 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,700&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />

        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
