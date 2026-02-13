"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Textarea,
  IconButton,
  Spinner,
} from "@chakra-ui/react";
import { FiSend, FiMic, FiMicOff } from "react-icons/fi";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

interface ChatInterfaceProps {
  conversationId: string;
  onConversationUpdate?: () => void;
}

export function ChatInterface({
  conversationId,
  onConversationUpdate,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const { state: dictationState, error: dictationError, toggleRecording } =
    useVoiceDictation((text) => {
      sendMessageRef.current(text);
    });

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Fetch messages when conversation changes
  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Send message (optionally with direct text, e.g. from voice dictation)
  const handleSend = async (directText?: string) => {
    const userMessage = directText?.trim() || input.trim();
    if (!userMessage || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: userMessage,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

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
                } else if (data.done) {
                  // Add assistant message to list
                  const assistantMsg: Message = {
                    id: data.messageId,
                    role: "assistant",
                    content: fullContent,
                    createdAt: new Date().toISOString(),
                  };
                  setMessages((prev) => [...prev, assistantMsg]);
                  setStreamingContent("");
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
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setIsStreaming(false);
    }
  };

  // Keep ref in sync so dictation callback can call latest handleSend
  sendMessageRef.current = handleSend;

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
      {/* Messages */}
      <Box flex={1} overflowY="auto" p={4}>
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
            .map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

          {/* Streaming message */}
          {streamingContent && (
            <MessageBubble
              message={{
                id: "streaming",
                role: "assistant",
                content: streamingContent,
                createdAt: new Date().toISOString(),
              }}
              isStreaming
            />
          )}

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
            bg="white"
            border="2px solid"
            borderColor="gray.200"
            borderRadius="xl"
            _focus={{
              borderColor: "violet.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-violet-500)",
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
            <FiSend />
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

// Message Bubble Component
function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: Message;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <Box
      className={`message-bubble ${isUser ? "user" : "assistant"} animate-fade-in`}
      alignSelf={isUser ? "flex-end" : "flex-start"}
    >
      <Box
        bg={isUser ? "navy.500" : "gray.100"}
        color={isUser ? "white" : "charcoal.500"}
        px={4}
        py={3}
        borderRadius="xl"
        borderBottomRightRadius={isUser ? "sm" : "xl"}
        borderBottomLeftRadius={isUser ? "xl" : "sm"}
        maxW="100%"
        shadow="sm"
      >
        {isUser ? (
          <Text fontFamily="body" fontSize="md" whiteSpace="pre-wrap">
            {message.content}
          </Text>
        ) : (
          <Box className="chat-markdown" fontFamily="body" fontSize="md">
            <ReactMarkdown>{message.content}</ReactMarkdown>
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
        )}
      </Box>
      <Text
        fontSize="xs"
        color="charcoal.300"
        mt={1}
        textAlign={isUser ? "right" : "left"}
        fontFamily="heading"
      >
        {isUser ? "You" : "Makawulu"}
      </Text>
    </Box>
  );
}
