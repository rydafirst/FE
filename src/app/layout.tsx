import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Rydafirst — We are for riders',
  description: 'Guaranteed-payment delivery & rides.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: 'var(--bg)' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
