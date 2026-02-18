"use client";

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useMutation, useAction } from "convex/react";
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
  Timeline,
} from "@chakra-ui/react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { DotsSixVertical, Scroll } from "@phosphor-icons/react";
import type { EmojiClickData } from "emoji-picker-react";
const EmojiPicker = lazy(() => import("emoji-picker-react"));
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

export type DimensionType = "unit" | "persona" | "perspective" | "process";

export interface DimensionEditData {
  _id: string;
  title: string;
  description?: string;
  systemPrompt?: string;
  emoji?: string;
  icon?: string;
  rubric?: string;
  durationMinutes?: number;
  youtubeUrl?: string;
  videoTranscript?: string;
  steps?: { key: string; title: string; description?: string }[];
  personaId?: string;
  perspectiveId?: string;
  processId?: string;
}

interface DimensionEditModalProps {
  open: boolean;
  onClose: () => void;
  dimensionType: DimensionType;
  /** Pass existing data to edit. Omit for create mode. */
  data?: DimensionEditData | null;
  /** Option lists for unit building blocks */
  personas?: { _id: string; title: string; emoji: string }[];
  perspectives?: { _id: string; title: string; icon?: string }[];
  processes?: { _id: string; title: string; emoji?: string }[];
}

const TYPE_LABELS: Record<DimensionType, string> = {
  unit: "Unit",
  persona: "Persona",
  perspective: "Perspective",
  process: "Process",
};

const LABEL_WIDTH = "160px";

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <HStack gap={4} align="start" width="100%">
      <Box flexShrink={0} w={LABEL_WIDTH} pt="10px">
        <Text fontSize="md" fontWeight="600" fontFamily="heading" color="navy.500">
          {label}
        </Text>
        {hint && (
          <Text fontSize="sm" color="charcoal.400" fontFamily="body" mt={0.5}>
            {hint}
          </Text>
        )}
      </Box>
      <Box flex={1}>{children}</Box>
    </HStack>
  );
}

function EmojiPickerButton({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (emoji: string) => void;
  label: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  return (
    <Box ref={containerRef} position="relative">
      {label && (
        <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
          {label}
        </Text>
      )}
      <Button
        variant="outline"
        size="lg"
        minW="64px"
        h="48px"
        fontSize="2xl"
        onClick={() => setShowPicker((v) => !v)}
        fontFamily="body"
      >
        {value || <Box as="span" w="20px" h="20px" border="2px dashed" borderColor="charcoal.300" borderRadius="sm" display="inline-block" />}
      </Button>
      {showPicker && (
        <Box position="absolute" top="100%" left={0} zIndex={1500} mt={1}>
          <Suspense fallback={<Spinner size="sm" />}>
            <EmojiPicker
              onEmojiClick={(emojiData: EmojiClickData) => {
                onChange(emojiData.emoji);
                setShowPicker(false);
              }}
              width={300}
              height={350}
              skinTonesDisabled
              searchPlaceholder="Search emoji..."
            />
          </Suspense>
        </Box>
      )}
    </Box>
  );
}

interface StepWithId {
  _id: string;
  key: string;
  title: string;
  description: string;
}

function SortableStep({
  step,
  onChange,
  onDelete,
}: {
  step: StepWithId;
  onChange: (field: keyof StepWithId, value: string) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Timeline.Item ref={setNodeRef} style={style}>
      <Timeline.Connector>
        <Timeline.Separator css={{ borderColor: "var(--chakra-colors-violet-300)" }} />
        <Timeline.Indicator
          css={{
            bg: "violet.500",
            borderColor: "violet.500",
            color: "white",
            fontSize: "10px",
            fontWeight: 700,
            fontFamily: "var(--chakra-fonts-heading)",
          }}
        >
          {step.key || "?"}
        </Timeline.Indicator>
      </Timeline.Connector>
      <Timeline.Content css={{ pb: "4" }}>
        <HStack gap={2} align="center" width="100%">
          <Box
            {...attributes}
            {...listeners}
            cursor="grab"
            color="charcoal.400"
            _hover={{ color: "navy.500" }}
            flexShrink={0}
          >
            <DotsSixVertical size={18} weight="bold" />
          </Box>
          <Input
            value={step.key}
            onChange={(e) => onChange("key", e.target.value)}
            placeholder="Key"
            fontFamily="body"
            fontSize="md"
            maxW="60px"
            bg="white"
          />
          <Input
            value={step.title}
            onChange={(e) => onChange("title", e.target.value)}
            placeholder="Title"
            fontFamily="body"
            fontSize="md"
            flex={1}
            bg="white"
          />
          <Input
            value={step.description}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="Description (optional)"
            fontFamily="body"
            fontSize="md"
            bg="white"
            flex={2}
          />
          <IconButton
            aria-label="Remove step"
            size="sm"
            variant="ghost"
            color="charcoal.400"
            _hover={{ color: "red.500" }}
            onClick={onDelete}
          >
            <FiTrash2 />
          </IconButton>
        </HStack>
      </Timeline.Content>
    </Timeline.Item>
  );
}

export function DimensionEditModal({
  open,
  onClose,
  dimensionType,
  data,
  personas,
  perspectives,
  processes,
}: DimensionEditModalProps) {
  const label = TYPE_LABELS[dimensionType];
  const isEditing = !!data;

  // Mutations
  const createPersona = useMutation(api.personas.create);
  const updatePersona = useMutation(api.personas.update);
  const createUnit = useMutation(api.units.create);
  const updateUnit = useMutation(api.units.update);
  const createPerspective = useMutation(api.perspectives.create);
  const updatePerspective = useMutation(api.perspectives.update);
  const createProcess = useMutation(api.processes.create);
  const updateProcess = useMutation(api.processes.update);

  const fetchYoutubeTranscript = useAction(api.youtubeActions.fetchTranscript);

  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({
    title: "",
    description: "",
    systemPrompt: "",
    rubric: "",
    durationMinutes: "",
    youtubeUrl: "",
    videoTranscript: "",
    emoji: "",
    icon: "",
    personaId: "",
    perspectiveId: "",
    processId: "",
  });
  const [stepsData, setStepsData] = useState<StepWithId[]>([]);
  const nextIdRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  // Reset form when modal opens or data changes
  useEffect(() => {
    if (open) {
      nextIdRef.current = 0;
      setFormData({
        title: data?.title ?? "",
        description: data?.description ?? "",
        systemPrompt: data?.systemPrompt ?? "",
        rubric: data?.rubric ?? "",
        durationMinutes: data?.durationMinutes?.toString() ?? "",
        youtubeUrl: data?.youtubeUrl ?? "",
        videoTranscript: data?.videoTranscript ?? "",
        emoji: data?.emoji ?? "",
        icon: data?.icon ?? "",
        personaId: data?.personaId ?? "",
        perspectiveId: data?.perspectiveId ?? "",
        processId: data?.processId ?? "",
      });
      setTranscriptError(null);
      setStepsData(
        data?.steps?.map((s) => ({
          _id: `step-${nextIdRef.current++}`,
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
        } else if (dimensionType === "unit") {
          const dur = parseInt(formData.durationMinutes);
          await updateUnit({
            id: entityId as Id<"units">,
            title: formData.title,
            emoji: formData.emoji || undefined,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
            rubric: formData.rubric || undefined,
            durationMinutes: dur > 0 ? dur : null,
            youtubeUrl: formData.youtubeUrl || null,
            videoTranscript: formData.videoTranscript || null,
            personaId: formData.personaId ? formData.personaId as Id<"personas"> : null,
            perspectiveId: formData.perspectiveId ? formData.perspectiveId as Id<"perspectives"> : null,
            processId: formData.processId ? formData.processId as Id<"processes"> : null,
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
        } else if (dimensionType === "unit") {
          const dur = parseInt(formData.durationMinutes);
          await createUnit({
            title: formData.title,
            emoji: formData.emoji || undefined,
            description: formData.description || undefined,
            systemPrompt: formData.systemPrompt || undefined,
            rubric: formData.rubric || undefined,
            ...(dur > 0 ? { durationMinutes: dur } : {}),
            ...(formData.youtubeUrl ? { youtubeUrl: formData.youtubeUrl } : {}),
            ...(formData.videoTranscript ? { videoTranscript: formData.videoTranscript } : {}),
            ...(formData.personaId ? { personaId: formData.personaId as Id<"personas"> } : {}),
            ...(formData.perspectiveId ? { perspectiveId: formData.perspectiveId as Id<"perspectives"> } : {}),
            ...(formData.processId ? { processId: formData.processId as Id<"processes"> } : {}),
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
          <Dialog.Content maxW="80vw" maxH="85vh" overflow="hidden" bg="yellow.100" display="flex" flexDirection="column">
            <Dialog.Header px={6} pt={6} pb={2}>
              <Dialog.Title fontFamily="heading" color="navy.500" fontWeight="600" fontSize="xl">
                <HStack gap={2} align="center">
                  <Scroll size={22} weight="duotone" color="var(--chakra-colors-yellow-500)" />
                  {isEditing ? `Edit ${label}` : `New ${label}`}
                </HStack>
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body px={6} pb={4} flex={1} overflow="auto">
              <VStack gap={4} align="stretch">
                <HStack gap={4} align="start">
                  <Box pt="10px" flexShrink={0} w={LABEL_WIDTH}>
                    <Text fontSize="lg" fontWeight="600" fontFamily="heading" color="navy.500">
                      {dimensionType === "perspective" ? "Icon & Title" : "Emoji & Title"}
                    </Text>
                  </Box>
                  <HStack gap={3} flex={1} align="center">
                    <EmojiPickerButton
                      value={dimensionType === "perspective" ? formData.icon : formData.emoji}
                      onChange={(emoji) =>
                        setFormData((prev) => ({
                          ...prev,
                          [dimensionType === "perspective" ? "icon" : "emoji"]: emoji,
                        }))
                      }
                      label=""
                    />
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder={
                        dimensionType === "persona" ? "e.g., Sensei"
                        : dimensionType === "process" ? "e.g., CRAFT Writing"
                        : dimensionType === "perspective" ? "e.g., Big Ideas"
                        : "e.g., Animal Adaptations"
                      }
                      fontFamily="heading"
                      fontSize="lg"
                      flex={1}
                      bg="white"
                    />
                  </HStack>
                </HStack>

                <FieldRow
                  label="Description"
                  hint="Visible to students and teachers. Does not affect AI behavior."
                >
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder={`Brief description of this ${label.toLowerCase()}`}
                    rows={2}
                    fontFamily="body"
                    fontSize="md"
                    bg="white"
                  />
                </FieldRow>

                <FieldRow
                  label="System Prompt"
                  hint="Governs how the AI behaves. Not visible to students."
                >
                  <Textarea
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                    placeholder={dimensionType === "persona"
                      ? "How should the AI behave in this persona? e.g., 'You are a calm, patient Sensei...'"
                      : dimensionType === "perspective"
                      ? "How should the AI apply this thinking lens? e.g., 'Help the scholar identify patterns...'"
                      : "Instructions for the AI tutor for this project."}
                    rows={10}
                    fontFamily="body"
                    fontSize="md"
                    bg="white"
                  />
                </FieldRow>

                {dimensionType === "unit" && (
                  <>
                    <FieldRow
                      label="Rubric"
                      hint="Assessment criteria sent to the AI. Not visible to students."
                    >
                      <Textarea
                        value={formData.rubric}
                        onChange={(e) => setFormData((prev) => ({ ...prev, rubric: e.target.value }))}
                        placeholder="What should scholars demonstrate?"
                        rows={3}
                        fontFamily="body"
                        fontSize="md"
                        bg="white"
                      />
                    </FieldRow>
                    <FieldRow
                      label="Duration"
                      hint="Suggested session length in minutes. Used for AI pacing when focus-locked."
                    >
                      <HStack gap={2} align="center">
                        <Input
                          type="number"
                          value={formData.durationMinutes}
                          onChange={(e) => setFormData((prev) => ({ ...prev, durationMinutes: e.target.value }))}
                          placeholder="e.g. 45"
                          fontFamily="body"
                          fontSize="md"
                          bg="white"
                          maxW="120px"
                          min={1}
                        />
                        <Text fontSize="sm" color="charcoal.400" fontFamily="body">minutes</Text>
                      </HStack>
                    </FieldRow>
                    <FieldRow
                      label="YouTube Video"
                      hint="Paste a YouTube URL to fetch the transcript for video reflection units."
                    >
                      <VStack gap={2} align="stretch">
                        <HStack gap={2}>
                          <Input
                            value={formData.youtubeUrl}
                            onChange={(e) => setFormData((prev) => ({ ...prev, youtubeUrl: e.target.value }))}
                            placeholder="https://youtube.com/watch?v=..."
                            fontFamily="body"
                            fontSize="md"
                            bg="white"
                            flex={1}
                          />
                          <Button
                            size="md"
                            fontFamily="heading"
                            colorPalette="violet"
                            variant="outline"
                            disabled={!formData.youtubeUrl.trim() || isFetchingTranscript}
                            onClick={async () => {
                              setIsFetchingTranscript(true);
                              setTranscriptError(null);
                              try {
                                const result = await fetchYoutubeTranscript({ youtubeUrl: formData.youtubeUrl.trim() });
                                setFormData((prev) => ({ ...prev, videoTranscript: result.transcript }));
                              } catch (err: unknown) {
                                const msg = err instanceof Error ? err.message : "Failed to fetch transcript";
                                setTranscriptError(msg);
                              } finally {
                                setIsFetchingTranscript(false);
                              }
                            }}
                          >
                            {isFetchingTranscript ? <Spinner size="sm" /> : "Fetch"}
                          </Button>
                        </HStack>
                        {transcriptError && (
                          <Text fontSize="sm" color="red.500" fontFamily="body">{transcriptError}</Text>
                        )}
                        {formData.videoTranscript && (
                          <>
                            <Textarea
                              value={formData.videoTranscript}
                              onChange={(e) => setFormData((prev) => ({ ...prev, videoTranscript: e.target.value }))}
                              rows={8}
                              fontFamily="body"
                              fontSize="sm"
                              bg="white"
                              css={{ maxHeight: "300px", overflow: "auto" }}
                            />
                            <Text fontSize="xs" color="charcoal.400" fontFamily="body">
                              {formData.videoTranscript.length.toLocaleString()} characters — editable
                            </Text>
                          </>
                        )}
                      </VStack>
                    </FieldRow>
                    {(personas?.length || perspectives?.length || processes?.length) ? (
                      <FieldRow
                        label="Building Blocks"
                        hint="Optional persona, perspective, and process applied when this unit is active."
                      >
                        <VStack gap={3} align="stretch">
                          {personas && personas.length > 0 && (
                            <select
                              value={formData.personaId}
                              onChange={(e) => setFormData((prev) => ({ ...prev, personaId: e.target.value }))}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0",
                                fontSize: "16px",
                                fontFamily: "inherit",
                              }}
                            >
                              <option value="">No Persona</option>
                              {personas.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.emoji} {p.title}
                                </option>
                              ))}
                            </select>
                          )}
                          {perspectives && perspectives.length > 0 && (
                            <select
                              value={formData.perspectiveId}
                              onChange={(e) => setFormData((prev) => ({ ...prev, perspectiveId: e.target.value }))}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0",
                                fontSize: "16px",
                                fontFamily: "inherit",
                              }}
                            >
                              <option value="">No Perspective</option>
                              {perspectives.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.icon || "🔍"} {p.title}
                                </option>
                              ))}
                            </select>
                          )}
                          {processes && processes.length > 0 && (
                            <select
                              value={formData.processId}
                              onChange={(e) => setFormData((prev) => ({ ...prev, processId: e.target.value }))}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0",
                                fontSize: "16px",
                                fontFamily: "inherit",
                              }}
                            >
                              <option value="">No Process</option>
                              {processes.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.emoji || "📋"} {p.title}
                                </option>
                              ))}
                            </select>
                          )}
                        </VStack>
                      </FieldRow>
                    ) : null}
                  </>
                )}

                {dimensionType === "process" && (
                  <FieldRow label="Steps">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToVerticalAxis]}
                      onDragEnd={(event: DragEndEvent) => {
                        const { active, over } = event;
                        if (over && active.id !== over.id) {
                          setStepsData((items) => {
                            const oldIndex = items.findIndex((i) => i._id === active.id);
                            const newIndex = items.findIndex((i) => i._id === over.id);
                            return arrayMove(items, oldIndex, newIndex);
                          });
                        }
                      }}
                    >
                      <SortableContext
                        items={stepsData.map((s) => s._id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <Timeline.Root size="xl">
                          {stepsData.map((step) => (
                            <SortableStep
                              key={step._id}
                              step={step}
                              onChange={(field, value) => {
                                setStepsData((prev) =>
                                  prev.map((s) =>
                                    s._id === step._id ? { ...s, [field]: value } : s
                                  )
                                );
                              }}
                              onDelete={() =>
                                setStepsData((prev) => prev.filter((s) => s._id !== step._id))
                              }
                            />
                          ))}
                        </Timeline.Root>
                      </SortableContext>
                    </DndContext>
                    <Button
                      size="sm"
                      variant="outline"
                      fontFamily="heading"
                      mt={2}
                      onClick={() =>
                        setStepsData((prev) => [
                          ...prev,
                          { _id: `step-${nextIdRef.current++}`, key: "", title: "", description: "" },
                        ])
                      }
                    >
                      <FiPlus style={{ marginRight: "6px" }} />
                      Add Step
                    </Button>
                  </FieldRow>
                )}

              </VStack>
            </Dialog.Body>
            <Dialog.Footer px={6} py={4} borderTop="1px solid" borderColor="yellow.200">
              <HStack gap={2} width="100%">
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
                  colorPalette="yellow"
                  fontFamily="heading"
                  onClick={handleSave}
                  disabled={isSaving || !canSave}
                >
                  {isSaving ? <Spinner size="sm" /> : "Save"}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
