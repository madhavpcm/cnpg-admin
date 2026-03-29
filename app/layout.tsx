import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
    title: 'CNPG Admin',
    description: 'CloudNativePG Admin Interface',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <div className="layout-container">
                    <Sidebar />
                    <main className="main-content">{children}</main>
                </div>
            </body>
        </html>
    );
}
