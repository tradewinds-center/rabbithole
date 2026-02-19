"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Drawer,
  Flex,
  VStack,
  Text,
  Textarea,
  IconButton,
  Menu,
  Spinner,
  Splitter,
  Tooltip,
  Portal,
} from "@chakra-ui/react";
import { FiArrowUp, FiCamera, FiClock, FiEdit2, FiHome, FiImage, FiLock, FiMic, FiMicOff, FiSend, FiUpload, FiVolume2, FiX } from "react-icons/fi";
import { useRouter } from "next/navigation";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import { useTTS } from "@/hooks/useTTS";
import { useTimeLimit } from "@/hooks/useTimeLimit";
import { TimeLimitModal } from "./TimeLimitModal";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { ProjectHeader } from "./ProjectHeader";
import { ArtifactPanel } from "./ArtifactPanel";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const chatMarkdownComponents: Components = {
  em: ({ children, ...props }) => {
    const text = typeof children === "string" ? children : "";
    if (text.startsWith("[") && text.endsWith("]")) {
      return <em style={{ color: "var(--chakra-colors-charcoal-300, #999)" }}>{text}</em>;
    }
    return <em {...props}>{children}</em>;
  },
};

interface DimensionOption {
  id: string;
  title: string;
  emoji?: string | null;
  icon?: string | null;
}

interface ProjectInterfaceProps {
  projectId: string;
  onProjectUpdate?: () => void;
  onOpenSidebar?: () => void;
  onSignOut?: () => void;
  userName?: string;
  userImage?: string;
  isTestMode?: boolean;
  isAdmin?: boolean;
  isRemoteMode?: boolean;
}

export function ProjectInterface({
  projectId,
  onProjectUpdate,
  onOpenSidebar,
  onSignOut,
  userName,
  userImage,
  isTestMode,
  isAdmin,
  isRemoteMode,
}: ProjectInterfaceProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const welcomeSentRef = useRef<string | null>(null);
  const [whisperInput, setWhisperInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convex queries for dimension options (reactive, auto-updating)
  const units = useQuery(api.units.list) ?? [];
  const processes = useQuery(api.processes.list) ?? [];
  const personas = useQuery(api.personas.list) ?? [];

  // Focus lock from teacher (Phase 1: only unitId)
  const currentFocus = useQuery(api.focus.getCurrent);
  const focusLock = currentFocus?.isActive
    ? { unitId: currentFocus.unitId ? String(currentFocus.unitId) : null }
    : null;

  const unitOptions: DimensionOption[] = units.map((u) => ({
    id: u._id,
    title: u.title,
    emoji: u.emoji ?? undefined,
  }));

  // Persona options for message bubble labels (still need persona list for historical snapshots)
  const personaOptions: DimensionOption[] = personas.map((p) => ({
    id: p._id,
    title: p.title,
    emoji: p.emoji,
  }));

  // Convex query for project + messages (reactive, auto-updating)
  const projectData = useQuery(
    api.projects.getWithMessages,
    { id: projectId as Id<"projects"> }
  );

  const messages = projectData?.messages ?? [];
  const activeProject = projectData?.project
    ? {
        title: projectData.project.title,
        unitId: projectData.project.unitId
          ? String(projectData.project.unitId)
          : null,
      }
    : {
        title: "New Project",
        unitId: null,
      };

  // Resolve building blocks from the active unit
  const activeUnit = activeProject.unitId
    ? units.find((u) => u._id === activeProject.unitId)
    : null;

  // Process state (reactive query, updates when AI tool fires)
  // Derive processId from the unit's building block
  const unitProcessId = activeUnit?.processId ? String(activeUnit.processId) : null;
  const processState = useQuery(
    api.processState.getByProject,
    unitProcessId
      ? { projectId: projectId as Id<"projects"> }
      : "skip"
  );

  // Look up the full process definition from the unit's building block
  const activeProcessDef = unitProcessId
    ? processes.find((p) => p._id === unitProcessId)
    : null;

  // Artifacts (reactive query, returns array)
  const artifacts = useQuery(
    api.artifacts.getByProject,
    { projectId: projectId as Id<"projects"> }
  ) ?? [];
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveArtifact = useMutation(api.artifacts.scholarUpdate);
  const createArtifact = useMutation(api.artifacts.scholarCreate);
  const deleteArtifactMut = useMutation(api.artifacts.deleteArtifact);
  const [artifactSynced, setArtifactSynced] = useState(true);

  // Active artifact tab
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);

  // Auto-select last artifact when artifacts change
  useEffect(() => {
    if (artifacts.length > 0) {
      const currentStillExists = artifacts.some((a) => a._id === activeArtifactId);
      if (!currentStillExists) {
        setActiveArtifactId(artifacts[artifacts.length - 1]._id);
      }
    } else {
      setActiveArtifactId(null);
    }
  }, [artifacts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Right panel state
  const hasProcess = !!(activeProcessDef && processState);
  const hasArtifacts = artifacts.length > 0;
  const hasRightPanelContent = hasProcess || hasArtifacts || !!activeUnit?.youtubeUrl;
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Auto-open when content appears
  useEffect(() => {
    if (hasRightPanelContent) {
      setRightPanelOpen(true);
    }
  }, [hasRightPanelContent]);

  const showRightPanel = rightPanelOpen && hasRightPanelContent;

  // Mobile detection
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  // Mobile drawer for right panel
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const rightPanelItemCount = artifacts.length + (hasProcess ? 1 : 0) + (activeUnit?.youtubeUrl ? 1 : 0);

  // Convex mutation for updating project dimensions
  const updateProject = useMutation(api.projects.update);

  // Convex mutation for sending messages
  const sendMsg = useMutation(api.projects.sendMessage);

  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const { state: dictationState, error: dictationError, isTooLoud, toggleRecording, startRecording, stopRecording } =
    useVoiceDictation((text) => {
      sendMessageRef.current(text);
    });

  // Time limit mode
  const timeLimit = useTimeLimit(
    projectId,
    projectData?.project?.sessionTimeLimit,
    projectData?.project?.sessionStartTime,
  );
  const [isTimeLimitModalOpen, setIsTimeLimitModalOpen] = useState(false);

  // Loading state: projectData is undefined while the query is loading
  const isLoading = projectData === undefined;

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Auto-focus textarea when project changes or finishes loading
  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading, projectId]);

  // Focus mismatch: teacher locked a unit but this project has a different one
  const isFocusMismatch = !isTestMode && focusLock?.unitId != null &&
    String(projectData?.project?.unitId ?? "") !== focusLock.unitId;

  // Handle unit change via Convex mutation
  const handleUnitChange = async (value: string | null) => {
    // Skip if unit is locked by focus (unless in test mode)
    if (!isTestMode && focusLock?.unitId != null) return;
    try {
      await updateProject({
        id: projectId as Id<"projects">,
        unitId: (value as Id<"units">) ?? null,
      });
      onProjectUpdate?.();
    } catch (error) {
      console.error("Error updating unit:", error);
    }
  };

  // Pending whisper from project data (reactive)
  const pendingWhisper = projectData?.project?.pendingWhisper ?? null;

  // Mastery observations for this project (teacher only, for inline debug display)
  const projectObservations = useQuery(
    api.masteryObservations.byProject,
    isRemoteMode ? { projectId: projectId as Id<"projects"> } : "skip"
  ) ?? [];

  // Send whisper via project update mutation
  const handleSendWhisper = async () => {
    const text = whisperInput.trim();
    if (!text) return;
    await updateProject({
      id: projectId as Id<"projects">,
      pendingWhisper: text,
    });
    setWhisperInput("");
  };

  const handleClearWhisper = async () => {
    await updateProject({
      id: projectId as Id<"projects">,
      pendingWhisper: null,
    });
  };

  // Send message via Convex mutation + HTTP streaming
  const handleSend = async (directText?: string) => {
    const rawMessage = directText?.trim() || input.trim();
    // Allow sending with just an image (use placeholder text)
    const userMessage = rawMessage || (pendingImage ? "What do you see in this image?" : "");
    if (!userMessage || isStreaming) return;

    // Upload image if attached
    let imageId: string | null = null;
    if (pendingImage) {
      try {
        const uploadUrl = await generateUploadUrl();
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": pendingImage.file.type },
          body: pendingImage.file,
        });
        const { storageId } = await uploadRes.json();
        imageId = storageId;
      } catch (err) {
        console.error("Image upload failed:", err);
      }
    }

    setInput("");
    setPendingImage(null);
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingMsgId(null);

    try {
      // Send message via Convex mutation (creates user msg + placeholder assistant msg)
      const result = await sendMsg({
        projectId: projectId as Id<"projects">,
        message: userMessage,
        ...(imageId ? { imageId: imageId as Id<"_storage"> } : {}),
      });

      // Track the placeholder message ID so we can hide it while streaming
      setStreamingMsgId(result.assistantMsgId);

      // Stream from HTTP action
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!.replace(
        ".cloud",
        ".site"
      );
      const res = await fetch(`${convexUrl}/project-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: result.projectId,
          streamId: result.streamId,
          assistantMsgId: result.assistantMsgId,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.generatingImage === "started") {
                  setGeneratingImage(true);
                }
                if (data.generatedImage) {
                  setGeneratingImage(false);
                }
                if (data.text) {
                  fullContent += data.text;
                  setStreamingContent(fullContent);
                } else if (data.newArtifactId) {
                  // AI created a new document — select it and open panel
                  setActiveArtifactId(data.newArtifactId);
                  setRightPanelOpen(true);
                }
                if (data.newAssistantMsg) {
                  // Tool fired — server split the message. Switch streaming target.
                  setStreamingMsgId(data.newAssistantMsg);
                  fullContent = "";
                  setStreamingContent("");
                } else if (data.done) {
                  // Stream finalized on the server side.
                  // Convex reactive query will auto-update messages.
                  setStreamingContent("");
                  setStreamingMsgId(null);
                  setGeneratingImage(false);
                  onProjectUpdate?.();
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setStreamingMsgId(null);
    } finally {
      setIsStreaming(false);
    }
  };

  // Keep ref in sync so dictation callback can call latest handleSend
  sendMessageRef.current = handleSend;

  // Auto-send <start> to get AI greeting for every new project
  useEffect(() => {
    if (
      projectData &&
      messages.length === 0 &&
      !isStreaming &&
      welcomeSentRef.current !== projectId
    ) {
      welcomeSentRef.current = projectId;
      handleSend("<start>");
    }
  }, [projectData, isStreaming, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [input]);

  // Artifact callbacks
  const handleCreateArtifact = useCallback(async () => {
    const newId = await createArtifact({
      projectId: projectId as Id<"projects">,
    });
    setActiveArtifactId(newId);
    setRightPanelOpen(true);
  }, [projectId, createArtifact]);

  const handleDeleteArtifact = useCallback(async (id: string) => {
    await deleteArtifactMut({ artifactId: id as Id<"artifacts"> });
  }, [deleteArtifactMut]);

  const handleSaveArtifact = useCallback((artifactId: string, updates: { content?: string; title?: string }) => {
    saveArtifact({
      artifactId: artifactId as Id<"artifacts">,
      ...updates,
    }).catch(console.error);
  }, [saveArtifact]);

  if (isLoading) {
    return (
      <Flex flex={1} align="center" justify="center">
        <Spinner size="lg" color="violet.500" />
      </Flex>
    );
  }

  return (
    <Flex flex={1} flexDir="column" overflow="hidden" bg="white">
      {/* Project Header with dimension selectors */}
      <ProjectHeader
        projectTitle={activeProject.title}
        unitId={activeProject.unitId}
        unitOptions={unitOptions}
        pulseScore={projectData?.project?.pulseScore ?? null}
        lastMessageAt={(() => {
          const userMsgs = messages.filter((m) => m.role === "user");
          return userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].createdAt : null;
        })()}
        onMenuClick={onOpenSidebar}
        isSynced={hasArtifacts ? artifactSynced : undefined}
        userName={userName}
        userImage={userImage}
        isTestMode={isTestMode}
        isAdmin={isAdmin}
        onSignOut={onSignOut}
        onProjectRename={(title) => updateProject({ id: projectId as Id<"projects">, title })}
        showRightPanel={showRightPanel}
        onToggleRightPanel={isTouchDevice
          ? undefined  // Hide desktop toggle on mobile
          : hasRightPanelContent ? () => setRightPanelOpen((v) => !v) : undefined
        }
        mobileAttachmentCount={isTouchDevice ? rightPanelItemCount : undefined}
        onMobileAttachmentClick={isTouchDevice && hasRightPanelContent ? () => setMobileDrawerOpen(true) : undefined}
        isMobile={isTouchDevice}
      />

      {/* Focus mismatch banner — read-only mode */}
      {isFocusMismatch && (() => {
        const lockedUnit = units.find((u) => String(u._id) === focusLock?.unitId);
        return (
          <Flex
            px={4}
            py={3}
            bg="orange.100"
            borderBottom="1px solid"
            borderColor="orange.200"
            align="center"
            gap={3}
          >
            <FiLock size={16} color="var(--chakra-colors-orange-600)" />
            <Text fontSize="sm" fontFamily="heading" color="orange.800" flex={1}>
              Your teacher set a different activity{lockedUnit ? ` (${lockedUnit.emoji ?? ""} ${lockedUnit.title})` : ""}. You can read this project but not add messages.
            </Text>
            <Box
              as="button"
              px={3}
              py={1.5}
              bg="orange.500"
              color="white"
              borderRadius="lg"
              fontFamily="heading"
              fontWeight="600"
              fontSize="sm"
              _hover={{ bg: "orange.600" }}
              cursor="pointer"
              onClick={() => router.push("/scholar")}
              display="flex"
              alignItems="center"
              gap={1.5}
            >
              <FiHome size={14} />
              Go Home
            </Box>
          </Flex>
        );
      })()}

      {/* Main content area with optional right panel */}
      {(() => {
        const chatProps: ChatColumnProps = {
          messages,
          streamingContent,
          streamingMsgId,
          personaOptions,
          isStreaming,
          input,
          setInput,
          handleKeyDown,
          handleSend,
          textareaRef,
          messagesEndRef,
          dictationState,
          dictationError,
          toggleRecording,
          startRecording,
          stopRecording,
          isRemoteMode,
          whisperInput,
          setWhisperInput,
          pendingWhisper,
          onSendWhisper: handleSendWhisper,
          onClearWhisper: handleClearWhisper,
          observations: projectObservations,
          isTooLoud,
          generatingImage,
          timeLimit,
          isTimeLimitModalOpen,
          onToggleTimeLimitModal: () => setIsTimeLimitModalOpen((v) => !v),
          pendingImage,
          setPendingImage,
          onSelectImage: () => fileInputRef.current?.click(),
          onClearImage: () => setPendingImage(null),
          fileInputRef,
          onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file && file.type.startsWith("image/")) {
              const preview = URL.createObjectURL(file);
              setPendingImage({ file, preview });
            }
            e.target.value = ""; // Reset so same file can be re-selected
          },
          isFocusMismatch,
          isTouchDevice,
        };

        const artifactPanelElement = (
          <ArtifactPanel
            artifacts={artifacts}
            activeArtifactId={activeArtifactId}
            onSelectArtifact={setActiveArtifactId}
            onSave={handleSaveArtifact}
            onCreateArtifact={handleCreateArtifact}
            onDeleteArtifact={handleDeleteArtifact}
            onSyncChange={setArtifactSynced}
            youtubeUrl={activeUnit?.youtubeUrl}
            process={hasProcess ? {
              title: activeProcessDef!.title,
              emoji: activeProcessDef!.emoji ?? null,
              steps: activeProcessDef!.steps,
            } : null}
            processCurrentStep={hasProcess ? processState!.currentStep : undefined}
            processSteps={hasProcess ? processState!.steps : undefined}
          />
        );

        // Mobile: full-width chat + bottom drawer for right panel
        if (isTouchDevice) {
          return (
            <>
              <Flex flex={1} overflow="hidden">
                <ChatColumn {...chatProps} />
              </Flex>
              {hasRightPanelContent && (
                <Drawer.Root
                  open={mobileDrawerOpen}
                  onOpenChange={(e) => setMobileDrawerOpen(e.open)}
                  placement="bottom"
                  size="xl"
                >
                  <Drawer.Backdrop />
                  <Drawer.Positioner>
                    <Drawer.Content
                      borderTopRadius="2xl"
                      bg="gray.50"
                      maxH="85vh"
                      display="flex"
                      flexDirection="column"
                    >
                      <Flex
                        px={4}
                        pt={3}
                        pb={2}
                        align="center"
                        justify="space-between"
                        flexShrink={0}
                      >
                        <Text fontSize="sm" fontFamily="heading" fontWeight="600" color="navy.500">
                          Attachments
                        </Text>
                        <Drawer.CloseTrigger asChild>
                          <IconButton
                            aria-label="Close"
                            size="xs"
                            variant="ghost"
                            color="charcoal.400"
                          >
                            <FiX />
                          </IconButton>
                        </Drawer.CloseTrigger>
                      </Flex>
                      <Box flex={1} minH={0} overflowY="auto" px={4} pb={4}>
                        {artifactPanelElement}
                      </Box>
                    </Drawer.Content>
                  </Drawer.Positioner>
                </Drawer.Root>
              )}
            </>
          );
        }

        // Desktop: splitter layout
        return showRightPanel ? (
          <Splitter.Root
            flex={1}
            overflow="hidden"
            defaultSize={[70, 30]}
            panels={[
              { id: "chat", minSize: 40 },
              { id: "side", minSize: 25 },
            ]}
          >
            <Splitter.Panel id="chat">
              <ChatColumn {...chatProps} />
            </Splitter.Panel>
            <Splitter.ResizeTrigger id="chat:side" css={{ "--splitter-border-size": "0.5px" }} />
            <Splitter.Panel id="side">
              <Flex h="full" flexDir="column" overflow="hidden">
                {artifactPanelElement}
              </Flex>
            </Splitter.Panel>
          </Splitter.Root>
        ) : (
          <Flex flex={1} overflow="hidden">
            <ChatColumn {...chatProps} />
          </Flex>
        );
      })()}
    </Flex>
  );
}

// Chat column extracted to avoid duplication between splitter/non-splitter layouts
interface ChatColumnProps {
  messages: MessageData[];
  streamingContent: string;
  streamingMsgId: string | null;
  personaOptions: DimensionOption[];
  isStreaming: boolean;
  input: string;
  setInput: (v: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleSend: (text?: string) => void;
  textareaRef: React.Ref<HTMLTextAreaElement>;
  messagesEndRef: React.Ref<HTMLDivElement>;
  dictationState: "idle" | "recording" | "transcribing";
  dictationError: string | null;
  toggleRecording: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  isRemoteMode?: boolean;
  whisperInput?: string;
  setWhisperInput?: (v: string) => void;
  pendingWhisper?: string | null;
  onSendWhisper?: () => void;
  onClearWhisper?: () => void;
  observations?: ObservationData[];
  isTooLoud?: boolean;
  generatingImage?: boolean;
  timeLimit?: {
    isActive: boolean;
    secondsRemaining: number;
    totalSeconds: number;
    isExpired: boolean;
    display: string;
    setLimit: (minutes: number, password: string) => Promise<void>;
    clearLimit: (password: string) => Promise<void>;
  };
  isTimeLimitModalOpen?: boolean;
  onToggleTimeLimitModal?: () => void;
  pendingImage?: { file: File; preview: string } | null;
  setPendingImage?: (img: { file: File; preview: string } | null) => void;
  onSelectImage?: () => void;
  onClearImage?: () => void;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  onFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isFocusMismatch?: boolean;
  isTouchDevice?: boolean;
}

function ChatColumn({
  messages,
  streamingContent,
  streamingMsgId,
  personaOptions,
  isStreaming,
  input,
  setInput,
  handleKeyDown,
  handleSend,
  textareaRef,
  messagesEndRef,
  dictationState,
  dictationError,
  toggleRecording,
  startRecording,
  stopRecording,
  isRemoteMode,
  whisperInput,
  setWhisperInput,
  pendingWhisper,
  onSendWhisper,
  onClearWhisper,
  observations = [],
  isTooLoud = false,
  generatingImage = false,
  timeLimit,
  isTimeLimitModalOpen = false,
  onToggleTimeLimitModal,
  pendingImage,
  setPendingImage,
  onSelectImage,
  onClearImage,
  fileInputRef,
  onFileChange,
  isFocusMismatch = false,
  isTouchDevice = false,
}: ChatColumnProps) {
  const micBtnRef = useRef<HTMLButtonElement>(null);
  const tabHeldRef = useRef(false);
  const tabTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Camera capture state
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const openCamera = useCallback(async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setShowCamera(false);
    }
  }, []);

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      const preview = URL.createObjectURL(file);
      setPendingImage?.({ file, preview });
      closeCamera();
    }, "image/jpeg", 0.92);
  }, [closeCamera, setPendingImage]);

  // Walkie-talkie: Tab hold → record, Tab release → stop & send
  // Quick tap (<200ms) is a no-op so normal Tab usage isn't hijacked
  // Disabled on touch devices — they use tap-to-toggle instead
  useEffect(() => {
    if (isTouchDevice) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      // Don't hijack Tab when user is in an input/textarea that isn't ours
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      e.preventDefault();
      if (e.repeat) return;
      if (!tabHeldRef.current && !isStreaming && dictationState === "idle") {
        tabHeldRef.current = true;
        tabTimerRef.current = setTimeout(() => {
          tabTimerRef.current = null;
          if (tabHeldRef.current) startRecording();
        }, 200);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      if (tabHeldRef.current) {
        tabHeldRef.current = false;
        // Released before 200ms threshold — cancel, don't record
        if (tabTimerRef.current) {
          clearTimeout(tabTimerRef.current);
          tabTimerRef.current = null;
        } else {
          stopRecording();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (tabTimerRef.current) clearTimeout(tabTimerRef.current);
    };
  }, [isStreaming, dictationState, startRecording, stopRecording, isTouchDevice]);

  // Compute ripple center from mic button position
  const [rippleCenter, setRippleCenter] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (dictationState === "recording" && micBtnRef.current) {
      const rect = micBtnRef.current.getBoundingClientRect();
      setRippleCenter({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    } else {
      setRippleCenter(null);
    }
  }, [dictationState]);

  return (
    <Flex flex={1} flexDir="column" overflow="hidden" h="full">
      {/* Recording ripple — 3 divs with GPU-accelerated transform+opacity only */}
      {dictationState === "recording" && rippleCenter && (
        <>
          <style>{`
            @keyframes rippleGrow {
              0% { transform: translate(-50%, -50%) scale(0); opacity: 0.5; }
              100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
            }
          `}</style>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: "fixed",
                left: rippleCenter.x,
                top: rippleCenter.y,
                width: "250vmax",
                height: "250vmax",
                borderRadius: "50%",
                border: "4px solid rgba(229, 62, 62, 0.9)",
                pointerEvents: "none",
                zIndex: 9998,
                willChange: "transform, opacity",
                animation: `rippleGrow 15s linear infinite ${-i * 5}s`,
              }}
            />
          ))}
        </>
      )}

      {/* Volume warning overlay */}
      {isTooLoud && dictationState === "recording" && (
        <Flex
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={9999}
          align="center"
          justify="center"
          pointerEvents="none"
          bg="rgba(229, 62, 62, 0.15)"
        >
          <Text
            fontSize="6xl"
            fontWeight="900"
            fontFamily="heading"
            color="red.600"
            textShadow="0 2px 8px rgba(229, 62, 62, 0.3)"
            css={{
              animation: "loudPulse 0.5s ease-in-out infinite alternate",
              "@keyframes loudPulse": {
                "0%": { transform: "scale(1)", opacity: 0.9 },
                "100%": { transform: "scale(1.08)", opacity: 1 },
              },
            }}
          >
            TOO LOUD!
          </Text>
        </Flex>
      )}

      {/* Messages */}
      <Box flex={1} overflowY="auto" px={6} py={4}>
        <VStack gap={4} maxW="3xl" mx="auto" align="stretch">
          {messages.length === 0 && !streamingContent && (
            <Flex py={12} justify="center">
              <Spinner size="lg" color="violet.500" />
            </Flex>
          )}

          {(() => {
            const filteredMsgs = messages
              .filter((m) => m.role !== "system")
              .filter((m) => !(m.role === "user" && m.content === "<start>"))
              .filter((m) => isRemoteMode || m.toolAction !== "whisper");

            // Build a unified timeline: messages + observations (teacher only)
            type TimelineItem =
              | { kind: "message"; data: MessageData; time: number }
              | { kind: "observation"; data: ObservationData; time: number };
            const timeline: TimelineItem[] = filteredMsgs.map((m) => ({
              kind: "message" as const,
              data: m,
              time: m.createdAt,
            }));
            if (isRemoteMode && observations.length > 0) {
              for (const obs of observations) {
                timeline.push({
                  kind: "observation" as const,
                  data: obs,
                  time: obs.observedAt,
                });
              }
            }
            timeline.sort((a, b) => a.time - b.time);

            return timeline.map((item) => {
              if (item.kind === "observation") {
                const obs = item.data;
                const bloomLabel = obs.masteryLevel >= 4.5 ? "Create"
                  : obs.masteryLevel >= 3.5 ? "Evaluate"
                  : obs.masteryLevel >= 2.5 ? "Analyze"
                  : obs.masteryLevel >= 1.5 ? "Apply"
                  : obs.masteryLevel >= 0.5 ? "Understand"
                  : "Remember";
                return (
                  <Flex
                    key={`obs-${obs._id}`}
                    justify="center"
                    py={1}
                    gap={1.5}
                    align="center"
                    opacity={obs.isSuperseded ? 0.4 : 1}
                  >
                    <Text fontSize="xs" color="teal.500" fontFamily="heading" fontWeight="600">
                      {obs.studentInitiated ? "★" : "◆"} {obs.conceptLabel}
                    </Text>
                    <Text fontSize="xs" color="teal.600" fontFamily="body">
                      {obs.domain} · {bloomLabel} ({obs.masteryLevel.toFixed(1)}) · conf {(obs.confidenceScore * 100).toFixed(0)}%
                    </Text>
                    <Text fontSize="xs" color="teal.400" fontFamily="body" fontStyle="italic" truncate maxW="300px">
                      {obs.evidenceSummary}
                    </Text>
                  </Flex>
                );
              }

              const message = item.data;
              if (message.role === "tool") {
                if (message.toolAction === "whisper") {
                  return (
                    <Flex
                      key={message.id}
                      justify="center"
                      py={1}
                      gap={1.5}
                      align="center"
                    >
                      <Text
                        fontSize="xs"
                        color="orange.500"
                        fontFamily="heading"
                        fontWeight="600"
                      >
                        Whisper:
                      </Text>
                      <Text
                        fontSize="xs"
                        color="orange.600"
                        fontFamily="body"
                        fontStyle="italic"
                      >
                        {message.content}
                      </Text>
                    </Flex>
                  );
                }
                return (
                  <Box key={message.id} textAlign="center" py={1}>
                    {message.imageId && <GeneratedImage imageId={message.imageId} />}
                    <Text
                      fontSize="xs"
                      color="charcoal.300"
                      fontFamily="heading"
                      textAlign="center"
                    >
                      {message.toolAction}
                    </Text>
                  </Box>
                );
              }

              const isActiveStream = streamingMsgId && message.id === streamingMsgId;
              return (
                <MessageBubble
                  key={message.id}
                  message={isActiveStream ? { ...message, content: streamingContent || message.content } : message}
                  personaOptions={personaOptions}
                  isStreaming={!!isActiveStream && !!streamingContent}
                  generatingImage={!!isActiveStream && generatingImage}
                />
              );
            });
          })()}

          {/* Typing indicator */}
          {isStreaming && !streamingContent && !generatingImage && (
            <Box
              alignSelf="flex-start"
              bg="gray.100"
              px={4}
              py={3}
              borderRadius="xl"
              borderBottomLeftRadius="sm"
            >
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      {/* Whisper Bar (remote mode only) */}
      {isRemoteMode && (
        <Box
          px={4}
          py={2}
          bg="orange.50"
          borderTop="1px solid"
          borderColor="orange.200"
        >
          <Flex maxW="3xl" mx="auto" gap={2} align="center">
            <Text
              fontSize="xs"
              fontFamily="heading"
              color="orange.600"
              fontWeight="600"
              whiteSpace="nowrap"
            >
              Whisper
            </Text>
            {pendingWhisper ? (
              <Flex flex={1} align="center" gap={2}>
                <Text
                  fontSize="sm"
                  fontFamily="body"
                  color="orange.700"
                  flex={1}
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  Queued: {pendingWhisper}
                </Text>
                <IconButton
                  aria-label="Edit whisper"
                  size="xs"
                  variant="ghost"
                  color="orange.500"
                  _hover={{ bg: "orange.100" }}
                  onClick={() => {
                    setWhisperInput?.(pendingWhisper ?? "");
                    onClearWhisper?.();
                  }}
                >
                  <FiEdit2 />
                </IconButton>
                <IconButton
                  aria-label="Clear whisper"
                  size="xs"
                  variant="ghost"
                  color="orange.500"
                  _hover={{ bg: "orange.100" }}
                  onClick={onClearWhisper}
                >
                  <FiX />
                </IconButton>
              </Flex>
            ) : (
              <>
                <Textarea
                  value={whisperInput ?? ""}
                  onChange={(e) => setWhisperInput?.(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSendWhisper?.();
                    }
                  }}
                  placeholder="Private guidance for AI..."
                  resize="none"
                  rows={1}
                  overflow="hidden"
                  bg="white"
                  border="1px solid"
                  borderColor="orange.300"
                  borderRadius="lg"
                  _focus={{
                    borderColor: "orange.400",
                    boxShadow: "none",
                    outline: "none",
                  }}
                  _focusVisible={{
                    boxShadow: "none",
                    outline: "none",
                  }}
                  _placeholder={{ color: "orange.300" }}
                  fontFamily="body"
                  fontSize="sm"
                  py={1.5}
                  px={3}
                />
                <IconButton
                  aria-label="Send whisper"
                  size="sm"
                  bg="orange.400"
                  color="white"
                  _hover={{ bg: "orange.500" }}
                  _disabled={{ opacity: 0.4 }}
                  borderRadius="lg"
                  onClick={onSendWhisper}
                  disabled={!whisperInput?.trim()}
                >
                  <FiSend />
                </IconButton>
              </>
            )}
          </Flex>
        </Box>
      )}

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef as React.RefObject<HTMLInputElement>}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFileChange}
      />

      {/* Camera capture overlay */}
      {showCamera && (
        <Flex
          position="absolute"
          inset={0}
          zIndex={10000}
          bg="black"
          flexDir="column"
          align="center"
          justify="center"
        >
          <Box position="relative" maxW="100%" maxH="100%" flex={1} display="flex" alignItems="center" justifyContent="center">
            <video
              ref={(el) => {
                (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
                if (el && streamRef.current) el.srcObject = streamRef.current;
              }}
              autoPlay
              playsInline
              muted
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", transform: "scaleX(-1)" }}
            />
          </Box>
          <Flex gap={4} py={4}>
            <IconButton
              aria-label="Cancel"
              onClick={closeCamera}
              bg="whiteAlpha.200"
              color="white"
              _hover={{ bg: "whiteAlpha.400" }}
              borderRadius="full"
              size="lg"
              w={14}
              h={14}
            >
              <FiX size={24} />
            </IconButton>
            <IconButton
              aria-label="Take photo"
              onClick={capturePhoto}
              bg="white"
              color="gray.800"
              _hover={{ bg: "gray.200" }}
              borderRadius="full"
              size="lg"
              w={16}
              h={16}
            >
              <FiCamera size={28} />
            </IconButton>
          </Flex>
        </Flex>
      )}

      {/* Time Limit Modal */}
      {timeLimit && (
        <TimeLimitModal
          isOpen={isTimeLimitModalOpen}
          onClose={() => onToggleTimeLimitModal?.()}
          isActive={timeLimit.isActive}
          display={timeLimit.display}
          onSetLimit={timeLimit.setLimit}
          onClearLimit={timeLimit.clearLimit}
        />
      )}

      {/* Input Area */}
      <Box
        p={4}
        borderTop="0.5px solid"
        borderColor="gray.200"
        bg={timeLimit?.isExpired ? "red.50" : "gray.50"}
        shadow="0 -1px 3px rgba(0,0,0,0.06)"
        position="relative"
        zIndex={10}
      >
        {/* Pending image preview */}
        {pendingImage && (
          <Flex maxW="3xl" mx="auto" mb={2} position="relative" display="inline-flex">
            <Box
              borderRadius="lg"
              overflow="hidden"
              border="1px solid"
              borderColor="gray.200"
              position="relative"
              maxH="120px"
            >
              <img
                src={pendingImage.preview}
                alt="Upload preview"
                style={{ maxHeight: "120px", objectFit: "cover", borderRadius: "8px" }}
              />
              <IconButton
                aria-label="Remove image"
                size="xs"
                variant="solid"
                bg="blackAlpha.600"
                color="white"
                _hover={{ bg: "blackAlpha.800" }}
                position="absolute"
                top={1}
                right={1}
                borderRadius="full"
                onClick={onClearImage}
              >
                <FiX size={12} />
              </IconButton>
            </Box>
          </Flex>
        )}
        {/* Timer countdown bar */}
        {timeLimit?.isActive && !timeLimit.isExpired && (
          <Flex maxW="3xl" mx="auto" mb={2} align="center" gap={2}>
            <FiClock size={14} color={timeLimit.secondsRemaining <= 60 ? "#E53E3E" : "#DD6B20"} />
            <Text
              fontSize="sm"
              fontFamily="heading"
              fontWeight="600"
              color={timeLimit.secondsRemaining <= 60 ? "red.500" : "orange.500"}
            >
              {timeLimit.display}
            </Text>
            <Box flex={1} h="3px" bg="gray.200" borderRadius="full" overflow="hidden">
              <Box
                h="full"
                bg={timeLimit.secondsRemaining <= 60 ? "red.400" : "orange.400"}
                borderRadius="full"
                transition="width 1s linear"
                style={{
                  width: `${Math.max(0, (timeLimit.secondsRemaining / (timeLimit.totalSeconds || 1)) * 100)}%`,
                }}
              />
            </Box>
          </Flex>
        )}
        {/* Time's up message */}
        {timeLimit?.isExpired && (
          <Flex maxW="3xl" mx="auto" mb={2} justify="center">
            <Text fontSize="lg" fontFamily="heading" fontWeight="700" color="red.500">
              Time's up!
            </Text>
          </Flex>
        )}
        <Flex maxW="3xl" mx="auto" gap={3}>
          {/* Add photo — left of input */}
          <Menu.Root positioning={{ placement: "top" }}>
            <Menu.Trigger asChild>
              <IconButton
                aria-label="Add image"
                variant="ghost"
                color="charcoal.400"
                _hover={{ bg: "gray.100" }}
                _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
                borderRadius="xl"
                h="auto"
                minW={isTouchDevice ? 10 : 12}
                disabled={isStreaming || timeLimit?.isExpired || isFocusMismatch}
              >
                <FiImage size={isTouchDevice ? 16 : undefined} />
              </IconButton>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content minW="160px">
                <Menu.Item value="camera" cursor="pointer" onClick={openCamera}>
                  <FiCamera />
                  Take Photo
                </Menu.Item>
                <Menu.Item value="upload" cursor="pointer" onClick={onSelectImage}>
                  <FiUpload />
                  Upload File
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
          <Textarea
            ref={textareaRef}
            value={timeLimit?.isExpired ? "" : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isFocusMismatch ? "Read-only — teacher set a different activity" : timeLimit?.isExpired ? "Session ended" : "Ask me anything..."}
            resize="none"
            rows={1}
            overflow="hidden"
            bg="white"
            border="0.5px solid"
            borderColor={isFocusMismatch ? "orange.300" : timeLimit?.isExpired ? "red.300" : "gray.400"}
            borderRadius="xl"
            _focus={{
              borderColor: isFocusMismatch ? "orange.300" : timeLimit?.isExpired ? "red.300" : "violet.400",
              boxShadow: "none",
              outline: "none",
            }}
            _focusVisible={{
              boxShadow: "none",
              outline: "none",
            }}
            _placeholder={{ color: isFocusMismatch ? "orange.400" : timeLimit?.isExpired ? "red.300" : "gray.400" }}
            fontFamily="body"
            fontSize={isTouchDevice ? "md" : "xl"}
            py={3}
            px={isTouchDevice ? 3 : 4}
            disabled={isStreaming || timeLimit?.isExpired || isFocusMismatch}
          />
          {/* Mic — hidden when input has text */}
          {(!input.trim() && !pendingImage) && (
            <Tooltip.Root openDelay={600} closeDelay={0} positioning={{ placement: "top" }} disabled={isTouchDevice}>
              <Tooltip.Trigger asChild>
                <IconButton
                  ref={micBtnRef}
                  aria-label={dictationState === "recording" ? "Stop recording" : "Start voice dictation"}
                  variant={dictationState === "recording" ? "solid" : "ghost"}
                  bg={dictationState === "recording" ? "red.500" : undefined}
                  color={dictationState === "recording" ? "white" : "charcoal.400"}
                  _hover={{ bg: dictationState === "recording" ? "red.600" : "gray.100" }}
                  _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
                  borderRadius="xl"
                  h="auto"
                  minW={isTouchDevice ? 10 : 12}
                  onClick={toggleRecording}
                  disabled={isStreaming || dictationState === "transcribing" || timeLimit?.isExpired || isFocusMismatch}
                  className={dictationState === "recording" ? "recording-pulse" : undefined}
                >
                  {dictationState === "transcribing" ? (
                    <Spinner size="sm" />
                  ) : dictationState === "recording" ? (
                    <FiMicOff />
                  ) : (
                    <FiMic />
                  )}
                </IconButton>
              </Tooltip.Trigger>
              <Portal>
                <Tooltip.Positioner style={{ zIndex: 10000 }}>
                  <Tooltip.Content
                    fontFamily="heading"
                    fontSize="xs"
                    bg="red.600"
                    color="white"
                    px={3}
                    py={1.5}
                    borderRadius="lg"
                  >
                    Hold Tab to talk
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Portal>
            </Tooltip.Root>
          )}
          {/* Send — hidden when input is empty */}
          {(input.trim() || pendingImage) && (
            <IconButton
              aria-label="Send message"
              bg="violet.500"
              color="white"
              _hover={{ bg: "violet.700" }}
              _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
              borderRadius="xl"
              h="auto"
              minW={isTouchDevice ? 10 : 12}
              onClick={() => handleSend()}
              disabled={(!input.trim() && !pendingImage) || isStreaming || timeLimit?.isExpired || isFocusMismatch}
            >
              <FiArrowUp />
            </IconButton>
          )}
        </Flex>
        {dictationError && (
          <Text fontSize="xs" color="red.500" textAlign="center" mt={1} fontFamily="heading">
            {dictationError}
          </Text>
        )}
        <Text
          fontSize="xs"
          color="charcoal.300"
          textAlign="center"
          mt={isTouchDevice ? 1 : 2}
          fontFamily="heading"
        >
          {isTouchDevice
            ? "Do not enter personal information."
            : "Conversations may be inspected for debugging and product improvement. Do not enter personal information. AI can make mistakes."}
        </Text>
      </Box>
    </Flex>
  );
}

// Message type matching what Convex getWithMessages returns
interface MessageData {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: number;
  personaId?: string | null;
  unitId?: string | null;
  perspectiveId?: string | null;
  toolAction?: string | null;
  imageId?: string | null;
}

interface ObservationData {
  _id: string;
  conceptLabel: string;
  domain: string;
  masteryLevel: number;
  confidenceScore: number;
  evidenceSummary: string;
  evidenceType: string;
  studentInitiated: boolean;
  isSuperseded: boolean;
  observedAt: number;
}

/** Strip markdown formatting for TTS. */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")       // headers
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/\*(.*?)\*/g, "$1")     // italic
    .replace(/```[a-z]*\n[\s\S]*?```/g, "") // fenced code blocks (keep inline code)
    .replace(/`([^`]+)`/g, "$1")     // inline code → keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/^[-*+]\s/gm, "")      // list bullets
    .replace(/^\d+\.\s/gm, "")      // numbered lists
    .replace(/\n{2,}/g, "\n")       // collapse multiple newlines
    .replace(/\n/g, ". ")           // newlines -> sentence pause
    .replace(/\.\.\s/g, ". ")       // collapse double periods
    .trim();
}

// Generated Image Component (for AI-generated illustrations in tool messages)
function GeneratedImage({ imageId }: { imageId: string }) {
  const url = useQuery(api.files.getUrl, { storageId: imageId as Id<"_storage"> });
  if (!url) return null;
  return (
    <Box my={2} mx="auto" maxW="400px" borderRadius="xl" overflow="hidden">
      <img src={url} alt="AI-generated illustration" style={{ width: "100%", borderRadius: "12px" }} />
    </Box>
  );
}

// Message Bubble Component
function MessageBubble({
  message,
  personaOptions = [],
  isStreaming = false,
  generatingImage = false,
}: {
  message: MessageData;
  personaOptions?: DimensionOption[];
  isStreaming?: boolean;
  generatingImage?: boolean;
}) {
  const isUser = message.role === "user";
  const tts = useTTS();

  // Look up persona from message snapshot
  const messagePersona = message.personaId
    ? personaOptions.find((p) => p.id === message.personaId)
    : null;

  const assistantLabel = messagePersona
    ? `${messagePersona.emoji} ${messagePersona.title}`
    : "AI";

  // Resolve image URL if message has an image
  const imageUrl = useQuery(
    api.files.getUrl,
    message.imageId ? { storageId: message.imageId as Id<"_storage"> } : "skip"
  );

  if (isUser) {
    return (
      <Box
        className="message-bubble user animate-fade-in"
        alignSelf="flex-end"
      >
        {imageUrl && (
          <Box mb={2} borderRadius="lg" overflow="hidden" maxW="300px" ml="auto">
            <img
              src={imageUrl}
              alt="Uploaded image"
              style={{ maxWidth: "100%", borderRadius: "8px" }}
            />
          </Box>
        )}
        <Box
          bg="navy.500"
          color="white"
          px={4}
          py={3}
          borderRadius="xl"
          borderBottomRightRadius="sm"
          maxW="100%"
          shadow="sm"
        >
          <Text fontFamily="body" fontSize="lg" whiteSpace="pre-wrap">
            {message.content}
          </Text>
        </Box>
        <Text
          fontSize="xs"
          color="charcoal.300"
          mt={1}
          textAlign="right"
          fontFamily="heading"
        >
          You
        </Text>
      </Box>
    );
  }

  // Assistant message
  return (
    <Box className="message-bubble assistant animate-fade-in" alignSelf="flex-start">
      <Box
        bg="gray.100"
        color="charcoal.500"
        px={4}
        py={3}
        borderRadius="xl"
        borderBottomLeftRadius="sm"
        maxW="100%"
        shadow="sm"
        position="relative"
        css={{ "&:hover .tts-btn": { opacity: 1 } }}
      >
        <Box className="chat-markdown" fontFamily="body" fontSize="lg">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>{message.content}</ReactMarkdown>
          {generatingImage && (
            <Flex align="center" gap={2} mt={2}>
              <Spinner size="xs" color="violet.500" />
              <Text fontSize="sm" fontFamily="heading" color="violet.500" fontWeight="600">
                Generating image...
              </Text>
            </Flex>
          )}
          {isStreaming && !generatingImage && (
            <Box
              as="span"
              display="inline-block"
              w={2}
              h={4}
              bg="violet.500"
              ml={1}
              className="animate-pulse-soft"
              borderRadius="sm"
            />
          )}
        </Box>
        {/* TTS button — appears on hover */}
        {!isStreaming && message.content && (
          <Tooltip.Root openDelay={400} closeDelay={0} positioning={{ placement: "right" }}>
            <Tooltip.Trigger asChild>
              <IconButton
                className="tts-btn"
                aria-label={tts.state !== "idle" ? "Stop reading" : "Read aloud"}
                size="xs"
                variant="ghost"
                color={tts.state !== "idle" ? "violet.500" : "charcoal.300"}
                _hover={{ color: "violet.600", bg: "violet.50" }}
                position="absolute"
                left="100%"
                ml={3}
                top={0}
                mt={3}
                opacity={tts.state !== "idle" ? 1 : 0}
                transition="opacity 0.15s"
                onClick={() => {
                  const stripped = stripMarkdown(message.content);
                  console.log("[TTS] raw content length:", message.content.length, "stripped length:", stripped.length, "\nstripped text:", stripped.slice(0, 300));
                  tts.toggle(stripped);
                }}
              >
                {tts.state === "loading" ? <Spinner size="xs" /> : <FiVolume2 size={14} />}
              </IconButton>
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Positioner>
                <Tooltip.Content fontSize="xs">
                  {tts.state !== "idle" ? "Stop reading" : "Read aloud"}
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Portal>
          </Tooltip.Root>
        )}
      </Box>
      <Text
        fontSize="xs"
        color="charcoal.300"
        mt={1}
        textAlign="left"
        fontFamily="heading"
      >
        {assistantLabel}
      </Text>
    </Box>
  );
}
