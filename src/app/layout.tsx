import { GoogleTagManager } from '@next/third-parties/google' 
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { AppNavbar } from '@/app/components/AppNavbar'
import { Sidebar } from '@/components/sidebar'
import { StackedLayout } from '@/components/stacked-layout'
import Footer from '@/components/Footer';
import "./globals.css";
import BackgroundShapes from '@/app/components/BackgroundShapes';

export { metadata } from './(landing)/metadata';

// Set NEXT_PUBLIC_DISABLE_ANALYTICS=1 at build time for a private, local deployment:
// it drops Google Tag Manager and the Vercel analytics scripts.
const analyticsEnabled = process.env.NEXT_PUBLIC_DISABLE_ANALYTICS !== '1';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950">
      <head>
        {analyticsEnabled && <GoogleTagManager gtmId="GTM-M82SLQZ6" />}
      </head>

      <body className="">
        {analyticsEnabled && <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-M82SLQZ6" height="0" width="0" style={{ display: "none", visibility: "hidden" }}></iframe></noscript>}

        <StackedLayout
          navbar={<AppNavbar />}
          sidebar={<Sidebar>{/* Your sidebar content */}</Sidebar>}
        >
          <BackgroundShapes />
          <div className="mx-auto max-w-7xl px-0 py-2 sm:py-4 lg:px-8 lg:py-5 relative">
            <div className="mx-auto max-w-4xl ">
              {children}
            </div>
          </div>

          <Footer />
        </StackedLayout>
        
        {analyticsEnabled && <Analytics />}
        {analyticsEnabled && <SpeedInsights />}
      </body>
    </html>
  );
}
