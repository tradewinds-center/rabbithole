/**
 * Build URL search params for dimension slugs.
 * Used by teacher Copy Link and scholar New Project to construct
 * `/scholar/new?persona=X&unit=Y&...` URLs.
 */
export function buildDimensionParams(
  ids: {
    personaId?: string | null;
    unitId?: string | null;
    perspectiveId?: string | null;
    processId?: string | null;
  },
  lists: {
    personas: { _id: string; slug?: string }[];
    units: { _id: string; slug?: string }[];
    perspectives: { _id: string; slug?: string }[];
    processes: { _id: string; slug?: string }[];
  }
): string {
  const params: string[] = [];
  if (ids.personaId) {
    const p = lists.personas.find((e) => e._id === ids.personaId);
    if (p?.slug) params.push(`persona=${p.slug}`);
  }
  if (ids.unitId) {
    const u = lists.units.find((e) => e._id === ids.unitId);
    if (u?.slug) params.push(`unit=${u.slug}`);
  }
  if (ids.perspectiveId) {
    const p = lists.perspectives.find((e) => e._id === ids.perspectiveId);
    if (p?.slug) params.push(`perspective=${p.slug}`);
  }
  if (ids.processId) {
    const p = lists.processes.find((e) => e._id === ids.processId);
    if (p?.slug) params.push(`process=${p.slug}`);
  }
  return params.length ? params.join("&") : "";
}
