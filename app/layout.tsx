import type { Metadata } from 'next';
import './globals.css';
import ThemeToggle from '../components/ThemeToggle';

export const metadata: Metadata = {
  title: {
    default: 'Inventory System',
    template: '%s | Inventory System',
  },
  description: 'Multi-warehouse inventory management with concurrent reservation support',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}
        <ThemeToggle />
      </body>
    </html>
  );
}
