"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Input,
  Textarea,
  Spinner,
  Dialog,
  Portal,
} from "@chakra-ui/react";
import { FiPlus, FiTrash2, FiSave } from "react-icons/fi";

export type DimensionType = "project" | "persona" | "perspective" | "process";

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

export interface DimensionEditData {
  _id: string;
  title: string;
  description?: string;
  systemPrompt?: string;
  emoji?: string;
  icon?: string;
  rubric?: string;
  targetBloomLevel?: string;
  steps?: { key: string; title: string; description?: string }[];
}

interface DimensionEditModalProps {
  open: boolean;
  onClose: () => void;
  dimensionType: DimensionType;
  /** Pass existing data to edit. Omit for create mode. */
  data?: DimensionEditData | null;
}

const TYPE_LABELS: Record<DimensionType, string> = {
  project: "Project",
  persona: "Persona",
  perspective: "Perspective",
  process: "Process",
};

export function DimensionEditModal({
  open,
  onClose,
  dimensionType,
  data,
}: DimensionEditModalProps) {
  const label = TYPE_LABELS[dimensionType];
  const isEditing = !!data;

  // Mutations
  const createPersona = useMutation(api.personas.create);
  const updatePersona = useMutation(api.personas.update);
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const createPerspective = useMutation(api.perspectives.create);
  const updatePerspective = useMutation(api.perspectives.update);
  const createProcess = useMutation(api.processes.create);
  const updateProcess = useMutation(api.processes.update);

  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({
    title: "",
    description: "",
    systemPrompt: "",
    rubric: "",
    targetBloomLevel: "",
    emoji: "",
    icon: "",
  });
  const [stepsData, setStepsData] = useState<{ key: string; title: string; description: string }[]>([]);

  // Reset form when modal opens or data changes
  useEffect(() => {
    if (open) {
      setFormData({
        title: data?.title ?? "",
        description: data?.description ?? "",
        systemPrompt: data?.systemPrompt ?? "",
        rubric: data?.rubric ?? "",
        targetBloomLevel: data?.targetBloomLevel ?? "",
        emoji: data?.emoji ?? "",
        icon: data?.icon ?? "",
      });
      setStepsData(
        data?.steps?.map((s) => ({
          key: s.key,
          title: s.title,
          description: s.description ?? "",
        })) ?? []
      );
    }
  }, [open, data]);

  const handleSave = async () => {
    if (!formData.title.trim()) return;
    if (dimensionType === "persona" && !formData.emoji.trim()) return;
    if (dimensionType === "process" && stepsData.filter(s => s.key.trim() && s.title.trim()).length === 0) return;

    setIsSaving(true);
    try {
      const cleanSteps = stepsData
        .filter((s) => s.key.trim() && s.title.trim())
        .map((s) => ({
          key: s.key.trim(),
          title: s.title.trim(),
          description: s.description.trim() || undefined,
        }));

      if (isEditing && data) {
        const entityId = data._id;
        if (dimensionType === "persona") {
          await updatePersona({
            id: entityId as Id<"personas">,
            title: formData.title,
            emoji: formData.emoji,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
          });
        } else if (dimensionType === "project") {
          const bloomLevel = VALID_BLOOM_VALUES.find(v => v === formData.targetBloomLevel);
          await updateProject({
            id: entityId as Id<"projects">,
            title: formData.title,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
            rubric: formData.rubric || undefined,
            ...(bloomLevel ? { targetBloomLevel: bloomLevel } : {}),
          });
        } else if (dimensionType === "process") {
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
      } else {
        if (dimensionType === "persona") {
          await createPersona({
            title: formData.title,
            emoji: formData.emoji,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
          });
        } else if (dimensionType === "project") {
          const bloomLevel = VALID_BLOOM_VALUES.find(v => v === formData.targetBloomLevel);
          await createProject({
            title: formData.title,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
            rubric: formData.rubric || undefined,
            ...(bloomLevel ? { targetBloomLevel: bloomLevel } : {}),
          });
        } else if (dimensionType === "process") {
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
      }
      onClose();
    } catch (error) {
      console.error(`Error saving ${label}:`, error);
    } finally {
      setIsSaving(false);
    }
  };

  const canSave =
    formData.title.trim() &&
    (dimensionType !== "persona" || formData.emoji.trim()) &&
    (dimensionType !== "process" || stepsData.filter(s => s.key.trim() && s.title.trim()).length > 0);

  return (
    <Dialog.Root open={open} onOpenChange={(e) => { if (!e.open) onClose(); }}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="640px" maxH="85vh" overflow="auto">
            <Dialog.Header px={6} pt={6} pb={2}>
              <Dialog.Title fontFamily="heading" color="navy.500" fontWeight="600">
                {isEditing ? `Edit ${label}` : `New ${label}`}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body px={6} pb={6}>
              <VStack gap={4} align="stretch">
                <Box>
                  <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                    Title *
                  </Text>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder={`e.g., ${dimensionType === "project" ? "Hawaiian Ecosystem Research" : dimensionType === "persona" ? "Sensei" : "Big Ideas"}`}
                    fontFamily="body"
                  />
                </Box>

                {dimensionType === "persona" && (
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

                {dimensionType === "process" && (
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

                {dimensionType === "perspective" && (
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
                    placeholder={`Brief description of this ${label.toLowerCase()}`}
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
                    placeholder={dimensionType === "persona"
                      ? "How should the AI behave in this persona? e.g., 'You are a calm, patient Sensei...'"
                      : dimensionType === "perspective"
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

                {dimensionType === "project" && (
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

                {dimensionType === "process" && (
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
                            onClick={() => setStepsData(stepsData.filter((_, i) => i !== idx))}
                          >
                            <FiTrash2 />
                          </IconButton>
                        </HStack>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        fontFamily="heading"
                        onClick={() => setStepsData([...stepsData, { key: "", title: "", description: "" }])}
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
                    onClick={onClose}
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
                    disabled={isSaving || !canSave}
                  >
                    {isSaving ? <Spinner size="sm" /> : <><FiSave style={{ marginRight: "8px" }} /> Save</>}
                  </Button>
                </HStack>
              </VStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
