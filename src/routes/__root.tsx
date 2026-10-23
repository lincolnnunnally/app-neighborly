import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { NotFoundPage } from "@/components/layout/not-found";
import { loadSavedPlace } from "@/lib/community/place-cookie";
import { ldJson, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

const MENU_TAP_BEFORE_READY = `window.addEventListener("click",function(e){if(window.__nbMenuReady)return;var t=e.target;var b=t&&t.closest&&t.closest('[aria-controls="site-menu"]');if(b){window.__nbMenuTap=true;e.stopPropagation();}},true);`;

export const Route = createRootRoute({
  // The visitor's saved town (cookie), so the header's place links render right on the server.
  loader: { staleReloadMode: "blocking", handler: async () => ({ savedPlace: await loadSavedPlace() }) },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#2f5d50" },
      { property: "og:site_name", content: "Neighborly" },
      ldJson(organizationJsonLd),
      ldJson(websiteJsonLd),
      { property: "og:image", content: "https://neighborly.unitedundergod.org/img/vidalia/fountain.jpg" },
      {
        title: "Neighborly — what's on this weekend, and the neighbors who'll be there",
      },
      {
        name: "description",
        content:
          "Find festivals, shows, park days, and neighbor gatherings near you this weekend. Type a ZIP or city to start. Browsing is free; join when you want to RSVP or lend a hand.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "stylesheet", href: appCss },
    ],
    // A tap on ☰ before the page has finished loading its script used to be lost
    // (no click handler yet). Note it here; the header opens the menu once it's ready.
    scripts: [{ children: MENU_TAP_BEFORE_READY }],
  }),
  component: RootComponent,
  notFoundComponent: () => <NotFoundPage />,
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          <Outlet />
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
