"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@chakra-ui/react";
import {
  FiX,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiSave,
  FiBook,
  FiSmile,
  FiEye,
} from "react-icons/fi";

type EntityType = "project" | "persona" | "perspective";

interface Entity {
  id: string;
  title: string;
  description: string | null;
  systemPrompt: string | null;
  isActive: boolean;
  teacherName: string | null;
  createdAt: string;
  // Project-specific
  rubric?: string | null;
  targetBloomLevel?: string | null;
  // Persona-specific
  emoji?: string | null;
  // Perspective-specific
  icon?: string | null;
}

interface EntityManagerProps {
  entityType: EntityType;
  onClose: () => void;
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

const CONFIG: Record<EntityType, {
  label: string;
  plural: string;
  apiPath: string;
  responseKey: string;
  icon: typeof FiBook;
  color: string;
}> = {
  project: {
    label: "Project",
    plural: "Projects",
    apiPath: "/api/projects",
    responseKey: "projects",
    icon: FiBook,
    color: "violet",
  },
  persona: {
    label: "Persona",
    plural: "Personas",
    apiPath: "/api/personas",
    responseKey: "personas",
    icon: FiSmile,
    color: "orange",
  },
  perspective: {
    label: "Perspective",
    plural: "Perspectives",
    apiPath: "/api/perspectives",
    responseKey: "perspectives",
    icon: FiEye,
    color: "teal",
  },
};

export function EntityManager({ entityType, onClose }: EntityManagerProps) {
  const config = CONFIG[entityType];
  const Icon = config.icon;

  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Record<string, string>>({
    title: "",
    description: "",
    systemPrompt: "",
    // Project-specific
    rubric: "",
    targetBloomLevel: "",
    // Persona-specific
    emoji: "",
    // Perspective-specific
    icon: "",
  });

  // Fetch entities
  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch(config.apiPath);
      if (res.ok) {
        const data = await res.json();
        setEntities(data[config.responseKey]);
      }
    } catch (error) {
      console.error(`Error fetching ${config.plural}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [config.apiPath, config.responseKey, config.plural]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

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
    setEditingEntity(entity);
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) return;
    if (entityType === "persona" && !formData.emoji.trim()) return;

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        systemPrompt: formData.systemPrompt,
      };

      if (entityType === "project") {
        payload.rubric = formData.rubric;
        payload.targetBloomLevel = formData.targetBloomLevel;
      } else if (entityType === "persona") {
        payload.emoji = formData.emoji;
      } else if (entityType === "perspective") {
        payload.icon = formData.icon;
      }

      if (editingEntity) {
        const res = await fetch(`${config.apiPath}/${editingEntity.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          fetchEntities();
          setIsCreating(false);
          setEditingEntity(null);
        }
      } else {
        const res = await fetch(config.apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          fetchEntities();
          setIsCreating(false);
        }
      }
    } catch (error) {
      console.error(`Error saving ${config.label}:`, error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (entityId: string) => {
    try {
      const res = await fetch(`${config.apiPath}/${entityId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchEntities();
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
      <Box
        w={{ base: "full", md: "450px" }}
        bg="white"
        borderLeft="1px solid"
        borderColor="gray.200"
        h="full"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Spinner size="lg" color="violet.500" />
      </Box>
    );
  }

  return (
    <Box
      w={{ base: "full", md: "450px" }}
      bg="white"
      borderLeft="1px solid"
      borderColor="gray.200"
      h="full"
      display="flex"
      flexDir="column"
      position={{ base: "absolute", md: "relative" }}
      right={0}
      zIndex={30}
    >
      {/* Header */}
      <Flex
        p={4}
        borderBottom="1px solid"
        borderColor="gray.200"
        justify="space-between"
        align="center"
        bg="navy.500"
      >
        <HStack gap={3}>
          <Icon color="white" size={20} />
          <Text fontWeight="600" fontFamily="heading" color="white" fontSize="lg">
            {isCreating ? (editingEntity ? `Edit ${config.label}` : `New ${config.label}`) : config.plural}
          </Text>
        </HStack>
        <IconButton
          aria-label="Close"
          variant="ghost"
          color="white"
          _hover={{ bg: "whiteAlpha.200" }}
          onClick={onClose}
        >
          <FiX />
        </IconButton>
      </Flex>

      {/* Content */}
      <Box flex={1} overflow="auto" p={4}>
        {isCreating ? (
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
                rows={4}
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
                disabled={isSaving || !formData.title.trim() || (entityType === "persona" && !formData.emoji.trim())}
              >
                {isSaving ? <Spinner size="sm" /> : <><FiSave style={{ marginRight: "8px" }} /> Save</>}
              </Button>
            </HStack>
          </VStack>
        ) : (
          <VStack gap={3} align="stretch">
            <Button
              w="full"
              bg="violet.500"
              color="white"
              _hover={{ bg: "violet.600" }}
              fontFamily="heading"
              onClick={handleStartCreate}
            >
              <FiPlus style={{ marginRight: "8px" }} />
              Create {config.label}
            </Button>

            {entities.length === 0 ? (
              <VStack py={8} gap={2}>
                <Icon size={32} color="#c1c1c1" />
                <Text color="charcoal.400" fontFamily="heading" fontSize="sm">
                  No {config.plural.toLowerCase()} yet
                </Text>
              </VStack>
            ) : (
              entities.map((entity) => (
                <Box
                  key={entity.id}
                  p={4}
                  bg="gray.50"
                  borderRadius="lg"
                  borderLeft="3px solid"
                  borderColor={entity.isActive ? "violet.500" : "gray.300"}
                  opacity={entity.isActive ? 1 : 0.6}
                >
                  <HStack justify="space-between" mb={2}>
                    <VStack gap={0} align="start">
                      <HStack gap={2}>
                        {entity.emoji && <Text fontSize="lg">{entity.emoji}</Text>}
                        {entity.icon && !entity.emoji && <Text fontSize="lg">{entity.icon}</Text>}
                        <Text fontWeight="600" fontFamily="heading" color="navy.500">
                          {entity.title}
                        </Text>
                      </HStack>
                      {entityType === "project" && entity.targetBloomLevel && (
                        <Badge bg="violet.100" color="violet.700" fontSize="xs">
                          {entity.targetBloomLevel}
                        </Badge>
                      )}
                    </VStack>
                    <HStack gap={1}>
                      <IconButton
                        aria-label="Edit"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStartEdit(entity)}
                      >
                        <FiEdit2 />
                      </IconButton>
                      {entity.isActive && (
                        <IconButton
                          aria-label="Delete"
                          size="sm"
                          variant="ghost"
                          color="red.500"
                          onClick={() => handleDelete(entity.id)}
                        >
                          <FiTrash2 />
                        </IconButton>
                      )}
                    </HStack>
                  </HStack>
                  {entity.description && (
                    <Text fontSize="sm" color="charcoal.500" fontFamily="body" mb={2}>
                      {entity.description}
                    </Text>
                  )}
                  {!entity.isActive && (
                    <Badge bg="gray.200" color="gray.600" fontSize="xs">
                      Archived
                    </Badge>
                  )}
                </Box>
              ))
            )}
          </VStack>
        )}
      </Box>
    </Box>
  );
}
