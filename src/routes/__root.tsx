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
        title: "Neighborly — Community connections for Milstead & beyond",
      },
      {
        name: "description",
        content:
          "Neighbors helping neighbors. Post a need, offer a skill, join events, and welcome new residents — starting with Milstead as the first test market.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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
