import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
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
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootComponent,
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
