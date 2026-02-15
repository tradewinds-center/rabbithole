"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Flex,
  VStack,
  Text,
  Textarea,
  IconButton,
  Spinner,
  Splitter,
  Tooltip,
  Portal,
} from "@chakra-ui/react";
import { FiArrowUp, FiEdit2, FiMic, FiMicOff, FiSend, FiX } from "react-icons/fi";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { ProjectHeader } from "./ProjectHeader";
import type { DimensionEditData } from "./DimensionEditModal";
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
  isRemoteMode,
}: ProjectInterfaceProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const welcomeSentRef = useRef<string | null>(null);
  const [whisperInput, setWhisperInput] = useState("");

  // Convex queries for dimension options (reactive, auto-updating)
  const personas = useQuery(api.personas.list) ?? [];
  const units = useQuery(api.units.list) ?? [];
  const perspectives = useQuery(api.perspectives.list) ?? [];
  const processes = useQuery(api.processes.list) ?? [];

  // Focus lock from teacher
  const currentFocus = useQuery(api.focus.getCurrent);
  const focusLock = currentFocus?.isActive
    ? {
        personaId: currentFocus.personaId ? String(currentFocus.personaId) : null,
        unitId: currentFocus.unitId ? String(currentFocus.unitId) : null,
        perspectiveId: currentFocus.perspectiveId ? String(currentFocus.perspectiveId) : null,
        processId: currentFocus.processId ? String(currentFocus.processId) : null,
      }
    : null;

  const personaOptions: DimensionOption[] = personas.map((p) => ({
    id: p._id,
    title: p.title,
    emoji: p.emoji,
  }));
  const unitOptions: DimensionOption[] = units.map((u) => ({
    id: u._id,
    title: u.title,
  }));
  const perspectiveOptions: DimensionOption[] = perspectives.map((p) => ({
    id: p._id,
    title: p.title,
    icon: p.icon ?? null,
  }));
  const processOptions: DimensionOption[] = processes.map((p) => ({
    id: p._id,
    title: p.title,
    emoji: p.emoji ?? null,
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
        personaId: projectData.project.personaId
          ? String(projectData.project.personaId)
          : null,
        unitId: projectData.project.unitId
          ? String(projectData.project.unitId)
          : null,
        perspectiveId: projectData.project.perspectiveId
          ? String(projectData.project.perspectiveId)
          : null,
        processId: projectData.project.processId
          ? String(projectData.project.processId)
          : null,
      }
    : {
        title: "New Project",
        personaId: null,
        unitId: null,
        perspectiveId: null,
        processId: null,
      };

  // Process state (reactive query, updates when AI tool fires)
  const processState = useQuery(
    api.processState.getByProject,
    activeProject.processId
      ? { projectId: projectId as Id<"projects"> }
      : "skip"
  );

  // Look up the full process definition for the panel
  const activeProcessDef = activeProject.processId
    ? processes.find((p) => p._id === activeProject.processId)
    : null;

  // Artifacts (reactive query, returns array)
  const artifacts = useQuery(
    api.artifacts.getByProject,
    { projectId: projectId as Id<"projects"> }
  ) ?? [];
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
  const hasRightPanelContent = hasProcess || hasArtifacts;
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Auto-open when content appears
  useEffect(() => {
    if (hasRightPanelContent) {
      setRightPanelOpen(true);
    }
  }, [hasRightPanelContent]);

  const showRightPanel = rightPanelOpen && hasRightPanelContent;

  // Convex mutation for updating project dimensions
  const updateProject = useMutation(api.projects.update);

  // Convex mutation for sending messages
  const sendMsg = useMutation(api.projects.sendMessage);

  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const { state: dictationState, error: dictationError, toggleRecording, startRecording, stopRecording } =
    useVoiceDictation((text) => {
      sendMessageRef.current(text);
    });

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

  // Auto-apply locked dimensions when focus becomes active (skip in test mode)
  useEffect(() => {
    if (isTestMode || !focusLock || !projectData?.project) return;
    const proj = projectData.project;
    const updates: Record<string, string | null> = {};
    if (focusLock.personaId != null && String(proj.personaId ?? "") !== focusLock.personaId) {
      updates.personaId = focusLock.personaId;
    }
    if (focusLock.unitId != null && String(proj.unitId ?? "") !== focusLock.unitId) {
      updates.unitId = focusLock.unitId;
    }
    if (focusLock.perspectiveId != null && String(proj.perspectiveId ?? "") !== focusLock.perspectiveId) {
      updates.perspectiveId = focusLock.perspectiveId;
    }
    if (focusLock.processId != null && String(proj.processId ?? "") !== focusLock.processId) {
      updates.processId = focusLock.processId;
    }
    if (Object.keys(updates).length > 0) {
      updateProject({
        id: projectId as Id<"projects">,
        ...updates,
      } as Parameters<typeof updateProject>[0]).catch(console.error);
    }
  }, [focusLock, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle dimension changes via Convex mutation
  const handleDimensionChange = async (
    field: "personaId" | "unitId" | "perspectiveId" | "processId",
    value: string | null
  ) => {
    // Skip if this dimension is locked by focus (unless in test mode)
    if (!isTestMode && focusLock) {
      const lockKey = field as keyof typeof focusLock;
      if (focusLock[lockKey] != null) return;
    }
    try {
      await updateProject({
        id: projectId as Id<"projects">,
        [field]: value as Id<"personas"> | Id<"units"> | Id<"perspectives"> | null,
      });
      onProjectUpdate?.();
    } catch (error) {
      console.error("Error updating dimension:", error);
    }
  };

  // Pending whisper from project data (reactive)
  const pendingWhisper = projectData?.project?.pendingWhisper ?? null;

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
    const userMessage = directText?.trim() || input.trim();
    if (!userMessage || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingMsgId(null);

    try {
      // Send message via Convex mutation (creates user msg + placeholder assistant msg)
      const result = await sendMsg({
        projectId: projectId as Id<"projects">,
        message: userMessage,
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
                if (data.text) {
                  fullContent += data.text;
                  setStreamingContent(fullContent);
                } else if (data.newArtifactId) {
                  // AI created a new document — select it and open panel
                  setActiveArtifactId(data.newArtifactId);
                  setRightPanelOpen(true);
                } else if (data.newAssistantMsg) {
                  // Tool fired — server split the message. Switch streaming target.
                  setStreamingMsgId(data.newAssistantMsg);
                  fullContent = "";
                  setStreamingContent("");
                } else if (data.done) {
                  // Stream finalized on the server side.
                  // Convex reactive query will auto-update messages.
                  setStreamingContent("");
                  setStreamingMsgId(null);
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
        personaId={activeProject.personaId}
        unitId={activeProject.unitId}
        perspectiveId={activeProject.perspectiveId}
        processId={activeProject.processId}
        pulseScore={projectData?.project?.pulseScore ?? null}
        lastMessageAt={(() => {
          const userMsgs = messages.filter((m) => m.role === "user");
          return userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].createdAt : null;
        })()}
        personaOptions={personaOptions}
        unitOptions={unitOptions}
        perspectiveOptions={perspectiveOptions}
        processOptions={processOptions}
        personaData={isTestMode ? personas.map((p): DimensionEditData => ({ _id: p._id, title: p.title, emoji: p.emoji, systemPrompt: p.systemPrompt, description: p.description })) : undefined}
        unitData={isTestMode ? units.map((u): DimensionEditData => ({ _id: u._id, title: u.title, emoji: u.emoji ?? undefined, description: u.description, systemPrompt: u.systemPrompt, rubric: u.rubric, targetBloomLevel: u.targetBloomLevel })) : undefined}
        perspectiveData={isTestMode ? perspectives.map((p): DimensionEditData => ({ _id: p._id, title: p.title, icon: p.icon ?? undefined, systemPrompt: p.systemPrompt, description: p.description })) : undefined}
        processData={isTestMode ? processes.map((p): DimensionEditData => ({ _id: p._id, title: p.title, emoji: p.emoji ?? undefined, systemPrompt: p.systemPrompt, description: p.description, steps: p.steps })) : undefined}
        onPersonaChange={(id) => handleDimensionChange("personaId", id)}
        onUnitChange={(id) => handleDimensionChange("unitId", id)}
        onPerspectiveChange={(id) => handleDimensionChange("perspectiveId", id)}
        onProcessChange={(id) => handleDimensionChange("processId", id)}
        focusLock={focusLock}
        onMenuClick={onOpenSidebar}
        isSynced={hasArtifacts ? artifactSynced : undefined}
        userName={userName}
        userImage={userImage}
        isTestMode={isTestMode}
        onSignOut={onSignOut}
        currentStepKey={processState?.currentStep ?? null}
        onProjectRename={(title) => updateProject({ id: projectId as Id<"projects">, title })}
        showRightPanel={showRightPanel}
        onToggleRightPanel={hasRightPanelContent ? () => setRightPanelOpen((v) => !v) : undefined}
      />

      {/* Main content area with optional right panel */}
      {showRightPanel ? (
        <Splitter.Root
          flex={1}
          overflow="hidden"
          defaultSize={[55, 45]}
          panels={[
            { id: "chat", minSize: 40 },
            { id: "side", minSize: 25 },
          ]}
        >
          <Splitter.Panel id="chat">
            <ChatColumn
              messages={messages}
              streamingContent={streamingContent}
              streamingMsgId={streamingMsgId}
              personaOptions={personaOptions}
              isStreaming={isStreaming}
              input={input}
              setInput={setInput}
              handleKeyDown={handleKeyDown}
              handleSend={handleSend}
              textareaRef={textareaRef}
              messagesEndRef={messagesEndRef}
              dictationState={dictationState}
              dictationError={dictationError}
              toggleRecording={toggleRecording}
              startRecording={startRecording}
              stopRecording={stopRecording}
              isRemoteMode={isRemoteMode}
              whisperInput={whisperInput}
              setWhisperInput={setWhisperInput}
              pendingWhisper={pendingWhisper}
              onSendWhisper={handleSendWhisper}
              onClearWhisper={handleClearWhisper}
            />
          </Splitter.Panel>
          <Splitter.ResizeTrigger id="chat:side" css={{ "--splitter-border-size": "0.5px" }} />
          <Splitter.Panel id="side">
            <Flex
              h="full"
              flexDir="column"
              overflow="hidden"
            >
              <ArtifactPanel
                artifacts={artifacts}
                activeArtifactId={activeArtifactId}
                onSelectArtifact={setActiveArtifactId}
                onSave={handleSaveArtifact}
                onCreateArtifact={handleCreateArtifact}
                onDeleteArtifact={handleDeleteArtifact}
                onSyncChange={setArtifactSynced}
                process={hasProcess ? {
                  title: activeProcessDef!.title,
                  emoji: activeProcessDef!.emoji ?? null,
                  steps: activeProcessDef!.steps,
                } : null}
                processCurrentStep={hasProcess ? processState!.currentStep : undefined}
                processSteps={hasProcess ? processState!.steps : undefined}
              />
            </Flex>
          </Splitter.Panel>
        </Splitter.Root>
      ) : (
        <Flex flex={1} overflow="hidden">
          <ChatColumn
            messages={messages}
            streamingContent={streamingContent}
            streamingMsgId={streamingMsgId}
            personaOptions={personaOptions}
            isStreaming={isStreaming}
            input={input}
            setInput={setInput}
            handleKeyDown={handleKeyDown}
            handleSend={handleSend}
            textareaRef={textareaRef}
            messagesEndRef={messagesEndRef}
            dictationState={dictationState}
            dictationError={dictationError}
            toggleRecording={toggleRecording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            isRemoteMode={isRemoteMode}
            whisperInput={whisperInput}
            setWhisperInput={setWhisperInput}
            pendingWhisper={pendingWhisper}
            onSendWhisper={handleSendWhisper}
            onClearWhisper={handleClearWhisper}
          />
        </Flex>
      )}
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
}: ChatColumnProps) {
  const micBtnRef = useRef<HTMLButtonElement>(null);
  const tabHeldRef = useRef(false);
  const tabTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Walkie-talkie: Tab hold → record, Tab release → stop & send
  // Quick tap (<200ms) is a no-op so normal Tab usage isn't hijacked
  useEffect(() => {
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
  }, [isStreaming, dictationState, startRecording, stopRecording]);

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

      {/* Messages */}
      <Box flex={1} overflowY="auto" px={6} py={4}>
        <VStack gap={4} maxW="3xl" mx="auto" align="stretch">
          {messages.length === 0 && !streamingContent && (
            <Flex py={12} justify="center">
              <Spinner size="lg" color="violet.500" />
            </Flex>
          )}

          {messages
            .filter((m) => m.role !== "system")
            .filter((m) => !(m.role === "user" && m.content === "<start>"))
            .filter((m) => isRemoteMode || m.toolAction !== "whisper")
            .map((message) => {
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
                  <Text
                    key={message.id}
                    fontSize="xs"
                    color="charcoal.300"
                    fontFamily="heading"
                    textAlign="center"
                    py={1}
                  >
                    {message.toolAction}
                  </Text>
                );
              }

              const isActiveStream = streamingMsgId && message.id === streamingMsgId;
              return (
                <MessageBubble
                  key={message.id}
                  message={isActiveStream ? { ...message, content: streamingContent || message.content } : message}
                  personaOptions={personaOptions}
                  isStreaming={!!isActiveStream && !!streamingContent}
                />
              );
            })}

          {/* Typing indicator */}
          {isStreaming && !streamingContent && (
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

      {/* Input Area */}
      <Box
        p={4}
        borderTop="0.5px solid"
        borderColor="gray.200"
        bg="gray.50"
        shadow="0 -1px 3px rgba(0,0,0,0.06)"
        position="relative"
        zIndex={9999}
      >
        <Flex maxW="3xl" mx="auto" gap={3}>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            resize="none"
            rows={1}
            overflow="hidden"
            bg="white"
            border="0.5px solid"
            borderColor="gray.400"
            borderRadius="xl"
            _focus={{
              borderColor: "violet.400",
              boxShadow: "none",
              outline: "none",
            }}
            _focusVisible={{
              boxShadow: "none",
              outline: "none",
            }}
            _placeholder={{ color: "gray.400" }}
            fontFamily="body"
            fontSize="md"
            py={3}
            px={4}
            disabled={isStreaming}
          />
          <Tooltip.Root openDelay={600} closeDelay={0} positioning={{ placement: "top" }}>
            <Tooltip.Trigger asChild>
              <IconButton
                ref={micBtnRef}
                aria-label={dictationState === "recording" ? "Stop recording" : "Start voice dictation"}
                bg={dictationState === "recording" ? "red.500" : "gray.200"}
                color={dictationState === "recording" ? "white" : "charcoal.500"}
                _hover={{ bg: dictationState === "recording" ? "red.600" : "gray.300" }}
                _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
                borderRadius="xl"
                h="auto"
                minW={12}
                onClick={toggleRecording}
                disabled={isStreaming || dictationState === "transcribing"}
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
          <IconButton
            aria-label="Send message"
            bg="violet.500"
            color="white"
            _hover={{ bg: "violet.700" }}
            _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
            borderRadius="xl"
            h="auto"
            minW={12}
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
          >
            <FiArrowUp />
          </IconButton>
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
          mt={2}
          fontFamily="heading"
        >
          AI can make mistakes. Verify important information with your
          teachers.
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
}

// Message Bubble Component
function MessageBubble({
  message,
  personaOptions = [],
  isStreaming = false,
}: {
  message: MessageData;
  personaOptions?: DimensionOption[];
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  // Look up persona from message snapshot
  const messagePersona = message.personaId
    ? personaOptions.find((p) => p.id === message.personaId)
    : null;

  const assistantLabel = messagePersona
    ? `${messagePersona.emoji} ${messagePersona.title}`
    : "AI";

  if (isUser) {
    return (
      <Box
        className="message-bubble user animate-fade-in"
        alignSelf="flex-end"
      >
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
      >
        <Box className="chat-markdown" fontFamily="body" fontSize="lg">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>{message.content}</ReactMarkdown>
          {isStreaming && (
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
