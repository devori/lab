import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Devori Lab',
  description: 'Experiment, build, and deploy practical products.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
