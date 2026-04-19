"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Spinner,
  Badge,
  Card,
  SimpleGrid,
} from "@chakra-ui/react";
import {
  FiPlus,
  FiTrash2,
  FiBook,
  FiSmile,
  FiEye,
  FiLayers,
  FiEdit3,
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import { Scroll } from "@phosphor-icons/react";
import { DimensionEditModal } from "./DimensionEditModal";
import type { DimensionType, DimensionEditData } from "./DimensionEditModal";

interface Entity {
  id: string;
  _id: string;
  title: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  isActive: boolean;
  teacherName: string | null;
  createdAt: number;
  rubric?: string;
  emoji?: string;
  icon?: string;
  steps?: { key: string; title: string; description?: string }[];
  personaId?: string | null;
  perspectiveId?: string | null;
  processId?: string | null;
  lessonCount?: number;
}

interface EntityManagerProps {
  entityType: DimensionType;
  hideHeader?: boolean;
}

const CONFIG: Record<DimensionType, {
  label: string;
  plural: string;
  icon: typeof FiBook;
  color: string;
}> = {
  unit: { label: "Unit", plural: "Units", icon: FiBook, color: "violet" },
  persona: { label: "Persona", plural: "Personas", icon: FiSmile, color: "orange" },
  perspective: { label: "Perspective", plural: "Perspectives", icon: FiEye, color: "teal" },
  process: { label: "Process", plural: "Processes", icon: FiLayers, color: "blue" },
};

export function EntityManager({ entityType, hideHeader }: EntityManagerProps) {
  const router = useRouter();
  const config = CONFIG[entityType];
  const Icon = config.icon;

  const entities = useQuery(
    entityType === "persona" ? api.personas.list :
    entityType === "unit" ? api.units.list :
    entityType === "process" ? api.processes.list :
    api.perspectives.list
  ) as Entity[] | undefined;

  // Query building block lists when managing units
  const personasList = useQuery(api.personas.list, entityType === "unit" ? {} : "skip");
  const perspectivesList = useQuery(api.perspectives.list, entityType === "unit" ? {} : "skip");
  const processesList = useQuery(api.processes.list, entityType === "unit" ? {} : "skip");

  const deactivatePersona = useMutation(api.personas.deactivate);
  const deactivateUnit = useMutation(api.units.deactivate);
  const deactivatePerspective = useMutation(api.perspectives.deactivate);
  const deactivateProcess = useMutation(api.processes.deactivate);
  const createUnit = useMutation(api.units.create);

  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<DimensionEditData | null>(null);

  const isLoading = entities === undefined;

  const handleCreate = async () => {
    // For units, create a blank unit and navigate to the designer
    if (entityType === "unit") {
      const unitId = await createUnit({ title: "New Unit" });
      router.push(`/teacher/unit/${unitId}`);
      return;
    }
    setEditData(null);
    setModalOpen(true);
  };

  const handleEdit = (entity: Entity) => {
    setEditData({
      _id: entity._id,
      title: entity.title,
      description: entity.description,
      systemPrompt: entity.systemPrompt,
      emoji: entity.emoji,
      icon: entity.icon,
      rubric: entity.rubric,
      steps: entity.steps,
      personaId: entity.personaId ? String(entity.personaId) : undefined,
      perspectiveId: entity.perspectiveId ? String(entity.perspectiveId) : undefined,
      processId: entity.processId ? String(entity.processId) : undefined,
    });
    setModalOpen(true);
  };

  const handleDelete = async (entity: Entity) => {
    const ok = window.confirm(
      `Archive "${entity.title}"? Scholars will no longer see it. You can restore it later if needed.`,
    );
    if (!ok) return;
    try {
      if (entityType === "persona") {
        await deactivatePersona({ id: entity.id as Id<"personas"> });
      } else if (entityType === "unit") {
        await deactivateUnit({ id: entity.id as Id<"units"> });
      } else if (entityType === "process") {
        await deactivateProcess({ id: entity.id as Id<"processes"> });
      } else {
        await deactivatePerspective({ id: entity.id as Id<"perspectives"> });
      }
    } catch (error) {
      console.error(`Error archiving ${config.label}:`, error);
    }
  };

  if (isLoading) {
    return (
      <Flex minH="200px" align="center" justify="center">
        <Spinner size="lg" color="violet.500" />
      </Flex>
    );
  }

  return (
    <Box>
      {!hideHeader && (
        <Flex justify="space-between" align="center" mb={4}>
          <HStack gap={2}>
            <Icon color="#AD60BF" size={22} />
            <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="lg">
              {config.plural}
            </Text>
            <Badge bg="gray.100" color="charcoal.500" fontFamily="heading" fontSize="xs">
              {entities.length}
            </Badge>
          </HStack>
        </Flex>
      )}

        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
          {/* Dashed "create new" card — always first */}
          <Box
            bg="white"
            borderRadius="xl"
            p={5}
            cursor="pointer"
            border="2px dashed"
            borderColor="violet.200"
            _hover={{ borderColor: "violet.400", shadow: "md" }}
            display="flex"
            flexDir="column"
            alignItems="center"
            justifyContent="center"
            minH="140px"
            transition="all 0.15s"
            onClick={handleCreate}
          >
            <Box
              w={12}
              h={12}
              borderRadius="full"
              bg="violet.100"
              display="flex"
              alignItems="center"
              justifyContent="center"
              mb={2}
            >
              <FiPlus size={24} color="#AD60BF" />
            </Box>
            <Text fontFamily="heading" fontWeight="500" color="violet.500" fontSize="sm">
              New {config.label}
            </Text>
          </Box>

          {entities.map((entity) => (
            <Card.Root
              key={entity.id}
              bg="white"
              shadow="sm"
              borderWidth="1px"
              borderColor="gray.200"
              opacity={entity.isActive ? 1 : 0.6}
              _hover={{ shadow: "md", borderColor: "gray.300" }}
              transition="all 0.15s"
            >
              <Card.Body p={4}>
                <VStack align="stretch" gap={3}>
                  <HStack justify="space-between">
                    <HStack gap={4} flex={1}>
                      {entity.emoji && <Text fontSize="xl">{entity.emoji}</Text>}
                      {entity.icon && !entity.emoji && <Text fontSize="xl">{entity.icon}</Text>}
                      <VStack gap={0} align="start">
                        <Text fontWeight="600" fontFamily="heading" color="navy.500">
                          {entity.title}
                        </Text>
                        {entityType === "process" && entity.steps && (
                          <Badge bg="blue.100" color="blue.700" fontSize="xs">
                            {entity.steps.length} steps
                          </Badge>
                        )}
                        {entityType === "unit" && entity.lessonCount !== undefined && entity.lessonCount > 0 && (
                          <Badge bg="violet.100" color="violet.700" fontSize="xs">
                            {entity.lessonCount} lesson{entity.lessonCount !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </VStack>
                    </HStack>
                    {entity.isActive && (
                      <IconButton
                        aria-label="Archive"
                        title="Archive"
                        size="xs"
                        variant="ghost"
                        color="charcoal.300"
                        _hover={{ color: "red.500", bg: "red.50" }}
                        onClick={() => handleDelete(entity)}
                      >
                        <FiTrash2 />
                      </IconButton>
                    )}
                  </HStack>

                  {entity.description && (
                    <Text fontSize="sm" color="charcoal.500" fontFamily="body">
                      {entity.description}
                    </Text>
                  )}

                  {entity.systemPrompt && (
                    <Text
                      fontSize="xs"
                      color="charcoal.400"
                      fontFamily="body"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      css={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {entity.systemPrompt}
                    </Text>
                  )}

                  {!entity.isActive && (
                    <Badge bg="gray.200" color="gray.600" fontSize="xs" w="fit-content">
                      Archived
                    </Badge>
                  )}

                  <HStack gap={2} mt={1}>
                    {entityType !== "unit" && (
                      <Button
                        variant="outline"
                        size="sm"
                        fontFamily="heading"
                        color="violet.500"
                        borderColor="violet.200"
                        _hover={{ bg: "violet.50", borderColor: "violet.400" }}
                        onClick={() => handleEdit(entity)}
                      >
                        <Scroll size={14} weight="bold" style={{ marginRight: "6px" }} />
                        Edit Prompt
                      </Button>
                    )}
                    {entityType === "unit" && entity.isActive && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          fontFamily="heading"
                          color="navy.500"
                          borderColor="navy.200"
                          _hover={{ bg: "navy.50", borderColor: "navy.400" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/teacher/unit/${entity._id}`);
                          }}
                        >
                          <FiEdit3 size={14} style={{ marginRight: "6px" }} />
                          Design
                        </Button>
                      </>
                    )}
                  </HStack>
                </VStack>
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>

      <DimensionEditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        dimensionType={entityType}
        data={editData}
        personas={personasList as { _id: string; title: string; emoji: string }[] | undefined}
        perspectives={perspectivesList as { _id: string; title: string; icon?: string }[] | undefined}
        processes={processesList as { _id: string; title: string; emoji?: string }[] | undefined}
      />
    </Box>
  );
}
