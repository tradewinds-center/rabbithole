"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Textarea,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import {
  FiX,
  FiSend,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiAlertTriangle,
  FiEye,
  FiMessageCircle,
} from "react-icons/fi";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  flagged?: boolean;
  flagReason?: string;
}

interface Conversation {
  id: string;
  title: string;
  status: "green" | "yellow" | "red";
  teacherWhisper?: string;
  analysisSummary?: string;
}

interface Analysis {
  engagementScore: number;
  complexityLevel: number;
  onTaskScore: number;
  topics: string[];
  learningIndicators: string[];
  concernFlags: string[];
  summary: string;
  suggestedIntervention: string | null;
}

interface ConversationViewerProps {
  conversationId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function ConversationViewer({
  conversationId,
  onClose,
  onUpdate,
}: ConversationViewerProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [whisper, setWhisper] = useState("");
  const [isSavingWhisper, setIsSavingWhisper] = useState(false);
  const [activeTab, setActiveTab] = useState<"messages" | "analysis">("messages");

  // Fetch conversation data
  const fetchConversation = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setConversation(data.conversation);
        setMessages(data.messages || []);
        setWhisper(data.conversation.teacherWhisper || "");
      }
    } catch (error) {
      console.error("Error fetching conversation:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  // Fetch analysis
  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await fetch(`/api/observe?conversationId=${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.analyses && data.analyses.length > 0) {
          setAnalysis(data.analyses[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching analysis:", error);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchConversation();
    fetchAnalysis();
  }, [fetchConversation, fetchAnalysis]);

  // Run analysis
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/observe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
        await fetchConversation();
        onUpdate();
      }
    } catch (error) {
      console.error("Error analyzing conversation:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save whisper
  const handleSaveWhisper = async () => {
    setIsSavingWhisper(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherWhisper: whisper || null }),
      });
      if (res.ok) {
        await fetchConversation();
        onUpdate();
      }
    } catch (error) {
      console.error("Error saving whisper:", error);
    } finally {
      setIsSavingWhisper(false);
    }
  };

  // Update status
  const handleUpdateStatus = async (status: "green" | "yellow" | "red") => {
    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchConversation();
      onUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const statusConfig = {
    green: { icon: FiCheckCircle, label: "On Track", color: "green" },
    yellow: { icon: FiAlertTriangle, label: "Attention", color: "yellow" },
    red: { icon: FiAlertCircle, label: "Intervention", color: "red" },
  };

  if (isLoading) {
    return (
      <Box
        w={{ base: "full", md: "450px" }}
        bg="white"
        borderLeft="1px solid"
        borderColor="gray.200"
        h="full"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Spinner size="lg" color="violet.500" />
      </Box>
    );
  }

  return (
    <Box
      w={{ base: "full", md: "450px" }}
      bg="white"
      borderLeft="1px solid"
      borderColor="gray.200"
      h="full"
      display="flex"
      flexDir="column"
      position={{ base: "absolute", md: "relative" }}
      right={0}
      zIndex={30}
    >
      {/* Header */}
      <Flex
        p={4}
        borderBottom="1px solid"
        borderColor="gray.200"
        justify="space-between"
        align="center"
      >
        <VStack gap={1} align="start">
          <Text
            fontWeight="600"
            fontFamily="heading"
            color="navy.500"
            fontSize="lg"
          >
            {conversation?.title}
          </Text>
          <HStack gap={2}>
            {conversation?.status && (
              <Badge
                bg={`${statusConfig[conversation.status].color}.100`}
                color={`${statusConfig[conversation.status].color}.700`}
                px={2}
                py={0.5}
                borderRadius="full"
                fontFamily="heading"
                fontSize="xs"
              >
                {statusConfig[conversation.status].label}
              </Badge>
            )}
          </HStack>
        </VStack>
        <IconButton
          aria-label="Close"
          variant="ghost"
          onClick={onClose}
        >
          <FiX />
        </IconButton>
      </Flex>

      {/* Tabs */}
      <HStack p={2} borderBottom="1px solid" borderColor="gray.200" gap={1}>
        <Button
          size="sm"
          variant={activeTab === "messages" ? "solid" : "ghost"}
          bg={activeTab === "messages" ? "navy.500" : "transparent"}
          color={activeTab === "messages" ? "white" : "charcoal.500"}
          fontFamily="heading"
          onClick={() => setActiveTab("messages")}
        >
          <FiMessageCircle style={{ marginRight: "6px" }} />
          Messages
        </Button>
        <Button
          size="sm"
          variant={activeTab === "analysis" ? "solid" : "ghost"}
          bg={activeTab === "analysis" ? "navy.500" : "transparent"}
          color={activeTab === "analysis" ? "white" : "charcoal.500"}
          fontFamily="heading"
          onClick={() => setActiveTab("analysis")}
        >
          <FiEye style={{ marginRight: "6px" }} />
          Analysis
        </Button>
      </HStack>

      {/* Content */}
      <Box flex={1} overflow="auto" p={4}>
        {activeTab === "messages" ? (
          <VStack gap={3} align="stretch">
            {messages
              .filter((m) => m.role !== "system")
              .map((message) => (
                <Box
                  key={message.id}
                  p={3}
                  bg={message.role === "user" ? "navy.50" : "gray.50"}
                  borderRadius="lg"
                  borderLeft="3px solid"
                  borderColor={
                    message.role === "user" ? "navy.500" : "violet.500"
                  }
                >
                  <Text
                    fontSize="xs"
                    fontWeight="600"
                    fontFamily="heading"
                    color="charcoal.400"
                    mb={1}
                  >
                    {message.role === "user" ? "Scholar" : "Makawulu"}
                  </Text>
                  <Box className="chat-markdown" fontFamily="body" fontSize="sm">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </Box>
                  {message.flagged && (
                    <Badge mt={2} colorScheme="red" fontSize="xs">
                      Flagged: {message.flagReason}
                    </Badge>
                  )}
                </Box>
              ))}
            {messages.length === 0 && (
              <Text
                color="charcoal.300"
                fontFamily="heading"
                textAlign="center"
                py={8}
              >
                No messages yet
              </Text>
            )}
          </VStack>
        ) : (
          <VStack gap={4} align="stretch">
            {/* Analysis */}
            {analysis ? (
              <>
                <Box p={4} bg="gray.50" borderRadius="lg">
                  <Text
                    fontWeight="600"
                    fontFamily="heading"
                    mb={2}
                    color="navy.500"
                  >
                    Summary
                  </Text>
                  <Text fontFamily="body" fontSize="sm" color="charcoal.500">
                    {analysis.summary}
                  </Text>
                </Box>

                {/* Scores */}
                <VStack gap={2} align="stretch">
                  <ScoreBar
                    label="Engagement"
                    value={analysis.engagementScore}
                  />
                  <ScoreBar
                    label="Complexity"
                    value={analysis.complexityLevel}
                  />
                  <ScoreBar label="On Task" value={analysis.onTaskScore} />
                </VStack>

                {/* Topics */}
                {analysis.topics.length > 0 && (
                  <Box>
                    <Text
                      fontWeight="600"
                      fontFamily="heading"
                      fontSize="sm"
                      mb={2}
                      color="navy.500"
                    >
                      Topics
                    </Text>
                    <HStack gap={2} flexWrap="wrap">
                      {analysis.topics.map((topic, i) => (
                        <Badge
                          key={i}
                          bg="cyan.100"
                          color="cyan.700"
                          fontFamily="heading"
                        >
                          {topic}
                        </Badge>
                      ))}
                    </HStack>
                  </Box>
                )}

                {/* Learning Indicators */}
                {analysis.learningIndicators.length > 0 && (
                  <Box>
                    <Text
                      fontWeight="600"
                      fontFamily="heading"
                      fontSize="sm"
                      mb={2}
                      color="navy.500"
                    >
                      Learning Indicators
                    </Text>
                    <VStack gap={1} align="stretch">
                      {analysis.learningIndicators.map((indicator, i) => (
                        <HStack key={i} gap={2}>
                          <Box w={2} h={2} borderRadius="full" bg="green.500" />
                          <Text fontFamily="body" fontSize="sm">
                            {indicator}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                )}

                {/* Concerns */}
                {analysis.concernFlags.length > 0 && (
                  <Box p={3} bg="red.50" borderRadius="lg">
                    <Text
                      fontWeight="600"
                      fontFamily="heading"
                      fontSize="sm"
                      mb={2}
                      color="red.700"
                    >
                      Concerns
                    </Text>
                    <VStack gap={1} align="stretch">
                      {analysis.concernFlags.map((concern, i) => (
                        <HStack key={i} gap={2}>
                          <FiAlertCircle color="#c53030" />
                          <Text fontFamily="body" fontSize="sm" color="red.700">
                            {concern}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                )}

                {/* Suggested Intervention */}
                {analysis.suggestedIntervention && (
                  <Box p={3} bg="yellow.50" borderRadius="lg">
                    <Text
                      fontWeight="600"
                      fontFamily="heading"
                      fontSize="sm"
                      mb={2}
                      color="yellow.800"
                    >
                      Suggested Intervention
                    </Text>
                    <Text fontFamily="body" fontSize="sm" color="yellow.900">
                      {analysis.suggestedIntervention}
                    </Text>
                  </Box>
                )}
              </>
            ) : (
              <Text
                color="charcoal.300"
                fontFamily="heading"
                textAlign="center"
                py={4}
              >
                No analysis available
              </Text>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              bg="violet.500"
              color="white"
              _hover={{ bg: "violet.700" }}
              fontFamily="heading"
            >
              <FiRefreshCw
                style={{ marginRight: "8px" }}
                className={isAnalyzing ? "animate-spin" : ""}
              />
              {isAnalyzing ? "Analyzing..." : "Run New Analysis"}
            </Button>
          </VStack>
        )}
      </Box>

      {/* Teacher Whisper Section */}
      <Box p={4} borderTop="1px solid" borderColor="gray.200" bg="gray.50">
        <Text
          fontWeight="600"
          fontFamily="heading"
          fontSize="sm"
          mb={2}
          color="navy.500"
        >
          Teacher Whisper
        </Text>
        <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mb={2}>
          Guidance injected into AI system prompt. Scholar won&apos;t see this
          directly.
        </Text>
        <Textarea
          value={whisper}
          onChange={(e) => setWhisper(e.target.value)}
          placeholder="e.g., 'Encourage the scholar to explore the history angle more...'"
          rows={3}
          fontSize="sm"
          fontFamily="body"
          bg="white"
          border="2px solid"
          borderColor="gray.200"
          _focus={{ borderColor: "violet.500" }}
          mb={2}
        />
        <HStack justify="space-between">
          <HStack gap={1}>
            {(["green", "yellow", "red"] as const).map((status) => (
              <IconButton
                key={status}
                aria-label={`Set ${status}`}
                size="sm"
                variant={conversation?.status === status ? "solid" : "outline"}
                bg={
                  conversation?.status === status
                    ? `${status === "yellow" ? "yellow.500" : status}.500`
                    : "transparent"
                }
                borderColor={`${status === "yellow" ? "yellow.500" : status}.500`}
                color={
                  conversation?.status === status
                    ? status === "yellow"
                      ? "yellow.900"
                      : "white"
                    : `${status === "yellow" ? "yellow.600" : status}.500`
                }
                onClick={() => handleUpdateStatus(status)}
              >
                {status === "green" && <FiCheckCircle />}
                {status === "yellow" && <FiAlertTriangle />}
                {status === "red" && <FiAlertCircle />}
              </IconButton>
            ))}
          </HStack>
          <Button
            size="sm"
            onClick={handleSaveWhisper}
            disabled={isSavingWhisper}
            bg="navy.500"
            color="white"
            _hover={{ bg: "navy.700" }}
            fontFamily="heading"
          >
            <FiSend style={{ marginRight: "6px" }} />
            {isSavingWhisper ? "Saving..." : "Save Whisper"}
          </Button>
        </HStack>
      </Box>
    </Box>
  );
}

// Score Bar Component
function ScoreBar({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(value * 100);
  const color =
    percentage >= 70 ? "green.500" : percentage >= 40 ? "yellow.500" : "red.500";

  return (
    <Box>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="xs" fontFamily="heading" color="charcoal.500">
          {label}
        </Text>
        <Text fontSize="xs" fontFamily="heading" fontWeight="600" color={color}>
          {percentage}%
        </Text>
      </HStack>
      <Box h={2} bg="gray.200" borderRadius="full" overflow="hidden">
        <Box
          h="full"
          w={`${percentage}%`}
          bg={color}
          borderRadius="full"
          transition="width 0.3s ease"
        />
      </Box>
    </Box>
  );
}
