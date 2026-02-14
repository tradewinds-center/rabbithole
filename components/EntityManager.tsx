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
} from "react-icons/fi";
import { Scroll } from "@phosphor-icons/react";
import { DimensionEditModal } from "./DimensionEditModal";
import type { DimensionType, DimensionEditData } from "./DimensionEditModal";

interface Entity {
  id: string;
  _id: string;
  title: string;
  description?: string;
  systemPrompt?: string;
  isActive: boolean;
  teacherName: string | null;
  createdAt: number;
  rubric?: string;
  targetBloomLevel?: string;
  emoji?: string;
  icon?: string;
  steps?: { key: string; title: string; description?: string }[];
}

interface EntityManagerProps {
  entityType: DimensionType;
}

const CONFIG: Record<DimensionType, {
  label: string;
  plural: string;
  icon: typeof FiBook;
  color: string;
}> = {
  project: { label: "Project", plural: "Projects", icon: FiBook, color: "violet" },
  persona: { label: "Persona", plural: "Personas", icon: FiSmile, color: "orange" },
  perspective: { label: "Perspective", plural: "Perspectives", icon: FiEye, color: "teal" },
  process: { label: "Process", plural: "Processes", icon: FiLayers, color: "blue" },
};

export function EntityManager({ entityType }: EntityManagerProps) {
  const config = CONFIG[entityType];
  const Icon = config.icon;

  const entities = useQuery(
    entityType === "persona" ? api.personas.list :
    entityType === "project" ? api.projects.list :
    entityType === "process" ? api.processes.list :
    api.perspectives.list
  ) as Entity[] | undefined;

  const deactivatePersona = useMutation(api.personas.deactivate);
  const deactivateProject = useMutation(api.projects.deactivate);
  const deactivatePerspective = useMutation(api.perspectives.deactivate);
  const deactivateProcess = useMutation(api.processes.deactivate);

  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<DimensionEditData | null>(null);

  const isLoading = entities === undefined;

  const handleCreate = () => {
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
      targetBloomLevel: entity.targetBloomLevel,
      steps: entity.steps,
    });
    setModalOpen(true);
  };

  const handleDelete = async (entityId: string) => {
    try {
      if (entityType === "persona") {
        await deactivatePersona({ id: entityId as Id<"personas"> });
      } else if (entityType === "project") {
        await deactivateProject({ id: entityId as Id<"projects"> });
      } else if (entityType === "process") {
        await deactivateProcess({ id: entityId as Id<"processes"> });
      } else {
        await deactivatePerspective({ id: entityId as Id<"perspectives"> });
      }
    } catch (error) {
      console.error(`Error deleting ${config.label}:`, error);
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
        <Button
          bg="violet.500"
          color="white"
          _hover={{ bg: "violet.600" }}
          fontFamily="heading"
          size="sm"
          onClick={handleCreate}
        >
          <FiPlus style={{ marginRight: "6px" }} />
          Create {config.label}
        </Button>
      </Flex>

      {entities.length === 0 ? (
        <VStack py={12} gap={4}>
          <Icon size={48} color="#c1c1c1" />
          <Text color="charcoal.400" fontFamily="heading">
            No {config.plural.toLowerCase()} yet
          </Text>
          <Button
            variant="outline"
            fontFamily="heading"
            size="sm"
            onClick={handleCreate}
          >
            <FiPlus style={{ marginRight: "6px" }} />
            Create your first {config.label.toLowerCase()}
          </Button>
        </VStack>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
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
                    <HStack gap={2} flex={1}>
                      {entity.emoji && <Text fontSize="xl">{entity.emoji}</Text>}
                      {entity.icon && !entity.emoji && <Text fontSize="xl">{entity.icon}</Text>}
                      <VStack gap={0} align="start">
                        <Text fontWeight="600" fontFamily="heading" color="navy.500">
                          {entity.title}
                        </Text>
                        {entityType === "project" && entity.targetBloomLevel && (
                          <Badge bg="violet.100" color="violet.700" fontSize="xs">
                            {entity.targetBloomLevel}
                          </Badge>
                        )}
                        {entityType === "process" && entity.steps && (
                          <Badge bg="blue.100" color="blue.700" fontSize="xs">
                            {entity.steps.length} steps
                          </Badge>
                        )}
                      </VStack>
                    </HStack>
                    {entity.isActive && (
                      <IconButton
                        aria-label="Delete"
                        size="xs"
                        variant="ghost"
                        color="charcoal.300"
                        _hover={{ color: "red.500", bg: "red.50" }}
                        onClick={() => handleDelete(entity.id)}
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

                  <Button
                    variant="outline"
                    size="sm"
                    fontFamily="heading"
                    color="violet.500"
                    borderColor="violet.200"
                    _hover={{ bg: "violet.50", borderColor: "violet.400" }}
                    onClick={() => handleEdit(entity)}
                    mt={1}
                  >
                    <Scroll size={14} weight="bold" style={{ marginRight: "6px" }} />
                    Edit Prompt
                  </Button>
                </VStack>
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>
      )}

      <DimensionEditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        dimensionType={entityType}
        data={editData}
      />
    </Box>
  );
}
