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
  Badge,
  Spinner,
  Button,
  Textarea,
} from "@chakra-ui/react";
import { FiChevronDown, FiChevronRight, FiEdit3, FiX } from "react-icons/fi";

interface MasteryTabProps {
  scholarId: string;
}

// ─── Bloom's helpers ────────────────────────────────────────────────

function bloomLabel(level: number): string {
  if (level >= 4.5) return "Create";
  if (level >= 3.5) return "Evaluate";
  if (level >= 2.5) return "Analyze";
  if (level >= 1.5) return "Apply";
  if (level >= 0.5) return "Understand";
  return "Remember";
}

function bloomColor(level: number): string {
  if (level >= 4.5) return "purple";
  if (level >= 3.5) return "violet";
  if (level >= 2.5) return "teal";
  if (level >= 1.5) return "cyan";
  if (level >= 0.5) return "blue";
  return "gray";
}

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

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

function isStale(timestamp: number): boolean {
  return Date.now() - timestamp > SIX_MONTHS_MS;
}

// ─── Concept Detail Panel (inline expand) ───────────────────────────

function ConceptDetail({
  scholarId,
  conceptLabel,
  onClose,
}: {
  scholarId: string;
  conceptLabel: string;
  onClose: () => void;
}) {
  const detail = useQuery(api.masteryObservations.inspectConcept, {
    scholarId: scholarId as Id<"users">,
    conceptLabel,
  });
  const setOverride = useMutation(api.teacherMasteryOverrides.setOverride);
  const removeOverride = useMutation(api.teacherMasteryOverrides.removeOverride);

  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState("");
  const [overrideNotes, setOverrideNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!detail) {
    return (
      <Flex py={4} justify="center">
        <Spinner size="sm" color="violet.500" />
      </Flex>
    );
  }

  const { observations, teacherOverride } = detail;
  const current = observations.find((o: any) => !o.isSuperseded);

  const handleSaveOverride = async () => {
    if (!current || !overrideLevel) return;
    setIsSaving(true);
    try {
      await setOverride({
        observationId: current._id as Id<"masteryObservations">,
        masteryLevel: parseFloat(overrideLevel),
        notes: overrideNotes,
      });
      setOverrideMode(false);
    } catch (err) {
      console.error("Error saving override:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveOverride = async () => {
    if (!current) return;
    try {
      await removeOverride({
        observationId: current._id as Id<"masteryObservations">,
      });
    } catch (err) {
      console.error("Error removing override:", err);
    }
  };

  return (
    <Box bg="gray.50" borderRadius="md" p={4} mt={2} mb={1}>
      {/* Header */}
      <HStack justify="space-between" mb={3}>
        <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
          {conceptLabel}
        </Text>
        <Button
          size="xs"
          variant="ghost"
          color="charcoal.400"
          onClick={onClose}
          _hover={{ color: "charcoal.600" }}
        >
          <FiX />
        </Button>
      </HStack>

      {/* Current assessment */}
      {current && (
        <Box mb={3}>
          <HStack gap={2} mb={2}>
            <Badge
              bg={`${bloomColor(teacherOverride ? teacherOverride.masteryLevel : current.masteryLevel)}.100`}
              color={`${bloomColor(teacherOverride ? teacherOverride.masteryLevel : current.masteryLevel)}.700`}
              fontSize="xs"
            >
              {bloomLabel(teacherOverride ? teacherOverride.masteryLevel : current.masteryLevel)}{" "}
              ({(teacherOverride ? teacherOverride.masteryLevel : current.masteryLevel).toFixed(1)})
            </Badge>
            <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
              conf {(current.confidenceScore * 100).toFixed(0)}%
            </Text>
            <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
              {timeAgo(current.observedAt)}
            </Text>
            {current.studentInitiated && (
              <Badge bg="teal.50" color="teal.600" fontSize="xs">student-initiated</Badge>
            )}
          </HStack>

          {/* Evidence summary */}
          <Text fontSize="sm" color="charcoal.600" fontFamily="body" lineHeight="1.5" mb={2}>
            {current.evidenceSummary}
          </Text>

          {/* Transcript excerpt */}
          {current.transcriptExcerpt && (
            <Box bg="white" borderLeft="2px solid" borderColor="violet.200" pl={3} py={2} borderRadius="sm" mb={2}>
              <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mb={1}>
                Transcript
              </Text>
              <Text fontSize="xs" color="charcoal.500" fontFamily="body" lineHeight="1.4" whiteSpace="pre-wrap">
                {current.transcriptExcerpt}
              </Text>
            </Box>
          )}

          {/* Teacher override display */}
          {teacherOverride && (
            <Box bg="orange.50" borderRadius="md" p={2} mb={2}>
              <HStack justify="space-between">
                <HStack gap={2}>
                  <Text fontSize="xs" fontWeight="600" color="orange.700" fontFamily="heading">
                    Teacher override: {bloomLabel(teacherOverride.masteryLevel)} ({teacherOverride.masteryLevel.toFixed(1)})
                  </Text>
                </HStack>
                <Button
                  size="xs"
                  variant="ghost"
                  color="orange.600"
                  _hover={{ bg: "orange.100" }}
                  onClick={handleRemoveOverride}
                >
                  Remove
                </Button>
              </HStack>
              {teacherOverride.notes && (
                <Text fontSize="xs" color="orange.600" fontFamily="body" mt={1}>
                  {teacherOverride.notes}
                </Text>
              )}
            </Box>
          )}

          {/* Override action */}
          {!overrideMode ? (
            <Button
              size="xs"
              variant="ghost"
              color="charcoal.400"
              fontFamily="heading"
              _hover={{ color: "violet.500", bg: "violet.50" }}
              onClick={() => {
                setOverrideLevel(
                  (teacherOverride ? teacherOverride.masteryLevel : current.masteryLevel).toFixed(1)
                );
                setOverrideNotes(teacherOverride?.notes ?? "");
                setOverrideMode(true);
              }}
            >
              <FiEdit3 style={{ marginRight: "4px" }} />
              {teacherOverride ? "Edit override" : "Override level"}
            </Button>
          ) : (
            <Box bg="white" borderRadius="md" p={3} border="1px solid" borderColor="violet.200">
              <HStack gap={2} mb={2}>
                <Text fontSize="xs" fontFamily="heading" color="charcoal.500" flexShrink={0}>
                  Level:
                </Text>
                <select
                  value={overrideLevel}
                  onChange={(e) => setOverrideLevel(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                    fontFamily: "inherit",
                    width: "180px",
                  }}
                >
                  <option value="0">0 - No Evidence</option>
                  <option value="1">1 - Remember</option>
                  <option value="1.5">1.5</option>
                  <option value="2">2 - Understand</option>
                  <option value="2.5">2.5</option>
                  <option value="3">3 - Apply</option>
                  <option value="3.5">3.5</option>
                  <option value="4">4 - Analyze</option>
                  <option value="4.5">4.5</option>
                  <option value="5">5 - Create</option>
                </select>
              </HStack>
              <Textarea
                size="sm"
                placeholder="Why do you disagree?"
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                rows={2}
                bg="gray.50"
                fontFamily="body"
                fontSize="xs"
                mb={2}
              />
              <HStack gap={2}>
                <Button
                  size="xs"
                  bg="violet.500"
                  color="white"
                  _hover={{ bg: "violet.600" }}
                  fontFamily="heading"
                  onClick={handleSaveOverride}
                  disabled={isSaving || !overrideLevel}
                >
                  Save
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  fontFamily="heading"
                  onClick={() => setOverrideMode(false)}
                >
                  Cancel
                </Button>
              </HStack>
            </Box>
          )}
        </Box>
      )}

      {/* Observation history (if multiple versions) */}
      {observations.length > 1 && (
        <Box mt={2} pt={2} borderTop="1px solid" borderColor="gray.200">
          <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="charcoal.400" mb={2}>
            History ({observations.length} observations)
          </Text>
          <VStack gap={1} align="stretch">
            {observations.map((o: any) => (
              <HStack
                key={o._id}
                gap={2}
                opacity={o.isSuperseded ? 0.5 : 1}
                py={1}
              >
                <Badge
                  bg={`${bloomColor(o.masteryLevel)}.100`}
                  color={`${bloomColor(o.masteryLevel)}.700`}
                  fontSize="2xs"
                >
                  {bloomLabel(o.masteryLevel)} ({o.masteryLevel.toFixed(1)})
                </Badge>
                <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                  {timeAgo(o.observedAt)}
                </Text>
                <Text fontSize="xs" color="charcoal.400" fontFamily="body" truncate flex={1}>
                  {o.evidenceSummary}
                </Text>
                {o.isSuperseded && (
                  <Badge bg="gray.100" color="gray.500" fontSize="2xs">superseded</Badge>
                )}
              </HStack>
            ))}
          </VStack>
        </Box>
      )}
    </Box>
  );
}

// ─── Bloom's Bar ────────────────────────────────────────────────────

function BloomBar({ level, maxLevel = 5 }: { level: number; maxLevel?: number }) {
  const pct = Math.min((level / maxLevel) * 100, 100);
  const color = bloomColor(level);
  return (
    <Box w="60px" h="6px" bg="gray.100" borderRadius="full" overflow="hidden" flexShrink={0}>
      <Box h="full" w={`${pct}%`} bg={`${color}.400`} borderRadius="full" />
    </Box>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function MasteryTab({ scholarId }: MasteryTabProps) {
  const masteryByDomain = useQuery(api.masteryObservations.byScholarDomain, {
    scholarId: scholarId as Id<"users">,
  });

  const [expandedConcept, setExpandedConcept] = useState<string | null>(null);
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());

  const toggleDomain = (domain: string) => {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  if (masteryByDomain === undefined) {
    return (
      <Flex justify="center" py={8}>
        <Spinner size="md" color="violet.500" />
      </Flex>
    );
  }

  if (Object.keys(masteryByDomain).length === 0) {
    return (
      <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={8}>
        No mastery observations yet. These appear as the scholar chats with the AI tutor.
      </Text>
    );
  }

  const sortedDomains = Object.entries(masteryByDomain).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <VStack gap={3} align="stretch" maxW="900px">
      {sortedDomains.map(([domain, obs]) => {
        const observations = (obs as any[]).sort(
          (a: any, b: any) => b.masteryLevel - a.masteryLevel
        );
        const isCollapsed = collapsedDomains.has(domain);

        return (
          <Box key={domain} bg="white" borderRadius="lg" shadow="xs" overflow="hidden">
            {/* Domain header */}
            <HStack
              px={4}
              py={3}
              cursor="pointer"
              _hover={{ bg: "gray.50" }}
              onClick={() => toggleDomain(domain)}
              justify="space-between"
            >
              <HStack gap={2}>
                {isCollapsed ? (
                  <FiChevronRight color="#666" />
                ) : (
                  <FiChevronDown color="#666" />
                )}
                <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                  {domain}
                </Text>
              </HStack>
              <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                {observations.length} concept{observations.length !== 1 ? "s" : ""}
              </Text>
            </HStack>

            {/* Concepts list */}
            {!isCollapsed && (
              <VStack gap={0} align="stretch" px={4} pb={3}>
                {observations.map((o: any) => {
                  const isExpanded = expandedConcept === o.conceptLabel;
                  const stale = isStale(o.observedAt);
                  return (
                    <Box key={o._id}>
                      <HStack
                        gap={3}
                        py={2}
                        cursor="pointer"
                        _hover={{ bg: "gray.50" }}
                        borderRadius="md"
                        px={2}
                        mx={-2}
                        opacity={stale ? 0.55 : 1}
                        onClick={() =>
                          setExpandedConcept(isExpanded ? null : o.conceptLabel)
                        }
                      >
                        <Text
                          fontSize="sm"
                          color={o.studentInitiated ? "teal.600" : "charcoal.600"}
                          fontWeight="500"
                          fontFamily="heading"
                          flex={1}
                          minW={0}
                        >
                          {o.studentInitiated ? "★" : "◆"} {o.conceptLabel}
                        </Text>
                        <BloomBar level={o.masteryLevel} />
                        <Badge
                          bg={`${bloomColor(o.masteryLevel)}.100`}
                          color={`${bloomColor(o.masteryLevel)}.700`}
                          fontSize="xs"
                          flexShrink={0}
                          minW="90px"
                          textAlign="center"
                        >
                          {bloomLabel(o.masteryLevel)} ({o.masteryLevel.toFixed(1)})
                        </Badge>
                        {stale && (
                          <Badge bg="gray.100" color="gray.500" fontSize="2xs" flexShrink={0}>
                            stale
                          </Badge>
                        )}
                        <Text
                          fontSize="xs"
                          color="charcoal.400"
                          fontFamily="heading"
                          flexShrink={0}
                          w="40px"
                          textAlign="right"
                        >
                          {(o.confidenceScore * 100).toFixed(0)}%
                        </Text>
                      </HStack>

                      {/* Expanded detail panel */}
                      {isExpanded && (
                        <ConceptDetail
                          scholarId={scholarId}
                          conceptLabel={o.conceptLabel}
                          onClose={() => setExpandedConcept(null)}
                        />
                      )}
                    </Box>
                  );
                })}
              </VStack>
            )}
          </Box>
        );
      })}
    </VStack>
  );
}
