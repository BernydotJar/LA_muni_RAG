import type { DomainPack, DomainPackId, DomainPackSummary } from "./types.js";
import { validateDomainPack } from "./validation.js";
import {
  customDomainPack,
  financeDomainPack,
  hrDomainPack,
  municipalAntiguaDomainPack,
  salesSopDomainPack,
} from "./packs/index.js";

export const DEFAULT_DOMAIN_PACK_ID: DomainPackId = "municipal-antigua";

const packs = [
  municipalAntiguaDomainPack,
  hrDomainPack,
  financeDomainPack,
  salesSopDomainPack,
  customDomainPack,
].map(validateDomainPack);

export const DOMAIN_PACKS: Readonly<Record<DomainPackId, DomainPack>> = Object.freeze(
  packs.reduce(
    (acc, pack) => ({ ...acc, [pack.id]: pack }),
    {} as Record<DomainPackId, DomainPack>
  )
);

export class DomainPackConfigError extends Error {
  readonly code = "invalid_domain_pack";

  constructor(value: string) {
    super(`Unsupported DOMAIN_PACK: ${value}`);
    this.name = "DomainPackConfigError";
  }
}

export const listDomainPacks = (): DomainPackSummary[] =>
  Object.values(DOMAIN_PACKS).map((pack) => ({
    id: pack.id,
    name: pack.name,
    language: pack.language,
    branding: pack.branding,
  }));

export const summarizeDomainPack = (pack: DomainPack): DomainPackSummary => ({
  id: pack.id,
  name: pack.name,
  language: pack.language,
  branding: pack.branding,
});

export const summarizeDomainPackForUi = (pack: DomainPack) => ({
  ...summarizeDomainPack(pack),
  workflowTypes: pack.workflowTypes.map((workflowType) => ({
    id: workflowType.id,
    label: workflowType.label,
    description: workflowType.description,
  })),
  exampleQueries: pack.exampleQueries,
  defaultQuery: pack.exampleQueries[0] ?? "",
});

export const loadDomainPack = (id: string | undefined | null): DomainPack => {
  const normalized = id?.trim() || DEFAULT_DOMAIN_PACK_ID;
  const pack = DOMAIN_PACKS[normalized as DomainPackId];
  if (!pack) throw new DomainPackConfigError(normalized);
  return pack;
};

export const loadActiveDomainPack = (env: { DOMAIN_PACK?: string } = process.env): DomainPack =>
  loadDomainPack(env.DOMAIN_PACK);

export type { DomainPack, DomainPackId, DomainPackSummary, DomainDocumentMetadata } from "./types.js";
