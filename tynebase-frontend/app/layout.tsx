import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

export const metadata: Metadata = {
  title: "TyneBase - Knowledge that scales with your team",
  description: "Multi-tenant knowledge management platform with AI-assisted document generation, community discussions, and white-label branding.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700&family=Bangers&family=Barlow:wght@400;500;600;700&family=Bebas+Neue&family=Bitter:wght@400;500;600;700&family=Cabin:wght@400;500;600;700&family=Caveat:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600;700&family=Crimson+Text:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&family=EB+Garamond:wght@400;500;600;700&family=Exo+2:wght@400;500;600;700&family=Fira+Code:wght@400;500;600&family=Fredoka:wght@400;500;600;700&family=Great+Vibes&family=IBM+Plex+Mono:wght@400;500;600&family=Inconsolata:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Josefin+Sans:wght@400;500;600;700&family=Karla:wght@400;500;600;700&family=Lato:wght@400;700&family=Lexend:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&family=Lobster&family=Lora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;500;600;700&family=Mulish:wght@400;500;600;700&family=Noto+Serif:wght@400;500;600;700&family=Nunito:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=PT+Serif:wght@400;700&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Righteous&family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500;600&family=Rubik:wght@400;500;600;700&family=Satisfy&family=Source+Code+Pro:wght@400;500;600&family=Source+Sans+3:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Spectral:wght@400;500;600;700&family=Ubuntu:wght@400;500;700&family=Vollkorn:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
