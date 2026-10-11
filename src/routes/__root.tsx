import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { WalletProvider } from "@/lib/wallet";
import appCss from "../styles.css?url";

const APP_NAME = "FixySwap";

const CRITICAL_CSS =
  "html,body{margin:0;background:#060a14!important;color:#e8eef8!important;color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif}" +
  "body{min-height:100vh}a{color:inherit;text-decoration:none}";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: "Swap a token for a MetaDAO company token at a rate you set." },
      { name: "theme-color", content: "#060a14" },
      { name: "color-scheme", content: "dark" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <WalletProvider>
            <Outlet />
          </WalletProvider>
        </AuthProvider>
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(document.getElementById("fixy-css"))return;var l=document.createElement("link");l.id="fixy-css";l.rel="stylesheet";l.href=${JSON.stringify(appCss)};document.head.appendChild(l)})();`,
          }}
        />
      </body>
    </html>
  ),
});
