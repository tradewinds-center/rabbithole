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
import { FiCheck, FiX, FiPlus } from "react-icons/fi";

interface SeedsTabProps {
  scholarId: string;
}

function bloomLabel(level: number): string {
  if (level >= 4.5) return "Create";
  if (level >= 3.5) return "Evaluate";
  if (level >= 2.5) return "Analyze";
  if (level >= 1.5) return "Apply";
  if (level >= 0.5) return "Understand";
  return "Remember";
}

// ─── Seed Card ──────────────────────────────────────────────────────

function SeedCard({
  seed,
  showActions,
}: {
  seed: any;
  showActions: "review" | "active" | "none";
}) {
  const reviewSeed = useMutation(api.seeds.review);
  const updateStatus = useMutation(api.seeds.updateStatus);
  const [isActing, setIsActing] = useState(false);

  const handleReview = async (action: "accept" | "dismiss") => {
    setIsActing(true);
    try {
      await reviewSeed({ id: seed._id, action });
    } catch (err) {
      console.error("Error reviewing seed:", err);
    } finally {
      setIsActing(false);
    }
  };

  const handleDismiss = async () => {
    setIsActing(true);
    try {
      await updateStatus({ id: seed._id, status: "dismissed" });
    } catch (err) {
      console.error("Error dismissing seed:", err);
    } finally {
      setIsActing(false);
    }
  };

  const typeColor =
    seed.suggestionType === "frontier"
      ? "cyan"
      : seed.suggestionType === "depth_probe"
        ? "violet"
        : "teal";

  const typeLabel =
    seed.suggestionType === "frontier"
      ? "Frontier"
      : seed.suggestionType === "depth_probe"
        ? "Depth Probe"
        : "Teacher";

  return (
    <Box
      bg="white"
      borderRadius="md"
      p={3}
      borderLeft="3px solid"
      borderColor={`${typeColor}.400`}
    >
      <HStack justify="space-between" align="start" mb={1}>
        <HStack gap={2} flex={1} minW={0}>
          <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
            {seed.topic}
          </Text>
        </HStack>
        <HStack gap={1} flexShrink={0}>
          <Badge bg={`${typeColor}.100`} color={`${typeColor}.700`} fontSize="2xs">
            {typeLabel}
          </Badge>
          {seed.domain && (
            <Badge bg="gray.100" color="gray.600" fontSize="2xs">
              {seed.domain}
            </Badge>
          )}
          {seed.origin === "ai" && (
            <Badge bg="blue.50" color="blue.600" fontSize="2xs">
              AI
            </Badge>
          )}
        </HStack>
      </HStack>

      <Text fontSize="xs" color="charcoal.500" fontFamily="body" lineHeight="1.4" mb={1}>
        {seed.rationale}
      </Text>

      {seed.approachHint && (
        <Text fontSize="xs" color="charcoal.400" fontFamily="body" fontStyle="italic" mb={1}>
          Approach: {seed.approachHint}
        </Text>
      )}

      {seed.suggestionType === "depth_probe" &&
        seed.currentBloomsLevel != null &&
        seed.targetBloomsLevel != null && (
          <Text fontSize="xs" color="violet.500" fontFamily="heading" mb={1}>
            {bloomLabel(seed.currentBloomsLevel)} ({seed.currentBloomsLevel.toFixed(1)}) →{" "}
            {bloomLabel(seed.targetBloomsLevel)} ({seed.targetBloomsLevel.toFixed(1)})
          </Text>
        )}

      {/* Action buttons */}
      {showActions === "review" && (
        <HStack gap={2} mt={2}>
          <Button
            size="xs"
            bg="green.500"
            color="white"
            _hover={{ bg: "green.600" }}
            fontFamily="heading"
            onClick={() => handleReview("accept")}
            disabled={isActing}
          >
            <FiCheck style={{ marginRight: "3px" }} /> Accept
          </Button>
          <Button
            size="xs"
            variant="ghost"
            color="red.500"
            _hover={{ bg: "red.50" }}
            fontFamily="heading"
            onClick={() => handleReview("dismiss")}
            disabled={isActing}
          >
            <FiX style={{ marginRight: "3px" }} /> Dismiss
          </Button>
        </HStack>
      )}

      {showActions === "active" && (
        <HStack gap={2} mt={2}>
          <Button
            size="xs"
            variant="ghost"
            color="charcoal.400"
            _hover={{ bg: "gray.100" }}
            fontFamily="heading"
            onClick={handleDismiss}
            disabled={isActing}
          >
            <FiX style={{ marginRight: "3px" }} /> Dismiss
          </Button>
        </HStack>
      )}
    </Box>
  );
}

// ─── Create Seed Form ───────────────────────────────────────────────

function CreateSeedForm({
  scholarId,
  onDone,
}: {
  scholarId: string;
  onDone: () => void;
}) {
  const createSeed = useMutation(api.seeds.create);
  const [topic, setTopic] = useState("");
  const [domain, setDomain] = useState("");
  const [rationale, setRationale] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!topic.trim() || !rationale.trim()) return;
    setIsSaving(true);
    try {
      await createSeed({
        scholarId: scholarId as Id<"users">,
        topic: topic.trim(),
        domain: domain.trim() || undefined,
        rationale: rationale.trim(),
      });
      onDone();
    } catch (err) {
      console.error("Error creating seed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box bg="white" borderRadius="md" p={3} border="1px solid" borderColor="violet.200">
      <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="navy.500" mb={2}>
        New Seed
      </Text>
      <VStack gap={2} align="stretch">
        <input
          placeholder="Topic (e.g., Fibonacci sequence in nature)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          style={{
            padding: "6px 8px",
            borderRadius: "4px",
            border: "1px solid #e2e8f0",
            fontSize: "13px",
            fontFamily: "inherit",
          }}
        />
        <input
          placeholder="Domain (optional, e.g., Mathematics)"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          style={{
            padding: "6px 8px",
            borderRadius: "4px",
            border: "1px solid #e2e8f0",
            fontSize: "13px",
            fontFamily: "inherit",
          }}
        />
        <Textarea
          size="sm"
          placeholder="Why explore this? What's the readiness signal?"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={2}
          bg="gray.50"
          fontFamily="body"
          fontSize="xs"
        />
        <HStack gap={2}>
          <Button
            size="xs"
            bg="violet.500"
            color="white"
            _hover={{ bg: "violet.600" }}
            fontFamily="heading"
            onClick={handleCreate}
            disabled={isSaving || !topic.trim() || !rationale.trim()}
          >
            Create
          </Button>
          <Button
            size="xs"
            variant="ghost"
            fontFamily="heading"
            onClick={onDone}
          >
            Cancel
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function SeedsTab({ scholarId }: SeedsTabProps) {
  const allSeeds = useQuery(api.seeds.listByScholar, {
    scholarId: scholarId as Id<"users">,
  });
  const [showCreate, setShowCreate] = useState(false);

  if (allSeeds === undefined) {
    return (
      <Flex justify="center" py={8}>
        <Spinner size="md" color="violet.500" />
      </Flex>
    );
  }

  const pending = allSeeds.filter((s: any) => s.status === "pending");
  const active = allSeeds.filter((s: any) => s.status === "active");
  const introduced = allSeeds.filter((s: any) => s.status === "introduced");

  const hasSomething = pending.length > 0 || active.length > 0 || introduced.length > 0;

  return (
    <VStack gap={4} align="stretch" maxW="700px">
      {/* Header + create button */}
      <HStack justify="space-between">
        <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
          Exploration Seeds
        </Text>
        <Button
          size="xs"
          variant="ghost"
          color="violet.500"
          fontFamily="heading"
          _hover={{ bg: "violet.50" }}
          onClick={() => setShowCreate(!showCreate)}
        >
          <FiPlus style={{ marginRight: "3px" }} /> Add Seed
        </Button>
      </HStack>

      {showCreate && (
        <CreateSeedForm
          scholarId={scholarId}
          onDone={() => setShowCreate(false)}
        />
      )}

      {/* Pending review */}
      {pending.length > 0 && (
        <Box>
          <HStack mb={2}>
            <Badge bg="orange.100" color="orange.700" fontSize="xs">
              {pending.length} pending review
            </Badge>
          </HStack>
          <VStack gap={2} align="stretch">
            {pending.map((seed: any) => (
              <SeedCard key={seed._id} seed={seed} showActions="review" />
            ))}
          </VStack>
        </Box>
      )}

      {/* Active */}
      {active.length > 0 && (
        <Box>
          <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="charcoal.400" mb={2}>
            Active ({active.length})
          </Text>
          <VStack gap={2} align="stretch">
            {active.map((seed: any) => (
              <SeedCard key={seed._id} seed={seed} showActions="active" />
            ))}
          </VStack>
        </Box>
      )}

      {/* Introduced */}
      {introduced.length > 0 && (
        <Box>
          <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="charcoal.400" mb={2}>
            Introduced ({introduced.length})
          </Text>
          <VStack gap={2} align="stretch">
            {introduced.map((seed: any) => (
              <SeedCard key={seed._id} seed={seed} showActions="none" />
            ))}
          </VStack>
        </Box>
      )}

      {!hasSomething && !showCreate && (
        <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={8}>
          No seeds yet. Seeds are AI-suggested exploration directions that appear after conversations, or you can create them manually.
        </Text>
      )}
    </VStack>
  );
}
