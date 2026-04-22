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
} from "@chakra-ui/react";
import { FiSend, FiTrash2, FiX, FiUser } from "react-icons/fi";
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

export default function CurriculumAssistant() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawScholar = searchParams.get("scholar");
  const scholarId = rawScholar && rawScholar.length > 0 ? rawScholar : null;
  const isScoped = !!scholarId;

  const { user } = useCurrentUser();
  // Unscoped: global teacher thread. Scoped: scholar thread.
  const globalMessages = useQuery(
    api.curriculumAssistant.getMessages,
    isScoped ? "skip" : {}
  );
  const scholarMessages = useQuery(
    api.curriculumAssistant.listMessagesForScholar,
    isScoped ? { scholarId: scholarId as Id<"users"> } : "skip"
  );
  const messages = (isScoped ? scholarMessages : globalMessages) ?? [];

  // Fetch scholar name when scoped — used in header + empty state.
  const scholarProfile = useQuery(
    api.scholars.getProfile,
    isScoped ? { scholarId: scholarId as Id<"users"> } : "skip"
  );
  const scholarName = scholarProfile?.scholar?.name ?? null;

  const sendMessage = useMutation(api.curriculumAssistant.sendMessage);
  const clearHistory = useMutation(api.curriculumAssistant.clearHistory);

  const [input, setInput] = useState("");
  const stream = useAgentStream();
  const { isStreaming, streamingContent, streamingMsgId, toolActivity } = stream;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

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

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !user) return;

    setInput("");

    try {
      const result = await sendMessage({
        message: text,
        scholarId: scholarId ? (scholarId as Id<"users">) : undefined,
      });

      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!.replace(
        ".cloud",
        ".site"
      );
      await stream.send(
        `${convexUrl}/curriculum-stream`,
        {
          teacherId: String(user._id),
          streamId: result.streamId,
          assistantMsgId: result.assistantMsgId,
          ...(scholarId ? { scholarId } : {}),
        },
        result.assistantMsgId,
      );
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }, [input, isStreaming, user, sendMessage, stream, scholarId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = async () => {
    if (isStreaming) return;
    await clearHistory(
      scholarId ? { scholarId: scholarId as Id<"users"> } : {}
    );
  };

  const handleClearScope = () => {
    router.push("/teacher?tab=assistant", { scroll: false });
  };

  return (
    <Flex flex={1} direction="column" overflow="hidden" bg="white">
      {/* Header */}
      <Flex
        px={6}
        py={3}
        borderBottom="1px solid"
        borderColor="gray.200"
        bg={isScoped ? "violet.50" : "white"}
        align="center"
        gap={3}
      >
        {isScoped ? (
          <>
            <Badge
              bg="violet.500"
              color="white"
              fontFamily="heading"
              fontSize="2xs"
              px={2}
              py={0.5}
              borderRadius="md"
            >
              <FiUser style={{ marginRight: "4px" }} />
              Scoped
            </Badge>
            <Text
              fontFamily="heading"
              fontWeight="600"
              fontSize="md"
              color="violet.700"
            >
              Chatting about {scholarName ?? "…"}
            </Text>
          </>
        ) : (
          <Text
            fontFamily="heading"
            fontWeight="600"
            fontSize="md"
            color="navy.500"
          >
            Chat
          </Text>
        )}
        <Box flex={1} />
        {isScoped && (
          <Button
            size="xs"
            variant="ghost"
            color="violet.700"
            fontFamily="heading"
            fontSize="xs"
            _hover={{ bg: "violet.100" }}
            onClick={handleClearScope}
            aria-label="Clear scholar scope"
          >
            <FiX style={{ marginRight: "4px" }} />
            Clear scope
          </Button>
        )}
        {messages.length > 0 && (
          <Button
            size="xs"
            variant="ghost"
            color="charcoal.400"
            fontFamily="heading"
            fontSize="xs"
            _hover={{ color: "red.500", bg: "red.50" }}
            onClick={handleClear}
            disabled={isStreaming}
          >
            <FiTrash2 style={{ marginRight: "4px" }} />
            Clear
          </Button>
        )}
      </Flex>

      {/* Messages */}
      <Box flex={1} overflowY="auto" px={6} py={4}>
        <VStack gap={4} maxW="3xl" mx="auto" align="stretch">
          {messages.length === 0 && !streamingContent && (
            <VStack py={12} gap={3} color="charcoal.300">
              {isScoped ? (
                <>
                  <Text fontFamily="heading" fontSize="md" color="violet.700">
                    No messages yet in this thread.
                  </Text>
                  <Text
                    fontFamily="body"
                    fontSize="sm"
                    color="charcoal.400"
                    textAlign="center"
                    maxW="md"
                  >
                    Ask about {scholarName ?? "this scholar"}&rsquo;s dossier, directives,
                    recent projects, or what to plan next.
                  </Text>
                </>
              ) : (
                <>
                  <Text fontFamily="heading" fontSize="md">
                    Ask me about your scholars or curriculum
                  </Text>
                  <Text fontFamily="body" fontSize="sm" color="charcoal.300" textAlign="center" maxW="md">
                    I can look up student profiles, mastery data, learning signals, and help you design or adapt units.
                  </Text>
                </>
              )}
            </VStack>
          )}

          {messages
            .filter((m) => {
              // Hide placeholder messages being actively streamed
              if (streamingMsgId && String(m._id) === streamingMsgId && !m.content) {
                return false;
              }
              return true;
            })
            .map((m) => {
              const isActiveStream = streamingMsgId && String(m._id) === streamingMsgId;
              const content = isActiveStream ? (streamingContent || m.content) : m.content;

              if (m.role === "user") {
                return (
                  <Box key={String(m._id)} alignSelf="flex-end">
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
                      <Text fontFamily="body" fontSize="sm" whiteSpace="pre-wrap">
                        {content}
                      </Text>
                    </Box>
                  </Box>
                );
              }

              // Assistant
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
                      "& code": {
                        background: "var(--chakra-colors-gray-200)",
                        padding: "0.1em 0.3em",
                        borderRadius: "4px",
                        fontSize: "0.9em",
                      },
                      "& pre": {
                        background: "var(--chakra-colors-gray-200)",
                        padding: "0.75em",
                        borderRadius: "8px",
                        overflowX: "auto",
                        marginBottom: "0.5em",
                      },
                      "& pre code": { background: "none", padding: 0 },
                      "& h1, & h2, & h3, & h4": {
                        fontFamily: "var(--chakra-fonts-heading)",
                        fontWeight: 600,
                        marginTop: "0.5em",
                        marginBottom: "0.25em",
                      },
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

          {/* Tool activity indicator */}
          {isStreaming && toolActivity && (
            <ToolActivityIndicator toolActivity={toolActivity} />
          )}

          {/* Typing indicator */}
          {isStreaming && !streamingContent && !toolActivity && (
            <Box
              alignSelf="flex-start"
              bg="gray.100"
              px={4}
              py={3}
              borderRadius="xl"
              borderBottomLeftRadius="sm"
            >
              <Spinner size="sm" color="violet.500" />
            </Box>
          )}

          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      {/* Input area */}
      <Box
        px={4}
        py={3}
        borderTop="1px solid"
        borderColor="gray.200"
        bg="gray.50"
      >
        <Flex maxW="3xl" mx="auto" gap={2} align="flex-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isScoped
                ? `Ask about ${scholarName ?? "this scholar"} — directives, seeds, next steps…`
                : "Ask about scholars, mastery data, or curriculum design..."
            }
            resize="none"
            rows={1}
            overflow="hidden"
            bg="white"
            border="1px solid"
            borderColor="gray.300"
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
  );
}
