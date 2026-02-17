"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Flex,
  VStack,
  Text,
  Textarea,
  IconButton,
  Button,
  Spinner,
} from "@chakra-ui/react";
import { FiSend, FiTrash2 } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function CurriculumAssistant() {
  const { user } = useCurrentUser();
  const messages = useQuery(api.curriculumAssistant.getMessages) ?? [];
  const sendMessage = useMutation(api.curriculumAssistant.sendMessage);
  const clearHistory = useMutation(api.curriculumAssistant.clearHistory);

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
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
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingMsgId(null);

    try {
      const result = await sendMessage({ message: text });
      setStreamingMsgId(result.assistantMsgId);

      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!.replace(
        ".cloud",
        ".site"
      );
      const res = await fetch(`${convexUrl}/curriculum-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: String(user._id),
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

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  fullContent += data.text;
                  setStreamingContent(fullContent);
                } else if (data.done) {
                  setStreamingContent("");
                  setStreamingMsgId(null);
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
  }, [input, isStreaming, user, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = async () => {
    if (isStreaming) return;
    await clearHistory();
  };

  return (
    <Flex flex={1} direction="column" overflow="hidden" bg="white">
      {/* Header */}
      <Flex
        px={6}
        py={3}
        borderBottom="1px solid"
        borderColor="gray.200"
        align="center"
        gap={3}
      >
        <Text
          fontFamily="heading"
          fontWeight="600"
          fontSize="md"
          color="navy.500"
        >
          Curriculum Assistant
        </Text>
        <Box flex={1} />
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
              <Text fontFamily="heading" fontSize="md">
                Ask me about your scholars or curriculum
              </Text>
              <Text fontFamily="body" fontSize="sm" color="charcoal.300" textAlign="center" maxW="md">
                I can look up student profiles, mastery data, learning signals, and help you design or adapt units.
              </Text>
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
                    }}
                  >
                    <Text fontFamily="body" fontSize="sm" as="div">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content}
                      </ReactMarkdown>
                    </Text>
                  </Box>
                </Box>
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
            placeholder="Ask about scholars, mastery data, or curriculum design..."
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
