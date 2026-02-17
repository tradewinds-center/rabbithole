"use client";

import { useState, useMemo } from "react";
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
} from "@chakra-ui/react";
import { FiChevronDown, FiChevronRight, FiPlus, FiX } from "react-icons/fi";

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

// ─── Types ──────────────────────────────────────────────────────────

interface StandardsTabProps {
  scholarId: string;
  readingLevel?: string | null;
}

interface StandardNode {
  _id: Id<"standards">;
  asnId: string;
  notation?: string;
  description: string;
  gradeLevels: string[];
  subject: string;
  statementLabel: string;
  isLeaf: boolean;
  parentId?: Id<"standards">;
  documentId: Id<"standardsDocuments">;
}

// ─── Seed Action Form ───────────────────────────────────────────────

function SeedForm({
  node,
  scholarId,
  onClose,
}: {
  node: StandardNode;
  scholarId: string;
  onClose: () => void;
}) {
  const createSeed = useMutation(api.seeds.create);
  const [seedType, setSeedType] = useState<"assess" | "teach">("assess");
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const label = node.notation
    ? `${node.notation}: ${node.description}`
    : node.description;

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const isAssess = seedType === "assess";
      await createSeed({
        scholarId: scholarId as Id<"users">,
        topic: label,
        domain: node.subject,
        rationale: isAssess
          ? `Assess whether scholar can demonstrate: ${node.description}. Look for evidence without explicitly teaching.`
          : `Guide scholar toward mastery of: ${node.description}. Build understanding through exploration and practice.`,
        approachHint: isAssess
          ? "Weave a natural question or scenario into conversation that requires this skill. Observe without prompting."
          : "Find a natural entry point to explore this concept. Use concrete examples and build toward abstract understanding.",
      });
      setCreated(true);
      setTimeout(() => onClose(), 1200);
    } catch (error) {
      console.error("Error creating seed:", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (created) {
    return (
      <Box bg="green.50" borderRadius="md" p={3} mt={1} mb={2} ml={6}>
        <Text fontSize="sm" color="green.700" fontFamily="heading">
          Seed created — it will appear in the tutor&apos;s next conversation.
        </Text>
      </Box>
    );
  }

  return (
    <Box bg="violet.50" borderRadius="md" p={3} mt={1} mb={2} ml={6}>
      <Text fontSize="xs" fontWeight="600" color="navy.500" fontFamily="heading" mb={2}>
        {label}
      </Text>

      <VStack gap={2} align="stretch">
        {/* Assess option */}
        <HStack
          as="label"
          gap={2}
          cursor="pointer"
          p={2}
          borderRadius="md"
          bg={seedType === "assess" ? "white" : "transparent"}
          border="1px solid"
          borderColor={seedType === "assess" ? "violet.300" : "transparent"}
          onClick={() => setSeedType("assess")}
        >
          <Box
            w="14px"
            h="14px"
            borderRadius="full"
            border="2px solid"
            borderColor={seedType === "assess" ? "violet.500" : "charcoal.300"}
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            {seedType === "assess" && (
              <Box w="6px" h="6px" borderRadius="full" bg="violet.500" />
            )}
          </Box>
          <VStack gap={0} align="start">
            <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500">
              Assess
            </Text>
            <Text fontSize="xs" color="charcoal.400" fontFamily="body">
              Probe whether scholar can do this (doesn&apos;t teach, just surfaces what they know)
            </Text>
          </VStack>
        </HStack>

        {/* Teach option */}
        <HStack
          as="label"
          gap={2}
          cursor="pointer"
          p={2}
          borderRadius="md"
          bg={seedType === "teach" ? "white" : "transparent"}
          border="1px solid"
          borderColor={seedType === "teach" ? "violet.300" : "transparent"}
          onClick={() => setSeedType("teach")}
        >
          <Box
            w="14px"
            h="14px"
            borderRadius="full"
            border="2px solid"
            borderColor={seedType === "teach" ? "violet.500" : "charcoal.300"}
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            {seedType === "teach" && (
              <Box w="6px" h="6px" borderRadius="full" bg="violet.500" />
            )}
          </Box>
          <VStack gap={0} align="start">
            <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500">
              Teach
            </Text>
            <Text fontSize="xs" color="charcoal.400" fontFamily="body">
              Guide scholar toward mastery of this standard
            </Text>
          </VStack>
        </HStack>
      </VStack>

      <HStack gap={2} mt={3} justify="flex-end">
        <Button
          size="xs"
          variant="ghost"
          color="charcoal.400"
          fontFamily="heading"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          size="xs"
          bg="violet.500"
          color="white"
          fontFamily="heading"
          _hover={{ bg: "violet.600" }}
          onClick={handleCreate}
          disabled={isCreating}
        >
          {isCreating ? <Spinner size="xs" /> : "Create Seed"}
        </Button>
      </HStack>
    </Box>
  );
}

// ─── Recursive Tree Node ────────────────────────────────────────────

function StandardTreeNode({
  node,
  scholarId,
  expandedNodes,
  toggleExpanded,
  observationsByStandard,
  expandedLeaf,
  setExpandedLeaf,
  seedFormId,
  setSeedFormId,
}: {
  node: StandardNode;
  scholarId: string;
  expandedNodes: Set<string>;
  toggleExpanded: (id: string) => void;
  observationsByStandard: Map<string, any[]>;
  expandedLeaf: string | null;
  setExpandedLeaf: (id: string | null) => void;
  seedFormId: string | null;
  setSeedFormId: (id: string | null) => void;
}) {
  const isExpanded = expandedNodes.has(node._id);
  const children = useQuery(
    api.standardsTree.getChildren,
    isExpanded ? { parentId: node._id } : "skip"
  );
  const coverage = useQuery(
    api.standardsTree.getSubtreeCoverage,
    !node.isLeaf
      ? { standardId: node._id, scholarId: scholarId as Id<"users"> }
      : "skip"
  );

  const obs = observationsByStandard.get(node._id) ?? [];
  const bestObs = obs.length > 0
    ? obs.reduce((best, o) => (o.masteryLevel > best.masteryLevel ? o : best))
    : null;

  const isLeafExpanded = expandedLeaf === node._id;
  const isSeedOpen = seedFormId === node._id;

  if (node.isLeaf) {
    return (
      <Box>
        <HStack
          gap={2}
          py={1.5}
          px={2}
          mx={-2}
          borderRadius="md"
          cursor={bestObs ? "pointer" : "default"}
          _hover={{ bg: "gray.50" }}
          onClick={() => {
            if (bestObs) setExpandedLeaf(isLeafExpanded ? null : node._id);
          }}
          role="group"
        >
          <Text fontSize="sm" color="charcoal.300" flexShrink={0} w="14px" textAlign="center">
            {bestObs ? "\u25CF" : "\u25CB"}
          </Text>
          {node.notation && (
            <Badge
              bg="gray.100"
              color="charcoal.600"
              fontSize="xs"
              fontFamily="heading"
              flexShrink={0}
            >
              {node.notation}
            </Badge>
          )}
          <Text
            fontSize="sm"
            color={bestObs ? "charcoal.600" : "charcoal.400"}
            fontFamily="body"
            flex={1}
            lineHeight="1.3"
            lineClamp={2}
          >
            {node.description}
          </Text>
          {bestObs ? (
            <>
              <BloomBar level={bestObs.masteryLevel} />
              <Badge
                bg={`${bloomColor(bestObs.masteryLevel)}.100`}
                color={`${bloomColor(bestObs.masteryLevel)}.700`}
                fontSize="xs"
                flexShrink={0}
                minW="80px"
                textAlign="center"
              >
                {bloomLabel(bestObs.masteryLevel)} ({bestObs.masteryLevel.toFixed(1)})
              </Badge>
            </>
          ) : (
            <Text fontSize="xs" color="charcoal.300" fontFamily="heading" flexShrink={0}>
              no evidence
            </Text>
          )}
          {/* Seed action button */}
          <Box
            as="button"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setSeedFormId(isSeedOpen ? null : node._id);
            }}
            p={1}
            borderRadius="sm"
            color={isSeedOpen ? "violet.600" : "charcoal.300"}
            _hover={{ color: "violet.500", bg: "violet.50" }}
            _groupHover={{ opacity: 1 }}
            opacity={isSeedOpen ? 1 : 0.3}
            transition="opacity 0.15s"
            flexShrink={0}
          >
            {isSeedOpen ? <FiX size={14} /> : <FiPlus size={14} />}
          </Box>
        </HStack>

        {/* Seed creation form */}
        {isSeedOpen && (
          <SeedForm
            node={node}
            scholarId={scholarId}
            onClose={() => setSeedFormId(null)}
          />
        )}

        {/* Expanded inline detail for mapped leaves */}
        {isLeafExpanded && obs.length > 0 && (
          <Box bg="gray.50" borderRadius="md" p={3} ml={6} mt={1} mb={2}>
            <VStack gap={2} align="stretch">
              {obs.map((o: any) => (
                <Box key={o._id}>
                  <HStack gap={2} mb={1}>
                    <Badge
                      bg={`${bloomColor(o.masteryLevel)}.100`}
                      color={`${bloomColor(o.masteryLevel)}.700`}
                      fontSize="xs"
                    >
                      {bloomLabel(o.masteryLevel)} ({o.masteryLevel.toFixed(1)})
                    </Badge>
                    <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                      {timeAgo(o.observedAt)}
                    </Text>
                    <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                      conf {(o.confidenceScore * 100).toFixed(0)}%
                    </Text>
                  </HStack>
                  <Text fontSize="sm" color="charcoal.600" fontFamily="body" lineHeight="1.4" mb={1}>
                    {o.evidenceSummary}
                  </Text>
                  {o.transcriptExcerpt && (
                    <Box bg="white" borderLeft="2px solid" borderColor="violet.200" pl={3} py={2} borderRadius="sm">
                      <Text fontSize="xs" color="charcoal.500" fontFamily="body" lineHeight="1.4" whiteSpace="pre-wrap">
                        {o.transcriptExcerpt}
                      </Text>
                    </Box>
                  )}
                </Box>
              ))}
            </VStack>
          </Box>
        )}
      </Box>
    );
  }

  // Folder node — compact display with assessed/total pill
  return (
    <Box>
      <HStack
        gap={2}
        py={2}
        px={2}
        mx={-2}
        cursor="pointer"
        borderRadius="md"
        _hover={{ bg: "gray.50" }}
        onClick={() => toggleExpanded(node._id)}
      >
        {isExpanded ? (
          <FiChevronDown color="#666" style={{ flexShrink: 0 }} />
        ) : (
          <FiChevronRight color="#666" style={{ flexShrink: 0 }} />
        )}
        {node.notation && (
          <Badge
            bg="violet.50"
            color="violet.700"
            fontSize="xs"
            fontFamily="heading"
            flexShrink={0}
          >
            {node.notation}
          </Badge>
        )}
        <Text
          fontSize="sm"
          fontWeight="600"
          color="navy.500"
          fontFamily="heading"
          flex={1}
          lineHeight="1.3"
          lineClamp={1}
        >
          {node.description}
        </Text>
        {coverage && (
          <Badge
            bg={coverage.assessed > 0 ? "green.100" : "gray.100"}
            color={coverage.assessed > 0 ? "green.700" : "charcoal.400"}
            fontSize="xs"
            fontFamily="heading"
            flexShrink={0}
          >
            {coverage.assessed}/{coverage.total}
          </Badge>
        )}
      </HStack>

      {isExpanded && (
        <Box pl={5} borderLeft="1px solid" borderColor="gray.200" ml={2}>
          {children === undefined ? (
            <Flex py={2} pl={2}>
              <Spinner size="xs" color="violet.400" />
            </Flex>
          ) : children.length === 0 ? (
            <Text fontSize="xs" color="charcoal.300" fontFamily="heading" pl={2} py={1}>
              No child standards
            </Text>
          ) : (
            children.map((child: StandardNode) => (
              <StandardTreeNode
                key={child._id}
                node={child}
                scholarId={scholarId}
                expandedNodes={expandedNodes}
                toggleExpanded={toggleExpanded}
                observationsByStandard={observationsByStandard}
                expandedLeaf={expandedLeaf}
                setExpandedLeaf={setExpandedLeaf}
                seedFormId={seedFormId}
                setSeedFormId={setSeedFormId}
              />
            ))
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── Evidence-Only View ─────────────────────────────────────────────

function EvidenceOnlyView({
  observationsByStandard,
  scholarId,
}: {
  observationsByStandard: Map<string, any[]>;
  scholarId: string;
}) {
  if (observationsByStandard.size === 0) {
    return (
      <Box bg="white" borderRadius="lg" shadow="xs" p={6} textAlign="center">
        <Text fontSize="sm" color="charcoal.400" fontFamily="body" lineHeight="1.5">
          No standards-linked evidence yet. As the scholar works with the AI tutor,
          observations will automatically map to curriculum standards.
        </Text>
      </Box>
    );
  }

  // Group observations by their standard IDs and show each
  const entries = Array.from(observationsByStandard.entries());

  return (
    <Box bg="white" borderRadius="lg" shadow="xs" p={4}>
      <VStack gap={2} align="stretch">
        {entries.map(([standardId, obs]) => {
          const bestObs = obs.reduce((best, o) =>
            o.masteryLevel > best.masteryLevel ? o : best
          );
          return (
            <Box key={standardId} py={2} borderBottom="1px solid" borderColor="gray.100" _last={{ borderBottom: "none" }}>
              <HStack gap={2} mb={1}>
                <BloomBar level={bestObs.masteryLevel} />
                <Badge
                  bg={`${bloomColor(bestObs.masteryLevel)}.100`}
                  color={`${bloomColor(bestObs.masteryLevel)}.700`}
                  fontSize="xs"
                >
                  {bloomLabel(bestObs.masteryLevel)} ({bestObs.masteryLevel.toFixed(1)})
                </Badge>
                <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                  {obs.length} observation{obs.length !== 1 ? "s" : ""}
                </Text>
              </HStack>
              <Text fontSize="sm" color="charcoal.600" fontFamily="body" lineHeight="1.4">
                {bestObs.conceptLabel}
              </Text>
              {bestObs.evidenceSummary && (
                <Text fontSize="xs" color="charcoal.400" fontFamily="body" mt={1} lineHeight="1.3">
                  {bestObs.evidenceSummary}
                </Text>
              )}
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}

// ─── Root-level tree loader (grade-filtered) ────────────────────────

function StandardsTreeRoot({
  documentId,
  grade,
  scholarId,
  expandedNodes,
  toggleExpanded,
  observationsByStandard,
  expandedLeaf,
  setExpandedLeaf,
  seedFormId,
  setSeedFormId,
}: {
  documentId: Id<"standardsDocuments">;
  grade: string;
  scholarId: string;
  expandedNodes: Set<string>;
  toggleExpanded: (id: string) => void;
  observationsByStandard: Map<string, any[]>;
  expandedLeaf: string | null;
  setExpandedLeaf: (id: string | null) => void;
  seedFormId: string | null;
  setSeedFormId: (id: string | null) => void;
}) {
  const roots = useQuery(api.standardsTree.getRootsByGrade, { documentId, grade });
  const summary = useQuery(api.standardsTree.gradeSummary, {
    documentId,
    grade,
    scholarId: scholarId as Id<"users">,
  });

  if (roots === undefined) {
    return (
      <Flex justify="center" py={4}>
        <Spinner size="sm" color="violet.500" />
      </Flex>
    );
  }

  if (roots.length === 0) {
    return (
      <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={4}>
        No standards found for this grade.
      </Text>
    );
  }

  return (
    <VStack gap={3} align="stretch">
      {/* Summary bar */}
      {summary && (
        <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
          {summary.assessedLeaves} of {summary.totalLeaves} standards assessed
        </Text>
      )}

      <Box bg="white" borderRadius="lg" shadow="xs" p={4}>
        <VStack gap={0} align="stretch">
          {roots.map((node: StandardNode) => (
            <StandardTreeNode
              key={node._id}
              node={node}
              scholarId={scholarId}
              expandedNodes={expandedNodes}
              toggleExpanded={toggleExpanded}
              observationsByStandard={observationsByStandard}
              expandedLeaf={expandedLeaf}
              setExpandedLeaf={setExpandedLeaf}
              seedFormId={seedFormId}
              setSeedFormId={setSeedFormId}
            />
          ))}
        </VStack>
      </Box>
    </VStack>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function StandardsTab({ scholarId, readingLevel }: StandardsTabProps) {
  const documents = useQuery(api.standardsTree.listDocuments);
  const linkedObs = useQuery(api.masteryObservations.withStandardsByScholar, {
    scholarId: scholarId as Id<"users">,
  });

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedLeaf, setExpandedLeaf] = useState<string | null>(null);
  const [seedFormId, setSeedFormId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"all" | "evidence">("evidence");

  // Build observation lookup: standardId → observations[]
  const observationsByStandard = useMemo(() => {
    const map = new Map<string, any[]>();
    if (!linkedObs) return map;

    for (const obs of linkedObs) {
      if (obs.standardIds) {
        for (const sid of obs.standardIds) {
          if (!map.has(sid)) map.set(sid, []);
          map.get(sid)!.push(obs);
        }
      }
    }
    return map;
  }, [linkedObs]);

  const toggleExpanded = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (documents === undefined) {
    return (
      <Flex justify="center" py={8}>
        <Spinner size="md" color="violet.500" />
      </Flex>
    );
  }

  if (documents.length === 0) {
    return (
      <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={8}>
        No standards imported yet. Run the import commands to load curriculum standards.
      </Text>
    );
  }

  // Auto-select first subject
  const activeSubject = selectedSubject ?? documents[0]?.subject;
  const activeDoc = documents.find((d) => d.subject === activeSubject);
  const grades = activeDoc?.grades ?? [];

  // Default grade: scholar's readingLevel if it exists in grades, else first grade
  const activeGrade = selectedGrade && grades.includes(selectedGrade)
    ? selectedGrade
    : readingLevel && grades.includes(readingLevel)
      ? readingLevel
      : grades[0] ?? "K";

  return (
    <VStack gap={3} align="stretch" maxW="900px">
      {/* Subject tabs */}
      <HStack gap={1} flexWrap="wrap">
        {documents.map((doc) => {
          const isActive = doc.subject === activeSubject;
          return (
            <Button
              key={doc._id}
              size="sm"
              variant={isActive ? "solid" : "ghost"}
              bg={isActive ? "violet.500" : undefined}
              color={isActive ? "white" : "charcoal.500"}
              fontFamily="heading"
              fontSize="sm"
              _hover={isActive ? { bg: "violet.600" } : { bg: "violet.50", color: "violet.600" }}
              onClick={() => {
                setSelectedSubject(doc.subject);
                setSelectedGrade(null);
                setExpandedNodes(new Set());
                setExpandedLeaf(null);
                setSeedFormId(null);
              }}
            >
              {doc.subject}
            </Button>
          );
        })}
      </HStack>

      {/* Grade pills */}
      {grades.length > 0 && (
        <HStack gap={1} flexWrap="wrap">
          <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mr={1}>
            Grade:
          </Text>
          {grades.map((g) => {
            const isActive = g === activeGrade;
            return (
              <Button
                key={g}
                size="xs"
                variant={isActive ? "solid" : "outline"}
                bg={isActive ? "navy.500" : undefined}
                color={isActive ? "white" : "charcoal.500"}
                borderColor={isActive ? "navy.500" : "gray.300"}
                fontFamily="heading"
                fontSize="xs"
                minW="32px"
                h="26px"
                _hover={isActive ? { bg: "navy.600" } : { bg: "gray.100" }}
                onClick={() => {
                  setSelectedGrade(g);
                  setExpandedNodes(new Set());
                  setExpandedLeaf(null);
                  setSeedFormId(null);
                }}
              >
                {g}
              </Button>
            );
          })}
        </HStack>
      )}

      {/* View toggle + doc info */}
      <HStack justify="space-between" align="center">
        <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
          {activeDoc?.title}
        </Text>
        <HStack gap={0} bg="gray.100" borderRadius="md" p={0.5}>
          <Button
            size="xs"
            variant="ghost"
            bg={viewMode === "all" ? "white" : "transparent"}
            color={viewMode === "all" ? "navy.500" : "charcoal.400"}
            fontFamily="heading"
            fontSize="xs"
            shadow={viewMode === "all" ? "xs" : "none"}
            borderRadius="sm"
            _hover={{ color: "navy.500" }}
            onClick={() => setViewMode("all")}
          >
            All Standards
          </Button>
          <Button
            size="xs"
            variant="ghost"
            bg={viewMode === "evidence" ? "white" : "transparent"}
            color={viewMode === "evidence" ? "navy.500" : "charcoal.400"}
            fontFamily="heading"
            fontSize="xs"
            shadow={viewMode === "evidence" ? "xs" : "none"}
            borderRadius="sm"
            _hover={{ color: "navy.500" }}
            onClick={() => setViewMode("evidence")}
          >
            With Evidence
          </Button>
        </HStack>
      </HStack>

      {/* Content */}
      {viewMode === "evidence" ? (
        <EvidenceOnlyView
          observationsByStandard={observationsByStandard}
          scholarId={scholarId}
        />
      ) : (
        activeDoc && (
          <StandardsTreeRoot
            documentId={activeDoc._id}
            grade={activeGrade}
            scholarId={scholarId}
            expandedNodes={expandedNodes}
            toggleExpanded={toggleExpanded}
            observationsByStandard={observationsByStandard}
            expandedLeaf={expandedLeaf}
            setExpandedLeaf={setExpandedLeaf}
            seedFormId={seedFormId}
            setSeedFormId={setSeedFormId}
          />
        )
      )}
    </VStack>
  );
}
