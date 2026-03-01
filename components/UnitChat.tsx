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
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAgentStream } from "@/hooks/useAgentStream";
import { ToolActivityIndicator } from "./ToolActivityIndicator";

interface UnitChatProps {
  unitId: Id<"units">;
}

export function UnitChat({ unitId }: UnitChatProps) {
  const { user } = useCurrentUser();
  const messages = useQuery(api.curriculumAssistant.getMessagesByUnit, { unitId }) ?? [];
  const sendMessage = useMutation(api.curriculumAssistant.sendMessageForUnit);
  const clearHistory = useMutation(api.curriculumAssistant.clearHistoryForUnit);

  const [input, setInput] = useState("");
  const stream = useAgentStream();
  const { isStreaming, streamingContent, streamingMsgId, toolActivity } = stream;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !user) return;

    setInput("");

    try {
      const result = await sendMessage({ message: text, unitId });

      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!.replace(".cloud", ".site");
      await stream.send(
        `${convexUrl}/unit-designer-stream`,
        {
          teacherId: String(user._id),
          unitId: String(unitId),
          streamId: result.streamId,
          assistantMsgId: result.assistantMsgId,
        },
        result.assistantMsgId,
      );
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }, [input, isStreaming, user, sendMessage, unitId, stream]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Flex flex={1} direction="column" overflow="hidden" bg="white" borderLeft="1px solid" borderColor="gray.200">
      {/* Header */}
      <Flex px={4} py={2.5} borderBottom="1px solid" borderColor="gray.200" align="center" gap={2}>
        <Text fontFamily="heading" fontWeight="600" fontSize="sm" color="navy.500">
          Unit Designer
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
            onClick={() => clearHistory({ unitId })}
            disabled={isStreaming}
          >
            <FiTrash2 style={{ marginRight: 4 }} />
            Clear
          </Button>
        )}
      </Flex>

      {/* Messages */}
      <Box flex={1} overflowY="auto" px={4} py={3}>
        <VStack gap={3} align="stretch">
          {messages.length === 0 && !streamingContent && (
            <VStack py={8} gap={2} color="charcoal.300">
              <Text fontFamily="heading" fontSize="sm">
                Design this unit with AI
              </Text>
              <Text fontFamily="body" fontSize="xs" color="charcoal.300" textAlign="center">
                Describe lessons you want, and I'll create them with appropriate processes, Bloom's levels, and prompts.
              </Text>
            </VStack>
          )}

          {messages
            .filter((m) => {
              if (streamingMsgId && String(m._id) === streamingMsgId && !m.content) return false;
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
                      px={3}
                      py={2}
                      borderRadius="lg"
                      borderBottomRightRadius="sm"
                      maxW="100%"
                      shadow="sm"
                    >
                      <Text fontFamily="body" fontSize="xs" whiteSpace="pre-wrap">{content}</Text>
                    </Box>
                  </Box>
                );
              }

              return (
                <Box key={String(m._id)} alignSelf="flex-start">
                  <Box
                    bg="gray.100"
                    color="charcoal.500"
                    px={3}
                    py={2}
                    borderRadius="lg"
                    borderBottomLeftRadius="sm"
                    maxW="100%"
                    shadow="sm"
                    css={{
                      "& p": { marginBottom: "0.4em", fontSize: "12px" },
                      "& p:last-child": { marginBottom: 0 },
                      "& ul, & ol": { paddingLeft: "1.2em", marginBottom: "0.4em", fontSize: "12px" },
                      "& li": { marginBottom: "0.15em" },
                      "& code": { background: "var(--chakra-colors-gray-200)", padding: "0.1em 0.2em", borderRadius: "3px", fontSize: "0.85em" },
                      "& strong": { fontWeight: 600 },
                    }}
                  >
                    <Text fontFamily="body" fontSize="xs" as="div">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                    </Text>
                  </Box>
                </Box>
              );
            })}

          {isStreaming && toolActivity && (
            <ToolActivityIndicator toolActivity={toolActivity} />
          )}
          {isStreaming && !streamingContent && !toolActivity && (
            <Box alignSelf="flex-start" bg="gray.100" px={3} py={2} borderRadius="lg" borderBottomLeftRadius="sm">
              <Spinner size="sm" color="violet.500" />
            </Box>
          )}
          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      {/* Input */}
      <Box px={3} py={2} borderTop="1px solid" borderColor="gray.200" bg="gray.50">
        <Flex gap={2} align="flex-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe lessons, ask for prompts..."
            resize="none"
            rows={1}
            overflow="hidden"
            bg="white"
            border="1px solid"
            borderColor="gray.300"
            borderRadius="lg"
            _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
            _focusVisible={{ boxShadow: "none", outline: "none" }}
            _placeholder={{ color: "charcoal.300" }}
            fontFamily="body"
            fontSize="xs"
            py={2}
            px={3}
            disabled={isStreaming}
          />
          <IconButton
            aria-label="Send"
            size="sm"
            bg="violet.500"
            color="white"
            _hover={{ bg: "violet.600" }}
            _disabled={{ opacity: 0.4 }}
            borderRadius="lg"
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
          >
            <FiSend size={14} />
          </IconButton>
        </Flex>
      </Box>
    </Flex>
  );
}
