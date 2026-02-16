"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import {
  FiThumbsUp,
  FiThumbsDown,
  FiPlus,
  FiTrash2,
  FiBookOpen,
  FiTarget,
  FiFileText,
  FiExternalLink,
  FiUser,
  FiFolder,
  FiEdit3,
  FiCpu,
  FiLink,
  FiCheck,
} from "react-icons/fi";

interface ScholarProfileProps {
  scholarId: string;
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

type TabKey = "dossier" | "documents" | "topics" | "observations" | "reading";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }[] = [
  { key: "dossier", label: "Dossier", icon: FiUser },
  { key: "documents", label: "Documents", icon: FiFolder },
  { key: "topics", label: "Topics", icon: FiBookOpen },
  { key: "observations", label: "Observations", icon: FiFileText },
  { key: "reading", label: "Reading Level", icon: FiBookOpen },
];

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function ScholarProfile({ scholarId }: ScholarProfileProps) {
  const profile = useQuery(api.scholars.getProfile, { scholarId: scholarId as Id<"users"> });
  const observations = useQuery(api.observations.listByScholar, { scholarId: scholarId as Id<"users"> }) ?? [];
  const dossierContent = useQuery(api.dossier.getForTeacher, { scholarId: scholarId as Id<"users"> });
  const artifacts = useQuery(api.artifacts.getByScholar, { scholarId: scholarId as Id<"users"> });
  const updateDossier = useMutation(api.dossier.updateByTeacher);
  const updateReadingLevel = useMutation(api.scholars.updateReadingLevel);
  const rateTopic = useMutation(api.scholars.rateTopic);
  const addSuggestion = useMutation(api.scholars.addSuggestion);
  const removeSuggestion = useMutation(api.scholars.removeSuggestion);
  const addObservation = useMutation(api.observations.add);
  const removeObservation = useMutation(api.observations.remove);
  const generateGuestToken = useMutation(api.users.generateGuestToken);

  const [guestLinkCopied, setGuestLinkCopied] = useState(false);

  const { scholar, topics, suggestions, stats } = profile ?? {
    scholar: null,
    topics: [],
    suggestions: [],
    stats: { projectCount: 0, messageCount: 0, topicCount: 0 },
  };

  const isLoading = profile === undefined;

  const [activeTab, setActiveTab] = useState<TabKey>("dossier");
  const [dossierDraft, setDossierDraft] = useState<string | null>(null);
  const [newSuggestion, setNewSuggestion] = useState({ topic: "", rationale: "", targetBloomLevel: "apply" });
  const [isAddingSuggestion, setIsAddingSuggestion] = useState(false);
  const [isSavingReadingLevel, setIsSavingReadingLevel] = useState(false);
  const [newObservation, setNewObservation] = useState({ type: "praise" as "praise" | "concern" | "suggestion" | "intervention", note: "" });
  const [isAddingObservation, setIsAddingObservation] = useState(false);

  // Update reading level
  const handleReadingLevelChange = async (newLevel: string) => {
    setIsSavingReadingLevel(true);
    try {
      await updateReadingLevel({
        scholarId: scholarId as Id<"users">,
        readingLevel: newLevel || null,
      });
    } catch (error) {
      console.error("Error updating reading level:", error);
    } finally {
      setIsSavingReadingLevel(false);
    }
  };

  // Rate a topic
  const handleRateTopic = async (topicId: string, rating: number) => {
    try {
      await rateTopic({
        topicId: topicId as Id<"scholarTopics">,
        rating,
      });
    } catch (error) {
      console.error("Error rating topic:", error);
    }
  };

  // Add a suggested topic
  const handleAddSuggestion = async () => {
    if (!newSuggestion.topic.trim()) return;

    setIsAddingSuggestion(true);
    try {
      await addSuggestion({
        scholarId: scholarId as Id<"users">,
        topic: newSuggestion.topic,
        ...(newSuggestion.rationale.trim() ? { rationale: newSuggestion.rationale } : {}),
        ...(newSuggestion.targetBloomLevel ? { targetBloomLevel: newSuggestion.targetBloomLevel as "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create" } : {}),
      });
      setNewSuggestion({ topic: "", rationale: "", targetBloomLevel: "apply" });
    } catch (error) {
      console.error("Error adding suggestion:", error);
    } finally {
      setIsAddingSuggestion(false);
    }
  };

  // Delete a suggested topic
  const handleDeleteSuggestion = async (suggestionId: string) => {
    try {
      await removeSuggestion({
        suggestionId: suggestionId as Id<"suggestedTopics">,
      });
    } catch (error) {
      console.error("Error deleting suggestion:", error);
    }
  };

  // Add an observation
  const handleAddObservation = async () => {
    if (!newObservation.note.trim()) return;
    setIsAddingObservation(true);
    try {
      await addObservation({
        scholarId: scholarId as Id<"users">,
        type: newObservation.type,
        note: newObservation.note,
      });
      setNewObservation({ type: "praise", note: "" });
    } catch (error) {
      console.error("Error adding observation:", error);
    } finally {
      setIsAddingObservation(false);
    }
  };

  // Delete an observation
  const handleDeleteObservation = async (observationId: string) => {
    try {
      await removeObservation({ observationId: observationId as Id<"observations"> });
    } catch (error) {
      console.error("Error deleting observation:", error);
    }
  };

  if (isLoading) {
    return (
      <Box
        w="full"
        bg="white"
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
    <Box w="full" bg="gray.50" h="full" display="flex" flexDir="column">
      {/* Compact header bar */}
      <Flex
        px={5}
        py={4}
        align="center"
        gap={6}
        flexWrap="wrap"
      >
        <HStack gap={3} minW="200px">
          <Avatar
            size="md"
            name={scholar?.name || "Scholar"}
            src={scholar?.image || undefined}
          />
          <VStack gap={0} align="start">
            <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="lg">
              {scholar?.name}
            </Text>
            <Text color="charcoal.400" fontSize="xs" fontFamily="heading">
              {scholar?.email}
            </Text>
          </VStack>
        </HStack>

        {/* Inline stats */}
        <HStack gap={5}>
          {[
            { value: stats.projectCount, label: "Projects" },
            { value: stats.messageCount, label: "Messages" },
            { value: stats.topicCount, label: "Topics" },
          ].map((stat) => (
            <HStack key={stat.label} gap={1}>
              <Text fontSize="lg" fontWeight="bold" fontFamily="heading" color="navy.500">
                {stat.value}
              </Text>
              <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                {stat.label}
              </Text>
            </HStack>
          ))}
        </HStack>

        <HStack ml="auto" gap={1}>
          <Button
            size="sm"
            variant="ghost"
            color="violet.500"
            fontFamily="heading"
            fontSize="xs"
            _hover={{ bg: "violet.50" }}
            onClick={async () => {
              try {
                const token = scholar?.guestToken
                  ?? await generateGuestToken({ scholarId: scholarId as Id<"users"> });
                const url = `${window.location.origin}/guest?token=${token}`;
                await navigator.clipboard.writeText(url);
                setGuestLinkCopied(true);
                setTimeout(() => setGuestLinkCopied(false), 2000);
              } catch (err) {
                console.error("Error generating guest link:", err);
              }
            }}
          >
            {guestLinkCopied ? (
              <><FiCheck style={{ marginRight: "4px" }} />Copied!</>
            ) : (
              <><FiLink style={{ marginRight: "4px" }} />Copy Guest Link</>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color="violet.500"
            fontFamily="heading"
            fontSize="xs"
            _hover={{ bg: "violet.50" }}
            onClick={() => window.open(`/scholar?remote=${scholarId}`, "_blank")}
          >
            <FiExternalLink style={{ marginRight: "4px" }} />
            Remote View
          </Button>
        </HStack>

      </Flex>

      {/* Tab bar */}
      <HStack px={5} gap={0} borderBottom="1px solid" borderColor="gray.200">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const TabIcon = tab.icon;
          return (
            <Button
              key={tab.key}
              variant="ghost"
              borderRadius={0}
              borderBottom="2px solid"
              borderColor={isActive ? "violet.500" : "transparent"}
              color={isActive ? "violet.600" : "charcoal.400"}
              fontFamily="heading"
              fontWeight={isActive ? "600" : "500"}
              fontSize="sm"
              px={4}
              py={3}
              h="auto"
              outline="none"
              boxShadow="none"
              _hover={{ color: "violet.500", bg: "violet.50" }}
              _focus={{ outline: "none", boxShadow: "none" }}
              _focusVisible={{ outline: "none", boxShadow: "none" }}
              onClick={() => setActiveTab(tab.key)}
            >
              <TabIcon style={{ marginRight: "6px" }} />
              {tab.label}
            </Button>
          );
        })}
      </HStack>

      {/* Tab content */}
      <Box flex={1} overflow="auto" p={5}>
        {activeTab === "dossier" && (
          <Box bg="white" borderRadius="lg" p={4} shadow="xs" maxW="700px">
            <HStack mb={2}>
              <FiUser color="#AD60BF" />
              <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                Scholar Dossier
              </Text>
            </HStack>
            <Textarea
              size="sm"
              placeholder="No dossier yet — the AI will build one during conversations."
              value={dossierDraft ?? dossierContent ?? ""}
              onChange={(e) => setDossierDraft(e.target.value)}
              onBlur={async () => {
                if (dossierDraft !== null && dossierDraft !== (dossierContent ?? "")) {
                  await updateDossier({
                    scholarId: scholarId as Id<"users">,
                    content: dossierDraft,
                  });
                }
                setDossierDraft(null);
              }}
              rows={12}
              bg="gray.50"
              fontFamily="body"
              fontSize="sm"
              lineHeight="1.5"
            />
            <Text fontSize="xs" color="charcoal.400" fontFamily="body" mt={1}>
              AI-maintained learning profile. You can also edit manually.
            </Text>
          </Box>
        )}

        {activeTab === "documents" && (
          <VStack gap={3} align="stretch" maxW="700px">
            {artifacts === undefined ? (
              <Flex justify="center" py={8}>
                <Spinner size="md" color="violet.500" />
              </Flex>
            ) : artifacts.length === 0 ? (
              <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={8}>
                No documents yet. Documents are created during projects.
              </Text>
            ) : (
              artifacts.map((artifact) => (
                <Box
                  key={artifact._id}
                  bg="white"
                  borderRadius="lg"
                  p={4}
                  shadow="xs"
                  borderLeft="3px solid"
                  borderColor={artifact.lastEditedBy === "scholar" ? "cyan.400" : "violet.400"}
                >
                  <HStack justify="space-between" align="start" mb={1}>
                    <Text fontFamily="heading" fontSize="sm" fontWeight="600" color="navy.500">
                      {artifact.title}
                    </Text>
                    <HStack gap={2}>
                      <Badge
                        bg={artifact.lastEditedBy === "scholar" ? "cyan.100" : "violet.100"}
                        color={artifact.lastEditedBy === "scholar" ? "cyan.700" : "violet.700"}
                        fontSize="xs"
                      >
                        {artifact.lastEditedBy === "scholar" ? <><FiEdit3 style={{ display: "inline", marginRight: "3px" }} />scholar</> : <><FiCpu style={{ display: "inline", marginRight: "3px" }} />ai</>}
                      </Badge>
                      <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                        {timeAgo(artifact._creationTime)}
                      </Text>
                    </HStack>
                  </HStack>
                  {artifact.content && (
                    <Text fontSize="sm" color="charcoal.500" fontFamily="body" lineHeight="1.4" mb={2} lineClamp={2}>
                      {artifact.content.slice(0, 150)}{artifact.content.length > 150 ? "..." : ""}
                    </Text>
                  )}
                  <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                    from:{" "}
                    <Text as="span" color="violet.500" cursor="pointer" _hover={{ textDecoration: "underline" }}>
                      {artifact.projectTitle}
                    </Text>
                  </Text>
                  {/* TODO: "independence %" — ratio of scholar vs ai edits */}
                </Box>
              ))
            )}
          </VStack>
        )}

        {activeTab === "topics" && (
          <VStack gap={5} align="stretch" maxW="700px">
            {/* Topics of Interest */}
            <Box bg="white" borderRadius="lg" p={4} shadow="xs">
              <HStack mb={3}>
                <FiBookOpen color="#AD60BF" />
                <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
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
                      borderRadius="md"
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

            {/* Suggested Follow-ups */}
            <Box bg="white" borderRadius="lg" p={4} shadow="xs">
              <HStack mb={3}>
                <FiTarget color="#AD60BF" />
                <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                  Suggested Follow-ups
                </Text>
              </HStack>

              {/* Add new suggestion */}
              <Box p={3} bg="violet.50" borderRadius="md" mb={3}>
                <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="violet.700" mb={2}>
                  Push {scholar?.name?.split(" ")[0]} intellectually:
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
                      borderRadius="md"
                      opacity={suggestion.explored ? 0.6 : 1}
                    >
                      <HStack justify="space-between" align="start">
                        <VStack gap={1} align="start" flex={1}>
                          <HStack flexWrap="wrap">
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
                          color="red.400"
                          _hover={{ bg: "red.50", color: "red.600" }}
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
        )}

        {activeTab === "observations" && (
          <Box bg="white" borderRadius="lg" p={4} shadow="xs" maxW="700px">
            <HStack mb={3}>
              <FiFileText color="#AD60BF" />
              <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                Observations
              </Text>
            </HStack>

            {/* Add new observation */}
            <Box p={3} bg="gray.50" borderRadius="md" mb={3}>
              <select
                value={newObservation.type}
                onChange={(e) => setNewObservation((prev) => ({ ...prev, type: e.target.value as typeof prev.type }))}
                style={{
                  padding: "5px 8px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  fontSize: "12px",
                  fontFamily: "inherit",
                  width: "140px",
                  marginBottom: "8px",
                }}
              >
                <option value="praise">Praise</option>
                <option value="concern">Concern</option>
                <option value="suggestion">Suggestion</option>
                <option value="intervention">Intervention</option>
              </select>
              <Textarea
                size="sm"
                placeholder="Record an observation..."
                value={newObservation.note}
                onChange={(e) => setNewObservation((prev) => ({ ...prev, note: e.target.value }))}
                rows={2}
                bg="white"
                fontFamily="body"
                mb={2}
              />
              <Flex justify="flex-end">
                <Button
                  size="sm"
                  bg="violet.500"
                  color="white"
                  _hover={{ bg: "violet.600" }}
                  fontFamily="heading"
                  onClick={handleAddObservation}
                  disabled={isAddingObservation || !newObservation.note.trim()}
                >
                  Save
                </Button>
              </Flex>
            </Box>

            {/* Existing observations */}
            {observations.length > 0 ? (
              <VStack gap={2} align="stretch">
                {observations.map((obs) => (
                  <Box
                    key={obs._id}
                    p={3}
                    bg="gray.50"
                    borderRadius="md"
                  >
                    <HStack justify="space-between" align="start">
                      <VStack gap={1} align="start" flex={1}>
                        <HStack>
                          <Badge
                            bg={
                              obs.type === "praise" ? "green.100" :
                              obs.type === "concern" ? "red.100" :
                              obs.type === "suggestion" ? "blue.100" :
                              "orange.100"
                            }
                            color={
                              obs.type === "praise" ? "green.700" :
                              obs.type === "concern" ? "red.700" :
                              obs.type === "suggestion" ? "blue.700" :
                              "orange.700"
                            }
                            fontSize="xs"
                          >
                            {obs.type}
                          </Badge>
                          <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                            {new Date(obs._creationTime).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </Text>
                        </HStack>
                        <Text fontSize="sm" color="charcoal.600" fontFamily="body" lineHeight="1.4">
                          {obs.note}
                        </Text>
                      </VStack>
                      <IconButton
                        aria-label="Delete"
                        size="xs"
                        variant="ghost"
                        color="red.400"
                        _hover={{ bg: "red.50", color: "red.600" }}
                        onClick={() => handleDeleteObservation(obs._id)}
                      >
                        <FiTrash2 />
                      </IconButton>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={2}>
                No observations yet.
              </Text>
            )}
          </Box>
        )}

        {activeTab === "reading" && (
          <Box bg="white" borderRadius="lg" p={4} shadow="xs" maxW="400px">
            <HStack mb={2}>
              <FiBookOpen color="#AD60BF" />
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
        )}
      </Box>
    </Box>
  );
}
