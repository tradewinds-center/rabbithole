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
  Dialog,
  Portal,
} from "@chakra-ui/react";
import {
  FiCheckCircle,
  FiPlusCircle,
  FiEdit3,
  FiChevronDown,
  FiChevronRight,
  FiAlertTriangle,
} from "react-icons/fi";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { StyledDialogContent } from "@/components/ui/StyledDialogContent";

/**
 * Proposal diff / approval UI.
 *
 * Given a cached proposal JSON (from api.scholarDocumentProposals.getLatestProposal),
 * render each proposed directive and seed as an individually-approvable row.
 * The teacher ticks/un-ticks, clicks Approve, and we call applyProposal with
 * the approved subset. unitSuggestion is read-only — Phase 2 doesn't wire
 * unit creation through the approval flow.
 */

type ProposalShape = {
  rationale: string;
  directives: Array<{
    action: "create" | "update";
    label: string;
    content: string;
    reason: string;
  }>;
  seeds: Array<{
    topic: string;
    domain: string;
    rationale: string;
    approachHint: string | null;
  }>;
  unitSuggestion:
    | null
    | {
        title: string;
        bigIdea: string;
        essentialQuestions: string[];
        rationale: string;
      };
};

interface ProposalDiffModalProps {
  documentId: Id<"scholarDocuments">;
  scholarId: Id<"users">;
  proposal: ProposalShape;
  appliedAt: number | null;
  rejectedAt: number | null;
  onClose: () => void;
}

// ─── Directive row ──────────────────────────────────────────────────

function DirectiveRow({
  proposed,
  existingContent,
  checked,
  disabled,
  onToggle,
}: {
  proposed: ProposalShape["directives"][number];
  existingContent: string | null;
  checked: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isUpdate = proposed.action === "update" && existingContent !== null;

  return (
    <Box
      bg="white"
      borderRadius="md"
      p={3}
      borderLeft="3px solid"
      borderColor={checked ? "violet.400" : "gray.200"}
      opacity={disabled ? 0.6 : 1}
    >
      <HStack justify="space-between" align="start" mb={2} gap={2}>
        <HStack gap={2} flex={1} minW={0}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onToggle(e.target.checked)}
            disabled={disabled}
            style={{ marginTop: "3px", cursor: disabled ? "not-allowed" : "pointer" }}
            aria-label={`Approve directive ${proposed.label}`}
          />
          <VStack align="start" gap={1} flex={1}>
            <HStack gap={2}>
              <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                {proposed.label}
              </Text>
              {isUpdate ? (
                <Badge bg="orange.100" color="orange.700" fontSize="2xs" fontFamily="heading">
                  <FiEdit3 style={{ display: "inline", marginRight: "2px" }} /> Update
                </Badge>
              ) : (
                <Badge bg="green.100" color="green.700" fontSize="2xs" fontFamily="heading">
                  <FiPlusCircle style={{ display: "inline", marginRight: "2px" }} /> Create
                </Badge>
              )}
            </HStack>
            <Text fontSize="xs" color="charcoal.500" fontStyle="italic" fontFamily="body">
              {proposed.reason}
            </Text>
          </VStack>
        </HStack>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <FiChevronDown /> : <FiChevronRight />}
        </Button>
      </HStack>

      {expanded && (
        <Box mt={2} pl={6}>
          {isUpdate ? (
            <Box borderRadius="md" overflow="hidden" fontSize="12px">
              <ReactDiffViewer
                oldValue={existingContent ?? ""}
                newValue={proposed.content}
                splitView={false}
                compareMethod={DiffMethod.WORDS}
                hideLineNumbers
                styles={{
                  variables: {
                    light: {
                      diffViewerBackground: "#f9fafb",
                      diffViewerColor: "#2d3748",
                      addedBackground: "#e6ffed",
                      addedColor: "#22543d",
                      removedBackground: "#ffeef0",
                      removedColor: "#822727",
                      wordAddedBackground: "#acf2bd",
                      wordRemovedBackground: "#fdb8c0",
                    },
                  },
                  contentText: {
                    fontFamily: "monospace",
                    fontSize: "12px",
                  },
                }}
              />
            </Box>
          ) : (
            <Box bg="gray.50" borderRadius="md" p={2}>
              <Text
                fontSize="sm"
                color="charcoal.600"
                fontFamily="body"
                lineHeight="1.5"
                whiteSpace="pre-wrap"
              >
                {proposed.content}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── Seed row ───────────────────────────────────────────────────────

function SeedRow({
  proposed,
  checked,
  disabled,
  onToggle,
}: {
  proposed: ProposalShape["seeds"][number];
  checked: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <Box
      bg="white"
      borderRadius="md"
      p={3}
      borderLeft="3px solid"
      borderColor={checked ? "green.400" : "gray.200"}
      opacity={disabled ? 0.6 : 1}
    >
      <HStack align="start" gap={2}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={disabled}
          style={{ marginTop: "3px", cursor: disabled ? "not-allowed" : "pointer" }}
          aria-label={`Approve seed ${proposed.topic}`}
        />
        <VStack align="start" gap={1} flex={1} minW={0}>
          <HStack gap={2} wrap="wrap">
            <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
              {proposed.topic}
            </Text>
            {proposed.domain && (
              <Badge bg="cyan.100" color="cyan.700" fontSize="2xs" fontFamily="heading">
                {proposed.domain}
              </Badge>
            )}
          </HStack>
          <Text fontSize="xs" color="charcoal.500" fontFamily="body">
            <strong>Rationale:</strong> {proposed.rationale}
          </Text>
          {proposed.approachHint && (
            <Text fontSize="xs" color="charcoal.500" fontFamily="body">
              <strong>Approach:</strong> {proposed.approachHint}
            </Text>
          )}
        </VStack>
      </HStack>
    </Box>
  );
}

// ─── Main modal ─────────────────────────────────────────────────────

export function ProposalDiffModal({
  documentId,
  scholarId,
  proposal,
  appliedAt,
  rejectedAt,
  onClose,
}: ProposalDiffModalProps) {
  const existingDirectives = useQuery(api.teacherDirectives.listByScholar, {
    scholarId,
  });
  const applyProposal = useMutation(api.scholarDocumentProposals.applyProposal);
  const rejectProposal = useMutation(api.scholarDocumentProposals.rejectProposal);

  const alreadyActed = appliedAt !== null || rejectedAt !== null;

  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(
    () => new Set(proposal.directives.map((d) => d.label.trim().toLowerCase()))
  );
  const [selectedSeedIdx, setSelectedSeedIdx] = useState<Set<number>>(
    () => new Set(proposal.seeds.map((_, i) => i))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<null | {
    directivesApplied: number;
    seedsApplied: number;
    skippedUnit: boolean;
  }>(null);
  const [showDirectives, setShowDirectives] = useState(true);
  const [showSeeds, setShowSeeds] = useState(true);
  const [showUnit, setShowUnit] = useState(true);

  const existingByLabelLower = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of existingDirectives ?? []) {
      map.set(d.label.toLowerCase(), d.content);
    }
    return map;
  }, [existingDirectives]);

  const toggleLabel = (label: string, next: boolean) => {
    setSelectedLabels((prev) => {
      const s = new Set(prev);
      const key = label.trim().toLowerCase();
      if (next) s.add(key);
      else s.delete(key);
      return s;
    });
  };

  const toggleSeed = (idx: number, next: boolean) => {
    setSelectedSeedIdx((prev) => {
      const s = new Set(prev);
      if (next) s.add(idx);
      else s.delete(idx);
      return s;
    });
  };

  const handleApprove = async () => {
    setIsSaving(true);
    try {
      const approvedLabels = proposal.directives
        .map((d) => d.label)
        .filter((l) => selectedLabels.has(l.trim().toLowerCase()));
      const approvedSeedIndexes = Array.from(selectedSeedIdx);
      const res = await applyProposal({
        documentId,
        approvedDirectiveLabels: approvedLabels,
        approvedSeedIndexes,
      });
      setResult(res);
    } catch (err) {
      console.error("applyProposal failed:", err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    setIsSaving(true);
    try {
      await rejectProposal({ documentId });
      onClose();
    } catch (err) {
      console.error("rejectProposal failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const approvedCount =
    Array.from(selectedLabels).filter((key) =>
      proposal.directives.some((d) => d.label.trim().toLowerCase() === key)
    ).length + selectedSeedIdx.size;

  return (
    <Dialog.Root open={true} onOpenChange={(e) => !e.open && onClose()} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <StyledDialogContent maxW="4xl">
            <Dialog.Header px={6} pt={5} pb={2}>
              <Dialog.Title fontFamily="heading" fontSize="lg" color="navy.500">
                Proposed Changes for This Scholar
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body px={6} py={3} maxH="75vh" overflowY="auto">
              {result ? (
                <VStack gap={3} align="stretch" py={4}>
                  <HStack gap={2} color="green.600">
                    <FiCheckCircle size={20} />
                    <Text fontFamily="heading" fontSize="md" fontWeight="600">
                      Proposal applied
                    </Text>
                  </HStack>
                  <Text fontSize="sm" color="charcoal.600" fontFamily="body">
                    Applied {result.directivesApplied} directive
                    {result.directivesApplied === 1 ? "" : "s"} and {result.seedsApplied}{" "}
                    seed{result.seedsApplied === 1 ? "" : "s"}.
                    {result.skippedUnit && " Unit suggestion was not applied."}
                  </Text>
                </VStack>
              ) : (
                <VStack gap={4} align="stretch">
                  {alreadyActed && (
                    <Box bg="yellow.50" borderRadius="md" p={3} border="1px solid" borderColor="yellow.200">
                      <HStack gap={2} color="yellow.800">
                        <FiAlertTriangle />
                        <Text fontSize="sm" fontFamily="body">
                          {appliedAt != null
                            ? "This proposal has already been applied."
                            : "This proposal was rejected."}
                        </Text>
                      </HStack>
                    </Box>
                  )}

                  <Box bg="violet.50" borderRadius="md" p={3}>
                    <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="violet.700" mb={1}>
                      RATIONALE
                    </Text>
                    <Text fontSize="sm" color="charcoal.700" fontFamily="body" lineHeight="1.5">
                      {proposal.rationale}
                    </Text>
                  </Box>

                  {/* Directives */}
                  <Box>
                    <HStack
                      justify="space-between"
                      cursor="pointer"
                      onClick={() => setShowDirectives((v) => !v)}
                      mb={2}
                    >
                      <HStack gap={2}>
                        {showDirectives ? <FiChevronDown /> : <FiChevronRight />}
                        <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                          Directives ({proposal.directives.length})
                        </Text>
                      </HStack>
                    </HStack>
                    {showDirectives && (
                      <VStack gap={2} align="stretch">
                        {proposal.directives.length === 0 ? (
                          <Text fontSize="sm" color="charcoal.400" fontFamily="body">
                            No directives proposed.
                          </Text>
                        ) : existingDirectives === undefined ? (
                          <Spinner size="sm" color="violet.500" />
                        ) : (
                          proposal.directives.map((d, i) => (
                            <DirectiveRow
                              key={`${d.label}-${i}`}
                              proposed={d}
                              existingContent={
                                existingByLabelLower.get(d.label.toLowerCase()) ?? null
                              }
                              checked={selectedLabels.has(d.label.trim().toLowerCase())}
                              disabled={alreadyActed || isSaving}
                              onToggle={(next) => toggleLabel(d.label, next)}
                            />
                          ))
                        )}
                      </VStack>
                    )}
                  </Box>

                  {/* Seeds */}
                  <Box>
                    <HStack
                      justify="space-between"
                      cursor="pointer"
                      onClick={() => setShowSeeds((v) => !v)}
                      mb={2}
                    >
                      <HStack gap={2}>
                        {showSeeds ? <FiChevronDown /> : <FiChevronRight />}
                        <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                          Seeds ({proposal.seeds.length})
                        </Text>
                      </HStack>
                    </HStack>
                    {showSeeds && (
                      <VStack gap={2} align="stretch">
                        {proposal.seeds.length === 0 ? (
                          <Text fontSize="sm" color="charcoal.400" fontFamily="body">
                            No seeds proposed.
                          </Text>
                        ) : (
                          proposal.seeds.map((s, i) => (
                            <SeedRow
                              key={i}
                              proposed={s}
                              checked={selectedSeedIdx.has(i)}
                              disabled={alreadyActed || isSaving}
                              onToggle={(next) => toggleSeed(i, next)}
                            />
                          ))
                        )}
                      </VStack>
                    )}
                  </Box>

                  {/* Unit suggestion */}
                  {proposal.unitSuggestion && (
                    <Box>
                      <HStack
                        justify="space-between"
                        cursor="pointer"
                        onClick={() => setShowUnit((v) => !v)}
                        mb={2}
                      >
                        <HStack gap={2}>
                          {showUnit ? <FiChevronDown /> : <FiChevronRight />}
                          <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                            Unit suggestion (read-only)
                          </Text>
                        </HStack>
                      </HStack>
                      {showUnit && (
                        <Box bg="gray.50" borderRadius="md" p={3}>
                          <Text fontSize="xs" color="charcoal.400" fontStyle="italic" mb={2} fontFamily="body">
                            Unit creation isn't supported in the approval flow yet.
                            Copy this manually into the Curriculum tab if you want to build it.
                          </Text>
                          <VStack gap={2} align="start">
                            <Box>
                              <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="charcoal.500">
                                TITLE
                              </Text>
                              <Text fontSize="sm" color="charcoal.700" fontFamily="body">
                                {proposal.unitSuggestion.title}
                              </Text>
                            </Box>
                            <Box>
                              <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="charcoal.500">
                                BIG IDEA
                              </Text>
                              <Text fontSize="sm" color="charcoal.700" fontFamily="body">
                                {proposal.unitSuggestion.bigIdea}
                              </Text>
                            </Box>
                            <Box>
                              <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="charcoal.500">
                                ESSENTIAL QUESTIONS
                              </Text>
                              <VStack align="start" gap={1}>
                                {proposal.unitSuggestion.essentialQuestions.map((q, i) => (
                                  <Text key={i} fontSize="sm" color="charcoal.700" fontFamily="body">
                                    • {q}
                                  </Text>
                                ))}
                              </VStack>
                            </Box>
                            <Box>
                              <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="charcoal.500">
                                RATIONALE
                              </Text>
                              <Text fontSize="sm" color="charcoal.700" fontFamily="body">
                                {proposal.unitSuggestion.rationale}
                              </Text>
                            </Box>
                          </VStack>
                        </Box>
                      )}
                    </Box>
                  )}
                </VStack>
              )}
            </Dialog.Body>
            <Dialog.Footer px={6} pb={5} pt={2} gap={2}>
              {result ? (
                <Button
                  size="sm"
                  bg="violet.500"
                  color="white"
                  _hover={{ bg: "violet.600" }}
                  fontFamily="heading"
                  onClick={onClose}
                >
                  Close
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    fontFamily="heading"
                    onClick={onClose}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  {!alreadyActed && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        color="red.500"
                        borderColor="red.200"
                        _hover={{ bg: "red.50" }}
                        fontFamily="heading"
                        onClick={handleReject}
                        disabled={isSaving}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        bg="violet.500"
                        color="white"
                        _hover={{ bg: "violet.600" }}
                        fontFamily="heading"
                        onClick={handleApprove}
                        disabled={isSaving || approvedCount === 0}
                      >
                        {isSaving ? (
                          <>
                            <Spinner size="xs" mr={2} /> Applying...
                          </>
                        ) : (
                          `Approve selected (${approvedCount})`
                        )}
                      </Button>
                    </>
                  )}
                </>
              )}
            </Dialog.Footer>
          </StyledDialogContent>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
