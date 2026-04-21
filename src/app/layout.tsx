import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Slowi Music',
  description: 'Personal Google Drive Music Player — NEURAL_AUDIO Experience',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased" style={{ background: '#0a0e14', color: '#f1f3fc' }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
