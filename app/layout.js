import "./globals.css";

export const metadata = {
  title: "Rhythm",
  description: "An adaptive household schedule. Goals + a completion log — everything else is computed.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport = {
  themeColor: "#f6f2e7",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
