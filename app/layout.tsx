import type { Metadata, Viewport } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import { Navbar } from "../components/Navbar.tsx";
import { SnackbarProvider } from "../components/Snackbar.tsx";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", axes: ["opsz"] });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "E-Z Permit — your city permit roadmap",
  description: "Tell us your city and your business idea. Get a step-by-step checklist of the permits, licenses, costs and official links you need to open.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <SnackbarProvider>
          <Navbar />
          {children}
        </SnackbarProvider>
      </body>
    </html>
  );
}
