/**
 * Build URL search params for unit slug.
 * Used by teacher Copy Link and scholar New Project to construct
 * `/scholar/new?unit=X` URLs.
 *
 * Phase 1: only unitId — individual dimensions come from the unit.
 */
export function buildDimensionParams(
  ids: {
    unitId?: string | null;
  },
  lists: {
    units: { _id: string; slug?: string }[];
  }
): string {
  const params: string[] = [];
  if (ids.unitId) {
    const u = lists.units.find((e) => e._id === ids.unitId);
    if (u?.slug) params.push(`unit=${u.slug}`);
  }
  return params.length ? params.join("&") : "";
}
