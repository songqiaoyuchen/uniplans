import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import "@/styles/globals.css";
import Navbar from "@/components/layout/Navbar";
import Toolbar from "@mui/material/Toolbar";
import Providers from "@/providers";
import Box from "@mui/material/Box";
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: "Uniplans",
  description: "NUS Course Planning Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <Providers>
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              <Navbar />
              <Toolbar />
                {children}
                <Analytics />
            </Box>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
