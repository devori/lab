import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '가계부 MVP | Devori Lab',
  description: '주말 배포를 위한 간단한 가계부 MVP입니다.'
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
