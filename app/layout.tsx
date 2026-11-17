import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "trilogy - your money's personal assistant",
  description: "texts you like a friend. keeps you aware. will roast you sometimes. weekly imessage with what matters most.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Before first paint: skip the intro curtain on repeat visits or for reduced-motion users. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `try{if(sessionStorage.getItem('trilogy-intro')||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('intro-seen')}catch(e){document.documentElement.classList.add('intro-seen')}`,
            }}
          />
          <Script id="microsoft-clarity" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "ueecsqi12a");
            `}
          </Script>
          <noscript>
            <style>{`[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}.intro-curtain{display:none!important}.chaos-final{opacity:1!important;transform:none!important}`}</style>
          </noscript>
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
        </body>
      </html>
  );
}
