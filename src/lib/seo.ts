/**
 * Search and share-card helpers. Every line here must be true today: no
 * counts, ratings, addresses or promises the app does not back up.
 */
export const SITE_URL = "https://neighborly.unitedundergod.org";
export const SITE_NAME = "Neighborly";

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/favicon.svg`,
  description: "Help when you can. Ask when you need. Belong where you live.",
  // The site footer: "A United Under God project".
  parentOrganization: { "@type": "Organization", name: "United Under God" },
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  publisher: { "@id": ORGANIZATION_ID },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

/** A free community service Neighborly provides. `areaServed` only when the listings are local. */
export function serviceJsonLd(opts: {
  path: string;
  name: string;
  description: string;
  serviceType: string;
  areaServed?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    serviceType: opts.serviceType,
    url: `${SITE_URL}${opts.path}`,
    description: opts.description,
    provider: { "@id": ORGANIZATION_ID },
    ...(opts.areaServed?.length
      ? { areaServed: opts.areaServed.map((name) => ({ "@type": "AdministrativeArea", name })) }
      : {}),
  };
}

export type Faq = { q: string; a: string };

export function faqJsonLd(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

type MetaTag = React.JSX.IntrinsicElements["meta"];

/** TanStack renders `{ "script:ld+json": data }` meta entries as a JSON-LD script; its head typing omits it. */
export function ldJson(data: object): MetaTag {
  return { "script:ld+json": data } as unknown as MetaTag;
}

/** Canonical link on the production host. Root sets none, so each page's own is the only one. */
export function canonicalLinks(path: string) {
  return [{ rel: "canonical", href: `${SITE_URL}${path}` }];
}

/** og:url + Twitter card tags that mirror a page's own title/description. */
export function shareMeta(path: string, title: string, description: string): MetaTag[] {
  return [
    { property: "og:type", content: "website" },
    { property: "og:url", content: `${SITE_URL}${path}` },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}

export function pageHead(opts: {
  path: string;
  title: string;
  description: string;
  jsonLd?: object[];
}) {
  return {
    meta: [
      { title: opts.title } as MetaTag,
      { name: "description", content: opts.description },
      ...shareMeta(opts.path, opts.title, opts.description),
      ...(opts.jsonLd ?? []).map(ldJson),
    ],
    links: canonicalLinks(opts.path),
  };
}
