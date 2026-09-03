import type { Metadata } from "next";
import "./globals.css";

function getMetadataBase(): URL {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    try {
      return new URL(configuredSiteUrl);
    } catch {
      // Keep metadata generation build-safe when a deployment URL is malformed.
    }
  }

  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "BladeBook — Live Beyblade Market",
    template: "%s | BladeBook",
  },
  description: "Back your blade. Watch the market move in real time.",
  openGraph: {
    title: "BladeBook — Live Beyblade Market",
    description: "Back your blade. Watch the market move.",
    type: "website",
    images: [{ url: "/og.png", width: 1729, height: 910, alt: "BladeBook live market" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BladeBook — Live Beyblade Market",
    description: "Back your blade. Watch the market move.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
