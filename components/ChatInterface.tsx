"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  Flex,
  VStack,
  Text,
  Textarea,
  IconButton,
  Spinner,
  Splitter,
} from "@chakra-ui/react";
import { FiArrowUp, FiMic, FiMicOff } from "react-icons/fi";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { ChatHeader } from "./ChatHeader";
import type { DimensionEditData } from "./DimensionEditModal";
import { ProcessPanel } from "./ProcessPanel";
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

interface ChatInterfaceProps {
  conversationId: string;
  onConversationUpdate?: () => void;
  onOpenSidebar?: () => void;
  userName?: string;
  userImage?: string;
  isTestMode?: boolean;
}

export function ChatInterface({
  conversationId,
  onConversationUpdate,
  onOpenSidebar,
  userName,
  userImage,
  isTestMode,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const welcomeSentRef = useRef<string | null>(null);

  // Convex queries for dimension options (reactive, auto-updating)
  const personas = useQuery(api.personas.list) ?? [];
  const projects = useQuery(api.projects.list) ?? [];
  const perspectives = useQuery(api.perspectives.list) ?? [];
  const processes = useQuery(api.processes.list) ?? [];

  // Focus lock from teacher
  const currentFocus = useQuery(api.focus.getCurrent);
  const focusLock = currentFocus?.isActive
    ? {
        personaId: currentFocus.personaId ? String(currentFocus.personaId) : null,
        projectId: currentFocus.projectId ? String(currentFocus.projectId) : null,
        perspectiveId: currentFocus.perspectiveId ? String(currentFocus.perspectiveId) : null,
        processId: currentFocus.processId ? String(currentFocus.processId) : null,
      }
    : null;

  const personaOptions: DimensionOption[] = personas.map((p) => ({
    id: p._id,
    title: p.title,
    emoji: p.emoji,
  }));
  const projectOptions: DimensionOption[] = projects.map((p) => ({
    id: p._id,
    title: p.title,
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

  // Convex query for conversation + messages (reactive, auto-updating)
  const convData = useQuery(
    api.conversations.getWithMessages,
    { id: conversationId as Id<"conversations"> }
  );

  const messages = convData?.messages ?? [];
  const conversationData = convData?.conversation
    ? {
        title: convData.conversation.title,
        personaId: convData.conversation.personaId
          ? String(convData.conversation.personaId)
          : null,
        projectId: convData.conversation.projectId
          ? String(convData.conversation.projectId)
          : null,
        perspectiveId: convData.conversation.perspectiveId
          ? String(convData.conversation.perspectiveId)
          : null,
        processId: convData.conversation.processId
          ? String(convData.conversation.processId)
          : null,
      }
    : {
        title: "New Conversation",
        personaId: null,
        projectId: null,
        perspectiveId: null,
        processId: null,
      };

  // Process state (reactive query, updates when AI tool fires)
  const processState = useQuery(
    api.processState.getByConversation,
    conversationData.processId
      ? { conversationId: conversationId as Id<"conversations"> }
      : "skip"
  );

  // Look up the full process definition for the panel
  const activeProcessDef = conversationData.processId
    ? processes.find((p) => p._id === conversationData.processId)
    : null;

  // Artifact (reactive query, updates when AI edits document)
  const artifact = useQuery(
    api.artifacts.getByConversation,
    { conversationId: conversationId as Id<"conversations"> }
  );
  const saveArtifact = useMutation(api.artifacts.scholarUpdate);
  const [artifactSynced, setArtifactSynced] = useState(true);

  const hasRightPanel = !!(activeProcessDef && processState) || !!artifact;

  // Convex mutation for updating conversation dimensions
  const updateConversation = useMutation(api.conversations.update);

  // Convex mutation for sending messages
  const sendMsg = useMutation(api.chat.sendMessage);

  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const { state: dictationState, error: dictationError, toggleRecording } =
    useVoiceDictation((text) => {
      sendMessageRef.current(text);
    });

  // Loading state: convData is undefined while the query is loading
  const isLoading = convData === undefined;

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Auto-focus textarea when conversation changes or finishes loading
  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading, conversationId]);

  // Auto-apply locked dimensions when focus becomes active (skip in test mode)
  useEffect(() => {
    if (isTestMode || !focusLock || !convData?.conversation) return;
    const conv = convData.conversation;
    const updates: Record<string, string | null> = {};
    if (focusLock.personaId != null && String(conv.personaId ?? "") !== focusLock.personaId) {
      updates.personaId = focusLock.personaId;
    }
    if (focusLock.projectId != null && String(conv.projectId ?? "") !== focusLock.projectId) {
      updates.projectId = focusLock.projectId;
    }
    if (focusLock.perspectiveId != null && String(conv.perspectiveId ?? "") !== focusLock.perspectiveId) {
      updates.perspectiveId = focusLock.perspectiveId;
    }
    if (focusLock.processId != null && String(conv.processId ?? "") !== focusLock.processId) {
      updates.processId = focusLock.processId;
    }
    if (Object.keys(updates).length > 0) {
      updateConversation({
        id: conversationId as Id<"conversations">,
        ...updates,
      } as Parameters<typeof updateConversation>[0]).catch(console.error);
    }
  }, [focusLock, conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle dimension changes via Convex mutation
  const handleDimensionChange = async (
    field: "personaId" | "projectId" | "perspectiveId" | "processId",
    value: string | null
  ) => {
    // Skip if this dimension is locked by focus (unless in test mode)
    if (!isTestMode && focusLock) {
      const lockKey = field as keyof typeof focusLock;
      if (focusLock[lockKey] != null) return;
    }
    try {
      await updateConversation({
        id: conversationId as Id<"conversations">,
        [field]: value as Id<"personas"> | Id<"projects"> | Id<"perspectives"> | null,
      });
      onConversationUpdate?.();
    } catch (error) {
      console.error("Error updating dimension:", error);
    }
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
        conversationId: conversationId as Id<"conversations">,
        message: userMessage,
      });

      // Track the placeholder message ID so we can hide it while streaming
      setStreamingMsgId(result.assistantMsgId);

      // Stream from HTTP action
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!.replace(
        ".cloud",
        ".site"
      );
      const res = await fetch(`${convexUrl}/chat-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: result.conversationId,
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
                  onConversationUpdate?.();
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

  // Auto-send <start> when a new conversation has a project but no messages yet
  useEffect(() => {
    if (
      convData &&
      messages.length === 0 &&
      conversationData.projectId &&
      !isStreaming &&
      welcomeSentRef.current !== conversationId
    ) {
      welcomeSentRef.current = conversationId;
      handleSend("<start>");
    }
  }, [convData, conversationData.projectId, isStreaming, conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (isLoading) {
    return (
      <Flex flex={1} align="center" justify="center">
        <Spinner size="lg" color="violet.500" />
      </Flex>
    );
  }

  return (
    <Flex flex={1} flexDir="column" overflow="hidden" bg="white">
      {/* Chat Header with dimension selectors */}
      <ChatHeader
        conversationTitle={conversationData.title}
        personaId={conversationData.personaId}
        projectId={conversationData.projectId}
        perspectiveId={conversationData.perspectiveId}
        processId={conversationData.processId}
        personaOptions={personaOptions}
        projectOptions={projectOptions}
        perspectiveOptions={perspectiveOptions}
        processOptions={processOptions}
        personaData={isTestMode ? personas.map((p): DimensionEditData => ({ _id: p._id, title: p.title, emoji: p.emoji, systemPrompt: p.systemPrompt, description: p.description })) : undefined}
        projectData={isTestMode ? projects.map((p): DimensionEditData => ({ _id: p._id, title: p.title, emoji: p.emoji ?? undefined, description: p.description, systemPrompt: p.systemPrompt, rubric: p.rubric, targetBloomLevel: p.targetBloomLevel })) : undefined}
        perspectiveData={isTestMode ? perspectives.map((p): DimensionEditData => ({ _id: p._id, title: p.title, icon: p.icon ?? undefined, systemPrompt: p.systemPrompt, description: p.description })) : undefined}
        processData={isTestMode ? processes.map((p): DimensionEditData => ({ _id: p._id, title: p.title, emoji: p.emoji ?? undefined, systemPrompt: p.systemPrompt, description: p.description, steps: p.steps })) : undefined}
        onPersonaChange={(id) => handleDimensionChange("personaId", id)}
        onProjectChange={(id) => handleDimensionChange("projectId", id)}
        onPerspectiveChange={(id) => handleDimensionChange("perspectiveId", id)}
        onProcessChange={(id) => handleDimensionChange("processId", id)}
        focusLock={focusLock}
        onMenuClick={onOpenSidebar}
        isSynced={artifact ? artifactSynced : undefined}
        userName={userName}
        userImage={userImage}
        isTestMode={isTestMode}
        currentStepKey={processState?.currentStep ?? null}
      />

      {/* Main content area with optional right panel */}
      {hasRightPanel ? (
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
            />
          </Splitter.Panel>
          <Splitter.ResizeTrigger id="chat:side" />
          <Splitter.Panel id="side">
            <Flex
              h="full"
              flexDir="column"
              borderLeft="1px solid"
              borderColor="gray.200"
              overflow="hidden"
            >
              {activeProcessDef && processState && (
                <ProcessPanel
                  process={{
                    title: activeProcessDef.title,
                    emoji: activeProcessDef.emoji ?? null,
                    steps: activeProcessDef.steps,
                  }}
                  currentStep={processState.currentStep}
                  steps={processState.steps}
                />
              )}
              {artifact && (
                <ArtifactPanel
                  title={artifact.title}
                  content={artifact.content}
                  lastEditedBy={artifact.lastEditedBy}
                  onSave={(updates) => {
                    saveArtifact({
                      conversationId: conversationId as Id<"conversations">,
                      ...updates,
                    }).catch(console.error);
                  }}
                  onSyncChange={setArtifactSynced}
                />
              )}
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
}: ChatColumnProps) {
  return (
    <Flex flex={1} flexDir="column" overflow="hidden" h="full">
      {/* Messages */}
      <Box flex={1} overflowY="auto" px={6} py={4}>
        <VStack gap={4} maxW="3xl" mx="auto" align="stretch">
          {messages.length === 0 && !streamingContent && (
            <VStack py={12} gap={4}>
              <Text
                fontSize="xl"
                fontWeight="600"
                fontFamily="heading"
                color="navy.500"
              >
                What would you like to explore?
              </Text>
              <Text
                color="charcoal.400"
                fontFamily="body"
                textAlign="center"
                maxW="md"
              >
                I&apos;m Makawulu, your AI learning companion. Ask me anything -
                from science and math to history and creative writing. Let&apos;s
                discover something together.
              </Text>
            </VStack>
          )}

          {messages
            .filter((m) => m.role !== "system")
            .filter((m) => !(m.role === "user" && m.content === "<start>"))
            .map((message) => {
              if (message.role === "tool") {
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

      {/* Input Area */}
      <Box
        p={4}
        borderTop="1px solid"
        borderColor="gray.200"
        bg="gray.50"
        shadow="0 -1px 3px rgba(0,0,0,0.06)"
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
            border="2px solid"
            borderColor="gray.200"
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
          <IconButton
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
          Makawulu is an AI assistant. Verify important information with your
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
  projectId?: string | null;
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
    : "Makawulu";

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
