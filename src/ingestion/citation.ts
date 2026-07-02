export interface CitationInput {
  title: string;
  sectionPath?: string[];
  heading?: string | null;
  pageStart?: number | null;
  articleNumber?: string | null;
}

export const buildCitationLabel = ({
  title,
  sectionPath = [],
  heading,
  pageStart,
  articleNumber,
}: CitationInput): string => {
  const parts = [title];

  if (articleNumber) {
    parts.push(`articulo ${articleNumber}`);
  } else if (pageStart !== undefined && pageStart !== null) {
    parts.push(`pagina ${pageStart}`);
  } else if (sectionPath.length > 0) {
    parts.push(sectionPath.join(" > "));
  } else if (heading) {
    parts.push(heading);
  }

  return parts.join(", ");
};
