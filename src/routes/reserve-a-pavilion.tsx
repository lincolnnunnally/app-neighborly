import { createFileRoute } from "@tanstack/react-router";
import { FeaturePage } from "@/components/community/feature-page";
import { featureByPath } from "@/lib/features";
import { faqJsonLd, pageHead, serviceJsonLd } from "@/lib/seo";

const feature = featureByPath("/reserve-a-pavilion");

export const Route = createFileRoute("/reserve-a-pavilion")({
  head: () =>
    pageHead({
      path: feature.path,
      title: feature.title,
      description: feature.description,
      jsonLd: [
        serviceJsonLd({
          path: feature.path,
          name: feature.h1,
          description: feature.description,
          serviceType: feature.serviceType,
          areaServed: feature.areaServed,
        }),
        faqJsonLd(feature.faqs),
      ],
    }),
  component: () => <FeaturePage feature={feature} />,
});
