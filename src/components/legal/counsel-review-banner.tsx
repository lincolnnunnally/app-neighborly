export function CounselReviewBanner({ product }: { product: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-accent/40 bg-accent-soft/40 px-4 py-3 text-sm text-fg">
      <p className="font-medium">Pending legal review</p>
      <p className="mt-1 text-fg-muted">
        This is working product copy for {product} so real people can use the app. It is{" "}
        <strong>not</strong> attorney-reviewed and is <strong>not legal advice</strong>. United
        Under God will have counsel review Terms and Privacy before we advertise this
        product to the public. Questions:{" "}
        <a className="text-primary underline" href="mailto:lincoln@unitedundergod.org">
          lincoln@unitedundergod.org
        </a>
        .
      </p>
    </div>
  );
}
