"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Flex,
  VStack,
  Text,
  Textarea,
  IconButton,
  Button,
  Spinner,
  Badge,
  Menu,
  Portal,
} from "@chakra-ui/react";
import {
  FiSend,
  FiPlus,
  FiMoreVertical,
  FiEdit2,
  FiTrash2,
  FiBookmark,
} from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAgentStream } from "@/hooks/useAgentStream";
import { ToolActivityIndicator } from "./ToolActivityIndicator";

const markdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    const isInternal = href?.startsWith("/");
    if (isInternal) {
      return (
        <Link href={href!} style={{ color: "var(--chakra-colors-violet-600)", fontWeight: 600, textDecoration: "underline" }}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--chakra-colors-violet-600)", textDecoration: "underline" }}>
        {children}
      </a>
    );
  },
};

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CurriculumAssistant() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSession = searchParams.get("session");
  const sessionId = rawSession && rawSession.length > 0 ? (rawSession as Id<"chatSessions">) : null;

  const { user } = useCurrentUser();
  const sessions = useQuery(api.curriculumAssistant.listSessions) ?? [];
  const messages = useQuery(
    api.curriculumAssistant.getSessionMessages,
    sessionId ? { sessionId } : "skip"
  ) ?? [];

  const createSession = useMutation(api.curriculumAssistant.createSession);
  const sendSessionMessage = useMutation(api.curriculumAssistant.sendSessionMessage);
  const renameSession = useMutation(api.curriculumAssistant.renameSession);
  const togglePin = useMutation(api.curriculumAssistant.togglePin);
  const deleteSession = useMutation(api.curriculumAssistant.deleteSession);

  const [input, setInput] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const stream = useAgentStream();
  const { isStreaming, streamingContent, streamingMsgId, toolActivity } = stream;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Active session derived from sessions list
  const activeSession = sessions.find((s) => String(s._id) === rawSession) ?? null;
  const scopedScholar = useQuery(
    api.scholars.getProfile,
    activeSession?.scholarId ? { scholarId: activeSession.scholarId } : "skip"
  );
  const scholarName = scopedScholar?.scholar?.name ?? null;

  const pinnedSessions = sessions.filter((s) => s.pinned);
  const recentSessions = sessions.filter((s) => !s.pinned);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleNewChat = useCallback(async () => {
    const newSessionId = await createSession({});
    router.push(`/teacher?tab=assistant&session=${String(newSessionId)}`, { scroll: false });
  }, [createSession, router]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !user) return;

    setInput("");

    // Auto-create a session if none is active
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const newId = await createSession({});
      router.push(`/teacher?tab=assistant&session=${String(newId)}`, { scroll: false });
      activeSessionId = newId as Id<"chatSessions">;
    }

    try {
      const result = await sendSessionMessage({ sessionId: activeSessionId, message: text });

      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!.replace(".cloud", ".site");
      await stream.send(
        `${convexUrl}/curriculum-stream`,
        {
          teacherId: String(user._id),
          streamId: result.streamId,
          assistantMsgId: result.assistantMsgId,
          sessionId: String(activeSessionId),
        },
        result.assistantMsgId,
      );
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }, [input, isStreaming, user, sessionId, createSession, router, sendSessionMessage, stream]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRename = (s: { _id: Id<"chatSessions">; title: string }) => {
    setRenamingId(String(s._id));
    setRenameValue(s.title);
  };

  const commitRename = async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    await renameSession({ sessionId: renamingId as Id<"chatSessions">, title: renameValue.trim() });
    setRenamingId(null);
  };

  const selectSession = (id: string) => {
    router.push(`/teacher?tab=assistant&session=${id}`, { scroll: false });
  };

  return (
    <Flex flex={1} direction="row" overflow="hidden">
      {/* ── Sidebar ── */}
      <Flex
        direction="column"
        w="240px"
        minW="240px"
        borderRight="1px solid"
        borderColor="gray.200"
        bg="gray.50"
        overflow="hidden"
      >
        {/* New Chat button */}
        <Box p={3}>
          <Button
            size="sm"
            w="full"
            bg="violet.500"
            color="white"
            fontFamily="heading"
            fontSize="xs"
            _hover={{ bg: "violet.600" }}
            borderRadius="lg"
            onClick={handleNewChat}
          >
            <FiPlus style={{ marginRight: "6px" }} />
            New Chat
          </Button>
        </Box>

        {/* Session list */}
        <Box flex={1} overflowY="auto" px={2} pb={2}>
          {sessions.length === 0 && (
            <Text fontFamily="body" fontSize="xs" color="charcoal.300" px={2} py={4} textAlign="center">
              No chats yet
            </Text>
          )}

          {pinnedSessions.length > 0 && (
            <>
              <Text fontFamily="heading" fontSize="2xs" color="charcoal.300" px={2} pt={2} pb={1} textTransform="uppercase" letterSpacing="wider">
                Pinned
              </Text>
              {pinnedSessions.map((s) => (
                <SessionRow
                  key={String(s._id)}
                  session={s}
                  isActive={String(s._id) === rawSession}
                  isRenaming={renamingId === String(s._id)}
                  renameValue={renameValue}
                  renameInputRef={renameInputRef}
                  onSelect={() => selectSession(String(s._id))}
                  onStartRename={() => startRename(s)}
                  onRenameChange={setRenameValue}
                  onRenameCommit={commitRename}
                  onRenameKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                  onTogglePin={() => togglePin({ sessionId: s._id })}
                  onDelete={() => deleteSession({ sessionId: s._id })}
                />
              ))}
            </>
          )}

          {recentSessions.length > 0 && (
            <>
              {pinnedSessions.length > 0 && (
                <Text fontFamily="heading" fontSize="2xs" color="charcoal.300" px={2} pt={3} pb={1} textTransform="uppercase" letterSpacing="wider">
                  Recent
                </Text>
              )}
              {recentSessions.map((s) => (
                <SessionRow
                  key={String(s._id)}
                  session={s}
                  isActive={String(s._id) === rawSession}
                  isRenaming={renamingId === String(s._id)}
                  renameValue={renameValue}
                  renameInputRef={renameInputRef}
                  onSelect={() => selectSession(String(s._id))}
                  onStartRename={() => startRename(s)}
                  onRenameChange={setRenameValue}
                  onRenameCommit={commitRename}
                  onRenameKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                  onTogglePin={() => togglePin({ sessionId: s._id })}
                  onDelete={() => deleteSession({ sessionId: s._id })}
                />
              ))}
            </>
          )}
        </Box>
      </Flex>

      {/* ── Main panel ── */}
      <Flex flex={1} direction="column" overflow="hidden" bg="white">
        {/* Header — only when a session is active */}
        {sessionId && (
          <Flex px={6} py={3} borderBottom="1px solid" borderColor="gray.200" align="center" gap={3} bg="white">
            <Text fontFamily="heading" fontWeight="600" fontSize="md" color="navy.500" flex={1} overflow="hidden" style={{ whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {activeSession?.title ?? "Chat"}
            </Text>
            {scholarName && (
              <Badge bg="violet.100" color="violet.700" fontFamily="heading" fontSize="2xs" px={2} py={0.5} borderRadius="md">
                {scholarName}
              </Badge>
            )}
          </Flex>
        )}

        {/* Messages or empty state */}
        {!sessionId ? (
          <Flex flex={1} align="center" justify="center" direction="column" gap={3} color="charcoal.300">
            <Text fontFamily="heading" fontSize="md">Ask me anything — or select a past chat</Text>
            <Text fontFamily="body" fontSize="sm" color="charcoal.300" textAlign="center" maxW="md">
              I can look up student profiles, mastery data, learning signals, and help you design or adapt units.
            </Text>
          </Flex>
        ) : (
          <Box flex={1} overflowY="auto" px={6} py={4}>
            <VStack gap={4} maxW="3xl" mx="auto" align="stretch">
              {messages.length === 0 && !streamingContent && (
                <VStack py={12} gap={3} color="charcoal.300">
                  {scholarName ? (
                    <>
                      <Text fontFamily="heading" fontSize="md" color="violet.700">
                        No messages yet in this thread.
                      </Text>
                      <Text fontFamily="body" fontSize="sm" color="charcoal.400" textAlign="center" maxW="md">
                        Ask about {scholarName}&rsquo;s dossier, directives, recent projects, or what to plan next.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text fontFamily="heading" fontSize="md">Ask me about your scholars or curriculum</Text>
                      <Text fontFamily="body" fontSize="sm" color="charcoal.300" textAlign="center" maxW="md">
                        I can look up student profiles, mastery data, learning signals, and help you design or adapt units.
                      </Text>
                    </>
                  )}
                </VStack>
              )}

              {messages
                .filter((m) => !(streamingMsgId && String(m._id) === streamingMsgId && !m.content))
                .map((m) => {
                  const isActiveStream = streamingMsgId && String(m._id) === streamingMsgId;
                  const content = isActiveStream ? (streamingContent || m.content) : m.content;

                  if (m.role === "user") {
                    return (
                      <Box key={String(m._id)} alignSelf="flex-end">
                        <Box bg="navy.500" color="white" px={4} py={3} borderRadius="xl" borderBottomRightRadius="sm" maxW="100%" shadow="sm">
                          <Text fontFamily="body" fontSize="sm" whiteSpace="pre-wrap">{content}</Text>
                        </Box>
                      </Box>
                    );
                  }

                  return (
                    <Box key={String(m._id)} alignSelf="flex-start">
                      <Box
                        bg="gray.100"
                        color="charcoal.500"
                        px={4}
                        py={3}
                        borderRadius="xl"
                        borderBottomLeftRadius="sm"
                        maxW="100%"
                        shadow="sm"
                        css={{
                          "& p": { marginBottom: "0.5em" },
                          "& p:last-child": { marginBottom: 0 },
                          "& ul, & ol": { paddingLeft: "1.5em", marginBottom: "0.5em" },
                          "& li": { marginBottom: "0.25em" },
                          "& code": { background: "var(--chakra-colors-gray-200)", padding: "0.1em 0.3em", borderRadius: "4px", fontSize: "0.9em" },
                          "& pre": { background: "var(--chakra-colors-gray-200)", padding: "0.75em", borderRadius: "8px", overflowX: "auto", marginBottom: "0.5em" },
                          "& pre code": { background: "none", padding: 0 },
                          "& h1, & h2, & h3, & h4": { fontFamily: "var(--chakra-fonts-heading)", fontWeight: 600, marginTop: "0.5em", marginBottom: "0.25em" },
                          "& strong": { fontWeight: 600 },
                          "& table": { borderCollapse: "collapse", width: "100%", marginBottom: "0.5em", fontSize: "0.85em" },
                          "& th, & td": { border: "1px solid var(--chakra-colors-gray-300)", padding: "0.35em 0.65em", textAlign: "left" },
                          "& th": { background: "var(--chakra-colors-gray-200)", fontWeight: 600 },
                          "& tr:nth-child(even)": { background: "var(--chakra-colors-gray-50)" },
                        }}
                      >
                        <Text fontFamily="body" fontSize="sm" as="div">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {content}
                          </ReactMarkdown>
                        </Text>
                      </Box>
                    </Box>
                  );
                })}

              {isStreaming && toolActivity && <ToolActivityIndicator toolActivity={toolActivity} />}
              {isStreaming && !streamingContent && !toolActivity && (
                <Box alignSelf="flex-start" bg="gray.100" px={4} py={3} borderRadius="xl" borderBottomLeftRadius="sm">
                  <Spinner size="sm" color="violet.500" />
                </Box>
              )}
              <div ref={messagesEndRef} />
            </VStack>
          </Box>
        )}

        {/* Input — always visible */}
        <Box px={4} py={3} borderTop="1px solid" borderColor="gray.200" bg="gray.50">
          <Flex maxW="3xl" mx="auto" gap={2} align="flex-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={scholarName ? `Ask about ${scholarName} — directives, seeds, next steps…` : "Ask about scholars, mastery data, or curriculum design..."}
              resize="none"
              rows={1}
              overflow="hidden"
              bg="white"
              border="1px solid"
              borderColor="gray.300"
              borderRadius="xl"
              _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
              _focusVisible={{ boxShadow: "none", outline: "none" }}
              _placeholder={{ color: "charcoal.300" }}
              fontFamily="body"
              fontSize="sm"
              py={2.5}
              px={4}
              disabled={isStreaming}
            />
            <IconButton
              aria-label="Send message"
              size="md"
              bg="violet.500"
              color="white"
              _hover={{ bg: "violet.600" }}
              _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
              borderRadius="xl"
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
            >
              <FiSend />
            </IconButton>
          </Flex>
        </Box>
      </Flex>
    </Flex>
  );
}

// ── Session row ──────────────────────────────────────────────────────

interface SessionRowProps {
  session: { _id: Id<"chatSessions">; title: string; pinned: boolean; lastMessageAt: number };
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: () => void;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

function SessionRow({
  session, isActive, isRenaming, renameValue, renameInputRef,
  onSelect, onStartRename, onRenameChange, onRenameCommit, onRenameKeyDown,
  onTogglePin, onDelete,
}: SessionRowProps) {
  return (
    <Flex
      align="center"
      px={2}
      py={1.5}
      borderRadius="lg"
      bg={isActive ? "violet.100" : "transparent"}
      _hover={{ bg: isActive ? "violet.100" : "gray.100" }}
      cursor="pointer"
      gap={1}
      role="group"
      onClick={onSelect}
    >
      <Box flex={1} minW={0}>
        {isRenaming ? (
          <input
            ref={renameInputRef as React.RefObject<HTMLInputElement>}
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={onRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              background: "white",
              border: "1px solid var(--chakra-colors-violet-400)",
              borderRadius: "6px",
              padding: "2px 6px",
              fontFamily: "var(--chakra-fonts-heading)",
              fontSize: "13px",
              outline: "none",
            }}
          />
        ) : (
          <>
            <Text
              fontFamily="heading"
              fontSize="xs"
              color={isActive ? "violet.700" : "charcoal.500"}
              lineClamp={1}
              title={session.title}
            >
              {session.title}
            </Text>
            <Text fontFamily="body" fontSize="2xs" color="charcoal.300">
              {formatRelativeTime(session.lastMessageAt)}
            </Text>
          </>
        )}
      </Box>

      {/* Pin icon */}
      <IconButton
        aria-label={session.pinned ? "Unpin" : "Pin"}
        size="xs"
        variant="ghost"
        color={session.pinned ? "violet.500" : "charcoal.300"}
        opacity={session.pinned ? 1 : 0.35}
        _groupHover={{ opacity: 1 }}
        _hover={{ color: "violet.500", bg: "transparent", opacity: 1 }}
        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
      >
        <FiBookmark size={12} />
      </IconButton>

      {/* "..." menu */}
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton
            aria-label="Session options"
            size="xs"
            variant="ghost"
            color="charcoal.300"
            opacity={0.45}
            _groupHover={{ opacity: 1 }}
            _hover={{ color: "charcoal.500", bg: "transparent", opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <FiMoreVertical size={12} />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="140px" shadow="md" borderRadius="lg" border="1px solid" borderColor="gray.200">
              <Menu.Item
                value="rename"
                fontFamily="heading"
                fontSize="xs"
                onClick={(e) => { e.stopPropagation(); onStartRename(); }}
              >
                <FiEdit2 size={12} style={{ marginRight: "8px" }} />
                Rename
              </Menu.Item>
              <Menu.Item
                value="pin"
                fontFamily="heading"
                fontSize="xs"
                onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
              >
                <FiBookmark size={12} style={{ marginRight: "8px" }} />
                {session.pinned ? "Unpin" : "Pin"}
              </Menu.Item>
              <Menu.Item
                value="delete"
                fontFamily="heading"
                fontSize="xs"
                color="red.500"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <FiTrash2 size={12} style={{ marginRight: "8px" }} />
                Delete
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </Flex>
  );
}
