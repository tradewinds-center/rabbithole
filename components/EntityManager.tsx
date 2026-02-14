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
  Input,
  Textarea,
  Spinner,
  Badge,
  Card,
  SimpleGrid,
} from "@chakra-ui/react";
import {
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiSave,
  FiBook,
  FiSmile,
  FiEye,
  FiLayers,
  FiArrowLeft,
} from "react-icons/fi";

type EntityType = "project" | "persona" | "perspective" | "process";

interface Entity {
  id: string;
  _id: string;
  title: string;
  description?: string;
  systemPrompt?: string;
  isActive: boolean;
  teacherName: string | null;
  createdAt: number;
  // Project-specific
  rubric?: string;
  targetBloomLevel?: string;
  // Persona-specific
  emoji?: string;
  // Perspective-specific
  icon?: string;
  // Process-specific
  steps?: { key: string; title: string; description?: string }[];
}

interface EntityManagerProps {
  entityType: EntityType;
}

const BLOOM_LEVELS = [
  { value: "", label: "None" },
  { value: "remember", label: "Remember" },
  { value: "understand", label: "Understand" },
  { value: "apply", label: "Apply" },
  { value: "analyze", label: "Analyze" },
  { value: "evaluate", label: "Evaluate" },
  { value: "create", label: "Create" },
];

const VALID_BLOOM_VALUES = ["remember", "understand", "apply", "analyze", "evaluate", "create"] as const;

const CONFIG: Record<EntityType, {
  label: string;
  plural: string;
  icon: typeof FiBook;
  color: string;
}> = {
  project: {
    label: "Project",
    plural: "Projects",
    icon: FiBook,
    color: "violet",
  },
  persona: {
    label: "Persona",
    plural: "Personas",
    icon: FiSmile,
    color: "orange",
  },
  perspective: {
    label: "Perspective",
    plural: "Perspectives",
    icon: FiEye,
    color: "teal",
  },
  process: {
    label: "Process",
    plural: "Processes",
    icon: FiLayers,
    color: "blue",
  },
};

export function EntityManager({ entityType }: EntityManagerProps) {
  const config = CONFIG[entityType];
  const Icon = config.icon;

  // Convex queries - reactively fetch entities
  const entities = useQuery(
    entityType === "persona" ? api.personas.list :
    entityType === "project" ? api.projects.list :
    entityType === "process" ? api.processes.list :
    api.perspectives.list
  ) as Entity[] | undefined;

  // Convex mutations
  const createPersona = useMutation(api.personas.create);
  const updatePersona = useMutation(api.personas.update);
  const deactivatePersona = useMutation(api.personas.deactivate);

  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const deactivateProject = useMutation(api.projects.deactivate);

  const createPerspective = useMutation(api.perspectives.create);
  const updatePerspective = useMutation(api.perspectives.update);
  const deactivatePerspective = useMutation(api.perspectives.deactivate);

  const createProcess = useMutation(api.processes.create);
  const updateProcess = useMutation(api.processes.update);
  const deactivateProcess = useMutation(api.processes.deactivate);

  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Record<string, string>>({
    title: "",
    description: "",
    systemPrompt: "",
    rubric: "",
    targetBloomLevel: "",
    emoji: "",
    icon: "",
  });

  // Steps state for process entity type
  const [stepsData, setStepsData] = useState<{ key: string; title: string; description: string }[]>([]);

  const isLoading = entities === undefined;

  const resetForm = () => ({
    title: "",
    description: "",
    systemPrompt: "",
    rubric: "",
    targetBloomLevel: "",
    emoji: "",
    icon: "",
  });

  const handleStartCreate = () => {
    setFormData(resetForm());
    setStepsData([]);
    setEditingEntity(null);
    setIsCreating(true);
  };

  const handleStartEdit = (entity: Entity) => {
    setFormData({
      title: entity.title,
      description: entity.description || "",
      systemPrompt: entity.systemPrompt || "",
      rubric: entity.rubric || "",
      targetBloomLevel: entity.targetBloomLevel || "",
      emoji: entity.emoji || "",
      icon: entity.icon || "",
    });
    setStepsData(
      entity.steps?.map((s) => ({
        key: s.key,
        title: s.title,
        description: s.description || "",
      })) ?? []
    );
    setEditingEntity(entity);
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) return;
    if (entityType === "persona" && !formData.emoji.trim()) return;
    if (entityType === "process" && stepsData.length === 0) return;

    setIsSaving(true);
    try {
      const cleanSteps = stepsData
        .filter((s) => s.key.trim() && s.title.trim())
        .map((s) => ({
          key: s.key.trim(),
          title: s.title.trim(),
          description: s.description.trim() || undefined,
        }));

      if (editingEntity) {
        const entityId = editingEntity._id;

        if (entityType === "persona") {
          await updatePersona({
            id: entityId as Id<"personas">,
            title: formData.title,
            emoji: formData.emoji,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
          });
        } else if (entityType === "project") {
          const bloomLevel = VALID_BLOOM_VALUES.find(v => v === formData.targetBloomLevel);
          await updateProject({
            id: entityId as Id<"projects">,
            title: formData.title,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
            rubric: formData.rubric || undefined,
            ...(bloomLevel ? { targetBloomLevel: bloomLevel } : {}),
          });
        } else if (entityType === "process") {
          await updateProcess({
            id: entityId as Id<"processes">,
            title: formData.title,
            emoji: formData.emoji || undefined,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
            steps: cleanSteps,
          });
        } else {
          await updatePerspective({
            id: entityId as Id<"perspectives">,
            title: formData.title,
            icon: formData.icon || undefined,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
          });
        }

        setIsCreating(false);
        setEditingEntity(null);
      } else {
        if (entityType === "persona") {
          await createPersona({
            title: formData.title,
            emoji: formData.emoji,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
          });
        } else if (entityType === "project") {
          const bloomLevel = VALID_BLOOM_VALUES.find(v => v === formData.targetBloomLevel);
          await createProject({
            title: formData.title,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
            rubric: formData.rubric || undefined,
            ...(bloomLevel ? { targetBloomLevel: bloomLevel } : {}),
          });
        } else if (entityType === "process") {
          await createProcess({
            title: formData.title,
            emoji: formData.emoji || undefined,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
            steps: cleanSteps,
          });
        } else {
          await createPerspective({
            title: formData.title,
            icon: formData.icon || undefined,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
          });
        }

        setIsCreating(false);
      }
    } catch (error) {
      console.error(`Error saving ${config.label}:`, error);
    } finally {
      setIsSaving(false);
    }
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

  const handleCancel = () => {
    setIsCreating(false);
    setEditingEntity(null);
  };

  if (isLoading) {
    return (
      <Flex minH="200px" align="center" justify="center">
        <Spinner size="lg" color="violet.500" />
      </Flex>
    );
  }

  // Create/Edit Form (full-width, centered)
  if (isCreating) {
    return (
      <Box maxW="640px" mx="auto">
        <HStack mb={6}>
          <IconButton
            aria-label="Back"
            variant="ghost"
            size="sm"
            color="charcoal.400"
            onClick={handleCancel}
          >
            <FiArrowLeft />
          </IconButton>
          <Icon color="#AD60BF" size={20} />
          <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="lg">
            {editingEntity ? `Edit ${config.label}` : `New ${config.label}`}
          </Text>
        </HStack>

        <Card.Root bg="white" shadow="sm">
          <Card.Body p={6}>
            <VStack gap={4} align="stretch">
              <Box>
                <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                  Title *
                </Text>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={`e.g., ${entityType === "project" ? "Hawaiian Ecosystem Research" : entityType === "persona" ? "Sensei" : "Big Ideas"}`}
                  fontFamily="body"
                />
              </Box>

              {/* Persona-specific: emoji */}
              {entityType === "persona" && (
                <Box>
                  <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                    Emoji *
                  </Text>
                  <Input
                    value={formData.emoji}
                    onChange={(e) => setFormData((prev) => ({ ...prev, emoji: e.target.value }))}
                    placeholder="e.g., 🥋"
                    fontFamily="body"
                    maxW="100px"
                  />
                </Box>
              )}

              {/* Process-specific: emoji */}
              {entityType === "process" && (
                <Box>
                  <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                    Emoji
                  </Text>
                  <Input
                    value={formData.emoji}
                    onChange={(e) => setFormData((prev) => ({ ...prev, emoji: e.target.value }))}
                    placeholder="e.g., ✍️"
                    fontFamily="body"
                    maxW="100px"
                  />
                </Box>
              )}

              {/* Perspective-specific: icon */}
              {entityType === "perspective" && (
                <Box>
                  <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                    Icon (emoji)
                  </Text>
                  <Input
                    value={formData.icon}
                    onChange={(e) => setFormData((prev) => ({ ...prev, icon: e.target.value }))}
                    placeholder="e.g., 💡"
                    fontFamily="body"
                    maxW="100px"
                  />
                </Box>
              )}

              <Box>
                <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                  Description
                </Text>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={`Brief description of this ${config.label.toLowerCase()}`}
                  rows={2}
                  fontFamily="body"
                />
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                  System Prompt (AI Instructions)
                </Text>
                <Textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder={entityType === "persona"
                    ? "How should the AI behave in this persona? e.g., 'You are a calm, patient Sensei...'"
                    : entityType === "perspective"
                    ? "How should the AI apply this thinking lens? e.g., 'Help the scholar identify patterns...'"
                    : "Instructions for the AI tutor for this project."}
                  rows={5}
                  fontFamily="body"
                  fontSize="sm"
                />
                <Text fontSize="xs" color="charcoal.400" fontFamily="body" mt={1}>
                  This guides how the AI interacts with scholars.
                </Text>
              </Box>

              {/* Project-specific fields */}
              {entityType === "project" && (
                <>
                  <Box>
                    <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                      Rubric / Assessment Criteria
                    </Text>
                    <Textarea
                      value={formData.rubric}
                      onChange={(e) => setFormData((prev) => ({ ...prev, rubric: e.target.value }))}
                      placeholder="What should scholars demonstrate?"
                      rows={3}
                      fontFamily="body"
                      fontSize="sm"
                    />
                  </Box>

                  <Box>
                    <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                      Target Bloom Level
                    </Text>
                    <select
                      value={formData.targetBloomLevel}
                      onChange={(e) => setFormData((prev) => ({ ...prev, targetBloomLevel: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        fontSize: "14px",
                        fontFamily: "inherit",
                      }}
                    >
                      {BLOOM_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </Box>
                </>
              )}

              {/* Process-specific: steps editor */}
              {entityType === "process" && (
                <Box>
                  <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={2}>
                    Steps *
                  </Text>
                  <VStack gap={2} align="stretch">
                    {stepsData.map((step, idx) => (
                      <HStack key={idx} gap={2} align="start">
                        <Input
                          value={step.key}
                          onChange={(e) => {
                            const updated = [...stepsData];
                            updated[idx] = { ...updated[idx], key: e.target.value };
                            setStepsData(updated);
                          }}
                          placeholder="Key"
                          fontFamily="body"
                          fontSize="sm"
                          maxW="70px"
                        />
                        <Input
                          value={step.title}
                          onChange={(e) => {
                            const updated = [...stepsData];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setStepsData(updated);
                          }}
                          placeholder="Title"
                          fontFamily="body"
                          fontSize="sm"
                          flex={1}
                        />
                        <Input
                          value={step.description}
                          onChange={(e) => {
                            const updated = [...stepsData];
                            updated[idx] = { ...updated[idx], description: e.target.value };
                            setStepsData(updated);
                          }}
                          placeholder="Description (optional)"
                          fontFamily="body"
                          fontSize="sm"
                          flex={2}
                        />
                        <IconButton
                          aria-label="Remove step"
                          size="sm"
                          variant="ghost"
                          color="charcoal.400"
                          _hover={{ color: "red.500" }}
                          onClick={() => {
                            setStepsData(stepsData.filter((_, i) => i !== idx));
                          }}
                        >
                          <FiTrash2 />
                        </IconButton>
                      </HStack>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      fontFamily="heading"
                      onClick={() =>
                        setStepsData([...stepsData, { key: "", title: "", description: "" }])
                      }
                    >
                      <FiPlus style={{ marginRight: "6px" }} />
                      Add Step
                    </Button>
                  </VStack>
                </Box>
              )}

              <HStack gap={2} pt={4}>
                <Button
                  flex={1}
                  variant="outline"
                  fontFamily="heading"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  flex={1}
                  bg="violet.500"
                  color="white"
                  _hover={{ bg: "violet.600" }}
                  fontFamily="heading"
                  onClick={handleSave}
                  disabled={isSaving || !formData.title.trim() || (entityType === "persona" && !formData.emoji.trim()) || (entityType === "process" && stepsData.filter(s => s.key.trim() && s.title.trim()).length === 0)}
                >
                  {isSaving ? <Spinner size="sm" /> : <><FiSave style={{ marginRight: "8px" }} /> Save</>}
                </Button>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Box>
    );
  }

  // Entity List (full-width grid)
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
          onClick={handleStartCreate}
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
            onClick={handleStartCreate}
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
                    <HStack gap={1}>
                      <IconButton
                        aria-label="Edit"
                        size="sm"
                        variant="ghost"
                        color="charcoal.400"
                        _hover={{ color: "violet.500", bg: "violet.50" }}
                        onClick={() => handleStartEdit(entity)}
                      >
                        <FiEdit2 />
                      </IconButton>
                      {entity.isActive && (
                        <IconButton
                          aria-label="Delete"
                          size="sm"
                          variant="ghost"
                          color="charcoal.400"
                          _hover={{ color: "red.500", bg: "red.50" }}
                          onClick={() => handleDelete(entity.id)}
                        >
                          <FiTrash2 />
                        </IconButton>
                      )}
                    </HStack>
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
                </VStack>
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
