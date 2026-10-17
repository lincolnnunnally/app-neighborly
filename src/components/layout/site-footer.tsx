import { Link } from "@tanstack/react-router";

export const PHOTO_CREDITS =
  "Photos: water tower by Geogre (public domain); downtown park fountain, amphitheater and Municipal Building by Michael Rivera (CC BY-SA 4.0); Vidalia onions by ryan griffis (CC BY-SA 2.0); New Branch United Methodist Church by Michael Rivera (CC BY-SA 4.0); coffee by Artem Beliaikin (CC BY 2.0); pickleball courts by Wikideas1 (CC0); Midtown Atlanta from Piedmont Park by Thomson200 (CC0); downtown Conyers by formulanone (CC BY-SA 2.0); Rockdale County Courthouse by Skarg (CC BY 2.5), via Wikimedia Commons.";

export function SiteFooter({ credits = false }: { credits?: boolean }) {
  return (
    <footer className="border-t border-border py-10 text-base text-fg-muted">
      <div className="page-shell space-y-3">
        <p>
          <strong className="text-fg">Neighborly</strong> · Help when you can. Ask when you need. Belong where you
          live. · A United Under God project
        </p>
        <nav aria-label="Footer" className="-mx-2 flex flex-wrap gap-x-2">
          <Link to="/about" className="tap px-2 text-fg-muted no-underline hover:text-fg">
            About
          </Link>
          <Link to="/how-it-works" className="tap px-2 text-fg-muted no-underline hover:text-fg">
            How it works
          </Link>
          <Link to="/privacy" className="tap px-2 text-fg-muted no-underline hover:text-fg">
            Privacy
          </Link>
          <Link to="/terms" className="tap px-2 text-fg-muted no-underline hover:text-fg">
            Terms
          </Link>
          <Link to="/help" className="tap px-2 text-fg-muted no-underline hover:text-fg">
            Need help?
          </Link>
        </nav>
        {credits && <p className="text-xs leading-relaxed text-fg-muted">{PHOTO_CREDITS}</p>}
      </div>
    </footer>
  );
}
