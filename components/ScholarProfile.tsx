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
  Input,
  Textarea,
  Spinner,
  Badge,
  Select,
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import {
  FiX,
  FiThumbsUp,
  FiThumbsDown,
  FiPlus,
  FiTrash2,
  FiUser,
  FiBookOpen,
  FiTarget,
} from "react-icons/fi";

interface ScholarTopic {
  id: string;
  topic: string;
  bloomLevel: string;
  teacherRating: number;
  mentionCount: number;
}

interface SuggestedTopic {
  id: string;
  topic: string;
  rationale: string | null;
  targetBloomLevel: string | null;
  explored: boolean;
}

interface Scholar {
  id: string;
  email: string;
  name: string;
  image?: string;
  readingLevel?: string | null;
  createdAt: string;
}

interface ScholarProfileProps {
  scholarId: string;
  onClose: () => void;
}

const BLOOM_COLORS: Record<string, string> = {
  remember: "gray",
  understand: "blue",
  apply: "cyan",
  analyze: "teal",
  evaluate: "purple",
  create: "violet",
};

const BLOOM_LEVELS = [
  { value: "remember", label: "Remember - Recall facts" },
  { value: "understand", label: "Understand - Explain ideas" },
  { value: "apply", label: "Apply - Use in new situations" },
  { value: "analyze", label: "Analyze - Draw connections" },
  { value: "evaluate", label: "Evaluate - Justify decisions" },
  { value: "create", label: "Create - Produce new work" },
];

const READING_LEVELS = [
  { value: "", label: "Not set" },
  { value: "K", label: "K - Kindergarten" },
  { value: "1", label: "1st Grade" },
  { value: "2", label: "2nd Grade" },
  { value: "3", label: "3rd Grade" },
  { value: "4", label: "4th Grade" },
  { value: "5", label: "5th Grade" },
  { value: "6", label: "6th Grade" },
  { value: "7", label: "7th Grade" },
  { value: "8", label: "8th Grade" },
  { value: "9", label: "9th Grade" },
  { value: "10", label: "10th Grade" },
  { value: "11", label: "11th Grade" },
  { value: "12", label: "12th Grade" },
  { value: "college", label: "College" },
];

export function ScholarProfile({ scholarId, onClose }: ScholarProfileProps) {
  const [scholar, setScholar] = useState<Scholar | null>(null);
  const [topics, setTopics] = useState<ScholarTopic[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedTopic[]>([]);
  const [stats, setStats] = useState({ conversationCount: 0, messageCount: 0, topicCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [newSuggestion, setNewSuggestion] = useState({ topic: "", rationale: "", targetBloomLevel: "apply" });
  const [isAddingSuggestion, setIsAddingSuggestion] = useState(false);
  const [isSavingReadingLevel, setIsSavingReadingLevel] = useState(false);

  // Fetch scholar profile
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/scholars/${scholarId}`);
      if (res.ok) {
        const data = await res.json();
        setScholar(data.scholar);
        setTopics(data.topics);
        setSuggestions(data.suggestions);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching scholar profile:", error);
    } finally {
      setIsLoading(false);
    }
  }, [scholarId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Update reading level
  const handleReadingLevelChange = async (newLevel: string) => {
    setIsSavingReadingLevel(true);
    try {
      const res = await fetch(`/api/scholars/${scholarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readingLevel: newLevel || null }),
      });
      if (res.ok) {
        setScholar((prev) => prev ? { ...prev, readingLevel: newLevel || null } : prev);
      }
    } catch (error) {
      console.error("Error updating reading level:", error);
    } finally {
      setIsSavingReadingLevel(false);
    }
  };

  // Rate a topic
  const handleRateTopic = async (topicId: string, rating: number) => {
    try {
      await fetch(`/api/scholars/${scholarId}/topics`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, rating }),
      });
      // Update local state
      setTopics((prev) =>
        prev.map((t) => (t.id === topicId ? { ...t, teacherRating: rating } : t))
      );
    } catch (error) {
      console.error("Error rating topic:", error);
    }
  };

  // Add a suggested topic
  const handleAddSuggestion = async () => {
    if (!newSuggestion.topic.trim()) return;

    setIsAddingSuggestion(true);
    try {
      const res = await fetch(`/api/scholars/${scholarId}/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSuggestion),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions((prev) => [data.suggestion, ...prev]);
        setNewSuggestion({ topic: "", rationale: "", targetBloomLevel: "apply" });
      }
    } catch (error) {
      console.error("Error adding suggestion:", error);
    } finally {
      setIsAddingSuggestion(false);
    }
  };

  // Delete a suggested topic
  const handleDeleteSuggestion = async (suggestionId: string) => {
    try {
      await fetch(`/api/scholars/${scholarId}/suggestions?suggestionId=${suggestionId}`, {
        method: "DELETE",
      });
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    } catch (error) {
      console.error("Error deleting suggestion:", error);
    }
  };

  if (isLoading) {
    return (
      <Box
        w={{ base: "full", md: "400px" }}
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
      w={{ base: "full", md: "400px" }}
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
        bg="navy.500"
      >
        <HStack gap={3}>
          <Avatar
            size="md"
            name={scholar?.name || "Scholar"}
            src={scholar?.image || undefined}
          />
          <VStack gap={0} align="start">
            <Text fontWeight="600" fontFamily="heading" color="white" fontSize="lg">
              {scholar?.name}
            </Text>
            <Text color="whiteAlpha.700" fontSize="xs" fontFamily="heading">
              {scholar?.email}
            </Text>
          </VStack>
        </HStack>
        <IconButton
          aria-label="Close"
          variant="ghost"
          color="white"
          _hover={{ bg: "whiteAlpha.200" }}
          onClick={onClose}
        >
          <FiX />
        </IconButton>
      </Flex>

      {/* Stats */}
      <HStack p={4} borderBottom="1px solid" borderColor="gray.200" justify="space-around">
        <VStack gap={0}>
          <Text fontSize="2xl" fontWeight="bold" fontFamily="heading" color="navy.500">
            {stats.conversationCount}
          </Text>
          <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
            Chats
          </Text>
        </VStack>
        <VStack gap={0}>
          <Text fontSize="2xl" fontWeight="bold" fontFamily="heading" color="navy.500">
            {stats.messageCount}
          </Text>
          <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
            Messages
          </Text>
        </VStack>
        <VStack gap={0}>
          <Text fontSize="2xl" fontWeight="bold" fontFamily="heading" color="navy.500">
            {stats.topicCount}
          </Text>
          <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
            Topics
          </Text>
        </VStack>
      </HStack>

      {/* Reading Level */}
      <Box p={4} borderBottom="1px solid" borderColor="gray.200">
        <HStack mb={2}>
          <FiUser color="#AD60BF" />
          <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
            Reading Level
          </Text>
          {isSavingReadingLevel && <Spinner size="xs" color="violet.500" />}
        </HStack>
        <select
          value={scholar?.readingLevel || ""}
          onChange={(e) => handleReadingLevelChange(e.target.value)}
          disabled={isSavingReadingLevel}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
            fontSize: "14px",
            fontFamily: "inherit",
            backgroundColor: isSavingReadingLevel ? "#f7f7f7" : "white",
          }}
        >
          {READING_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
        <Text fontSize="xs" color="charcoal.400" fontFamily="body" mt={1}>
          Adjusts vocabulary and complexity in conversations
        </Text>
      </Box>

      {/* Content */}
      <Box flex={1} overflow="auto" p={4}>
        <VStack gap={6} align="stretch">
          {/* Topics of Interest */}
          <Box>
            <HStack mb={3}>
              <FiBookOpen color="#AD60BF" />
              <Text fontWeight="600" fontFamily="heading" color="navy.500">
                Topics of Interest
              </Text>
            </HStack>
            {topics.length > 0 ? (
              <VStack gap={2} align="stretch">
                {topics.map((topic) => (
                  <Box
                    key={topic.id}
                    p={3}
                    bg="gray.50"
                    borderRadius="lg"
                    borderLeft="3px solid"
                    borderColor={`${BLOOM_COLORS[topic.bloomLevel] || "gray"}.500`}
                  >
                    <HStack justify="space-between">
                      <VStack gap={1} align="start" flex={1}>
                        <HStack>
                          <Text fontFamily="heading" fontSize="sm" fontWeight="600">
                            {topic.topic}
                          </Text>
                          <Badge
                            bg={`${BLOOM_COLORS[topic.bloomLevel] || "gray"}.100`}
                            color={`${BLOOM_COLORS[topic.bloomLevel] || "gray"}.700`}
                            fontSize="xs"
                          >
                            {topic.bloomLevel}
                          </Badge>
                        </HStack>
                        <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                          Mentioned {topic.mentionCount} time{topic.mentionCount !== 1 ? "s" : ""}
                        </Text>
                      </VStack>
                      <HStack gap={1}>
                        <IconButton
                          aria-label="Thumbs up"
                          size="sm"
                          variant={topic.teacherRating === 1 ? "solid" : "ghost"}
                          bg={topic.teacherRating === 1 ? "green.500" : "transparent"}
                          color={topic.teacherRating === 1 ? "white" : "green.500"}
                          _hover={{ bg: topic.teacherRating === 1 ? "green.600" : "green.50" }}
                          onClick={() => handleRateTopic(topic.id, topic.teacherRating === 1 ? 0 : 1)}
                        >
                          <FiThumbsUp />
                        </IconButton>
                        <IconButton
                          aria-label="Thumbs down"
                          size="sm"
                          variant={topic.teacherRating === -1 ? "solid" : "ghost"}
                          bg={topic.teacherRating === -1 ? "red.500" : "transparent"}
                          color={topic.teacherRating === -1 ? "white" : "red.500"}
                          _hover={{ bg: topic.teacherRating === -1 ? "red.600" : "red.50" }}
                          onClick={() => handleRateTopic(topic.id, topic.teacherRating === -1 ? 0 : -1)}
                        >
                          <FiThumbsDown />
                        </IconButton>
                      </HStack>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={4}>
                No topics tracked yet. Run an analysis on a conversation to detect topics.
              </Text>
            )}
          </Box>

          {/* Suggested Follow-up Topics */}
          <Box>
            <HStack mb={3}>
              <FiTarget color="#AD60BF" />
              <Text fontWeight="600" fontFamily="heading" color="navy.500">
                Suggested Follow-ups
              </Text>
            </HStack>

            {/* Add new suggestion */}
            <Box p={3} bg="violet.50" borderRadius="lg" mb={3}>
              <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="violet.700" mb={2}>
                Add a topic to push {scholar?.name?.split(" ")[0]} intellectually:
              </Text>
              <VStack gap={2} align="stretch">
                <Input
                  size="sm"
                  placeholder="Topic (e.g., 'Design a triple-decker aircraft')"
                  value={newSuggestion.topic}
                  onChange={(e) => setNewSuggestion((prev) => ({ ...prev, topic: e.target.value }))}
                  bg="white"
                  fontFamily="body"
                />
                <Textarea
                  size="sm"
                  placeholder="Why this topic? (optional)"
                  value={newSuggestion.rationale}
                  onChange={(e) => setNewSuggestion((prev) => ({ ...prev, rationale: e.target.value }))}
                  rows={2}
                  bg="white"
                  fontFamily="body"
                />
                <HStack>
                  <Box flex={1}>
                    <select
                      value={newSuggestion.targetBloomLevel}
                      onChange={(e) => setNewSuggestion((prev) => ({ ...prev, targetBloomLevel: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                        fontFamily: "inherit",
                      }}
                    >
                      {BLOOM_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </Box>
                  <Button
                    size="sm"
                    bg="violet.500"
                    color="white"
                    _hover={{ bg: "violet.600" }}
                    fontFamily="heading"
                    onClick={handleAddSuggestion}
                    disabled={isAddingSuggestion || !newSuggestion.topic.trim()}
                  >
                    <FiPlus style={{ marginRight: "4px" }} />
                    Add
                  </Button>
                </HStack>
              </VStack>
            </Box>

            {/* Existing suggestions */}
            {suggestions.length > 0 ? (
              <VStack gap={2} align="stretch">
                {suggestions.map((suggestion) => (
                  <Box
                    key={suggestion.id}
                    p={3}
                    bg="cyan.50"
                    borderRadius="lg"
                    opacity={suggestion.explored ? 0.6 : 1}
                  >
                    <HStack justify="space-between" align="start">
                      <VStack gap={1} align="start" flex={1}>
                        <HStack>
                          <Text fontFamily="heading" fontSize="sm" fontWeight="600" color="cyan.700">
                            {suggestion.topic}
                          </Text>
                          {suggestion.targetBloomLevel && (
                            <Badge
                              bg={`${BLOOM_COLORS[suggestion.targetBloomLevel] || "gray"}.100`}
                              color={`${BLOOM_COLORS[suggestion.targetBloomLevel] || "gray"}.700`}
                              fontSize="xs"
                            >
                              {suggestion.targetBloomLevel}
                            </Badge>
                          )}
                          {suggestion.explored && (
                            <Badge bg="green.100" color="green.700" fontSize="xs">
                              explored
                            </Badge>
                          )}
                        </HStack>
                        {suggestion.rationale && (
                          <Text fontSize="xs" color="charcoal.500" fontFamily="body">
                            {suggestion.rationale}
                          </Text>
                        )}
                      </VStack>
                      <IconButton
                        aria-label="Delete"
                        size="xs"
                        variant="ghost"
                        color="red.500"
                        _hover={{ bg: "red.50" }}
                        onClick={() => handleDeleteSuggestion(suggestion.id)}
                      >
                        <FiTrash2 />
                      </IconButton>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={2}>
                No suggestions yet. Add topics above to guide learning.
              </Text>
            )}
          </Box>
        </VStack>
      </Box>
    </Box>
  );
}
