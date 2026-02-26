"use client";

import { UnitDesigner } from "@/components/UnitDesigner";
import type { Id } from "@/convex/_generated/dataModel";

export default function UnitDesignerPage({
  params,
}: {
  params: { unitId: string };
}) {
  return <UnitDesigner unitId={params.unitId as Id<"units">} />;
}
