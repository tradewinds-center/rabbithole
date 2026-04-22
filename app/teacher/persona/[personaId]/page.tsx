"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Flex, Spinner } from "@chakra-ui/react";
import { DimensionEditModal } from "@/components/DimensionEditModal";

export default function PersonaDetailPage({ params }: { params: { personaId: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const entity = useQuery(api.personas.get, { id: params.personaId as Id<"personas"> });

  if (entity === undefined) {
    return (
      <Flex h="100dvh" align="center" justify="center">
        <Spinner size="xl" color="violet.500" />
      </Flex>
    );
  }

  const handleClose = () => {
    setOpen(false);
    router.push("/teacher?tab=curriculum&sub=personas");
  };

  return (
    <>
      <Flex h="100dvh" bg="gray.50" />
      <DimensionEditModal
        open={open}
        onClose={handleClose}
        dimensionType="persona"
        data={
          entity
            ? {
                _id: entity._id,
                title: entity.title,
                description: entity.description,
                systemPrompt: entity.systemPrompt,
                emoji: entity.emoji,
              }
            : null
        }
      />
    </>
  );
}
