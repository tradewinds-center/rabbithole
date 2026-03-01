"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Dialog,
  IconButton,
  Portal,
  Spinner,
} from "@chakra-ui/react";
import { FiChevronDown, FiChevronRight, FiLock, FiX } from "react-icons/fi";
import { STRAND_CONFIG, STRAND_ORDER, type Strand } from "@/lib/constants";

interface UnitOption {
  id: string;
  title: string;
  emoji?: string | null;
  description?: string | null;
}

interface UnitPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (unitId: string | null, lessonId: string | null) => void;
  units: UnitOption[];
  focusLock?: { unitId?: string | null; lessonId?: string | null; lessonTitle?: string | null } | null;
  isCreating?: boolean;
}

export function UnitPickerDialog({
  open,
  onClose,
  onSelect,
  units,
  focusLock,
  isCreating = false,
}: UnitPickerDialogProps) {
  const lockedUnitId = focusLock?.unitId ?? null;
  const lockedLessonId = focusLock?.lessonId ?? null;
  const [selected, setSelected] = useState<string | null>(lockedUnitId);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(lockedUnitId);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(lockedLessonId);

  // Query lessons for the expanded unit
  const lessons = useQuery(
    api.lessons.listByUnitPublic,
    expandedUnit ? { unitId: expandedUnit as Id<"units"> } : "skip"
  );

  // Reset selection when dialog opens
  const handleOpenChange = (details: { open: boolean }) => {
    if (details.open) {
      setSelected(lockedUnitId);
      setExpandedUnit(lockedUnitId);
      setSelectedLesson(lockedLessonId);
    } else {
      onClose();
    }
  };

  const handleUnitClick = (unitId: string) => {
    if (expandedUnit === unitId) {
      // Collapse — clear lesson selection if it was for this unit
      setExpandedUnit(null);
      setSelectedLesson(null);
      setSelected(unitId);
    } else {
      setExpandedUnit(unitId);
      setSelected(unitId);
      setSelectedLesson(null);
    }
  };

  const handleLessonClick = (unitId: string, lessonId: string) => {
    setSelected(unitId);
    setSelectedLesson(lessonId);
  };

  const handleConfirm = () => {
    onSelect(selected, selectedLesson);
  };

  // Focus lock banner text
  const focusBannerText = (() => {
    if (!lockedUnitId) return null;
    const unit = units.find((u) => u.id === lockedUnitId);
    const lessonName = focusLock?.lessonTitle;
    if (lessonName) return `Your teacher has set a focus: ${lessonName}`;
    if (unit) return `Your teacher has set a focus: ${unit.title}`;
    return "Your teacher has set a focus";
  })();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={handleOpenChange}
      placement="center"
      motionPreset="slide-in-bottom"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="xl" mx={4} borderRadius="xl" overflow="hidden">
            <Dialog.Header px={6} pt={5} pb={2}>
              <Dialog.Title
                fontFamily="heading"
                fontWeight="700"
                color="navy.500"
                fontSize="lg"
                flex={1}
              >
                What would you like to work on?
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <IconButton
                  aria-label="Close"
                  size="sm"
                  variant="ghost"
                  color="charcoal.400"
                  _hover={{ bg: "gray.100" }}
                >
                  <FiX />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body px={6} py={3}>
              {/* Focus lock banner */}
              {focusBannerText && (
                <HStack
                  gap={2}
                  bg="orange.50"
                  border="1px solid"
                  borderColor="orange.200"
                  borderRadius="lg"
                  px={3}
                  py={2}
                  mb={3}
                >
                  <FiLock size={14} color="var(--chakra-colors-orange-500)" />
                  <Text fontSize="xs" fontFamily="heading" color="orange.700" fontWeight="500">
                    {focusBannerText}
                  </Text>
                </HStack>
              )}

              <VStack gap={2} align="stretch" maxH="400px" overflowY="auto">
                {/* Focused unit first when focus lock is active */}
                {lockedUnitId && (() => {
                  const focusedUnit = units.find((u) => u.id === lockedUnitId);
                  return focusedUnit ? (
                    <UnitWithLessons
                      key={focusedUnit.id}
                      unit={focusedUnit}
                      isSelected={selected === focusedUnit.id}
                      isExpanded={expandedUnit === focusedUnit.id}
                      isDisabled={false}
                      lessons={expandedUnit === focusedUnit.id ? lessons : undefined}
                      selectedLesson={selectedLesson}
                      lockedLessonId={lockedLessonId}
                      onUnitClick={() => handleUnitClick(focusedUnit.id)}
                      onLessonClick={(lessonId) => handleLessonClick(focusedUnit.id, lessonId)}
                    />
                  ) : null;
                })()}

                {/* Independent Study option — prominent */}
                <Box
                  px={4}
                  py={4}
                  borderRadius="xl"
                  cursor={lockedUnitId ? "default" : "pointer"}
                  opacity={lockedUnitId ? 0.4 : 1}
                  bg={selected === null && selectedLesson === null ? "violet.50" : "gray.50"}
                  border="2px solid"
                  borderColor={selected === null && selectedLesson === null ? "violet.300" : "transparent"}
                  _hover={lockedUnitId ? undefined : { bg: selected === null && selectedLesson === null ? "violet.50" : "violet.50", borderColor: "violet.200" }}
                  transition="all 0.15s"
                  onClick={lockedUnitId ? undefined : () => {
                    setSelected(null);
                    setSelectedLesson(null);
                    setExpandedUnit(null);
                  }}
                >
                  <HStack gap={3} align="center">
                    <Text fontSize="2xl" flexShrink={0}>🚀</Text>
                    <Box flex={1} minW={0}>
                      <Text
                        fontFamily="heading"
                        fontWeight="700"
                        color="navy.500"
                        fontSize="md"
                      >
                        Independent Study
                      </Text>
                      <Text
                        fontSize="sm"
                        color="charcoal.400"
                        fontFamily="body"
                        lineHeight="1.4"
                      >
                        Explore any topic you&apos;re curious about
                      </Text>
                    </Box>
                  </HStack>
                </Box>

                {/* Remaining unit cards (skip focused unit if already shown) */}
                {units
                  .filter((unit) => !lockedUnitId || unit.id !== lockedUnitId)
                  .map((unit) => (
                    <UnitWithLessons
                      key={unit.id}
                      unit={unit}
                      isSelected={selected === unit.id}
                      isExpanded={expandedUnit === unit.id}
                      isDisabled={!!lockedUnitId && lockedUnitId !== unit.id}
                      lessons={expandedUnit === unit.id ? lessons : undefined}
                      selectedLesson={selectedLesson}
                      lockedLessonId={lockedLessonId}
                      onUnitClick={() => handleUnitClick(unit.id)}
                      onLessonClick={(lessonId) => handleLessonClick(unit.id, lessonId)}
                    />
                  ))}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer px={6} pb={5} pt={3}>
              <Button
                bg="violet.500"
                color="white"
                _hover={{ bg: "violet.700" }}
                fontFamily="heading"
                size="sm"
                onClick={handleConfirm}
                disabled={isCreating}
                loading={isCreating}
                loadingText="Creating..."
                w="full"
              >
                Start Project
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function UnitWithLessons({
  unit,
  isSelected,
  isExpanded,
  isDisabled,
  lessons,
  selectedLesson,
  lockedLessonId,
  onUnitClick,
  onLessonClick,
}: {
  unit: UnitOption;
  isSelected: boolean;
  isExpanded: boolean;
  isDisabled: boolean;
  lessons: { _id: string; title: string; strand: string | null; processTitle: string | null; processEmoji: string | null; durationMinutes: number | null }[] | undefined;
  selectedLesson: string | null;
  lockedLessonId: string | null;
  onUnitClick: () => void;
  onLessonClick: (lessonId: string) => void;
}) {
  const hasLessons = lessons && lessons.length > 0;
  const isLoading = isExpanded && lessons === undefined;

  return (
    <Box>
      <Box
        px={3}
        py={2.5}
        borderRadius="lg"
        cursor={isDisabled ? "default" : "pointer"}
        opacity={isDisabled ? 0.4 : 1}
        bg={isSelected ? "violet.50" : "transparent"}
        _hover={isDisabled ? undefined : { bg: isSelected ? "violet.50" : "gray.50" }}
        transition="all 0.12s"
        onClick={isDisabled ? undefined : onUnitClick}
      >
        <HStack gap={2.5} align="start">
          <Text fontSize="lg" lineHeight="1.3" flexShrink={0}>{unit.emoji || "📚"}</Text>
          <Box flex={1} minW={0}>
            <HStack gap={1.5}>
              <Text
                fontFamily="heading"
                fontWeight="600"
                color="navy.500"
                fontSize="sm"
                flex={1}
              >
                {unit.title}
              </Text>
              {isExpanded ? (
                <FiChevronDown size={14} color="var(--chakra-colors-charcoal-400)" />
              ) : (
                <FiChevronRight size={14} color="var(--chakra-colors-charcoal-400)" />
              )}
            </HStack>
            {unit.description && !isExpanded && (
              <Text
                fontSize="xs"
                color="charcoal.400"
                fontFamily="body"
                lineHeight="1.4"
                overflow="hidden"
                css={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {unit.description}
              </Text>
            )}
          </Box>
        </HStack>
      </Box>

      {/* Expanded lesson list */}
      {isExpanded && !isDisabled && (
        <Box pl={10} pr={3} pb={2}>
          {isLoading ? (
            <Flex py={2} justify="center">
              <Spinner size="sm" color="violet.400" />
            </Flex>
          ) : hasLessons ? (
            <LessonList
              lessons={lessons}
              selectedLesson={selectedLesson}
              lockedLessonId={lockedLessonId}
              onLessonClick={onLessonClick}
            />
          ) : (
            <Text fontSize="xs" color="charcoal.300" fontFamily="heading" py={1}>
              No lessons yet
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

function LessonList({
  lessons,
  selectedLesson,
  lockedLessonId,
  onLessonClick,
}: {
  lessons: { _id: string; title: string; strand: string | null; processTitle: string | null; processEmoji: string | null; durationMinutes: number | null }[];
  selectedLesson: string | null;
  lockedLessonId: string | null;
  onLessonClick: (lessonId: string) => void;
}) {
  // Group by strand
  const byStrand = new Map<string, typeof lessons>();
  const unstrandedLessons: typeof lessons = [];
  for (const l of lessons) {
    if (l.strand) {
      if (!byStrand.has(l.strand)) byStrand.set(l.strand, []);
      byStrand.get(l.strand)!.push(l);
    } else {
      unstrandedLessons.push(l);
    }
  }

  // If no strands, show flat list
  const hasStrands = byStrand.size > 0;

  if (!hasStrands) {
    return (
      <VStack gap={1} align="stretch">
        {lessons.map((l) => (
          <LessonItem
            key={l._id}
            lesson={l}
            isSelected={selectedLesson === l._id}
            isLocked={!!lockedLessonId && lockedLessonId !== l._id}
            onClick={() => onLessonClick(l._id)}
          />
        ))}
      </VStack>
    );
  }

  return (
    <VStack gap={2} align="stretch">
      {STRAND_ORDER.map((strand) => {
        const strandLessons = byStrand.get(strand);
        if (!strandLessons || strandLessons.length === 0) return null;
        const cfg = STRAND_CONFIG[strand as Strand];
        return (
          <Box key={strand}>
            <Text fontSize="2xs" fontFamily="heading" color={`${cfg.color}.600`} fontWeight="600" textTransform="uppercase" letterSpacing="wider" mb={0.5}>
              {cfg.emoji} {cfg.label}
            </Text>
            <VStack gap={0.5} align="stretch">
              {strandLessons.map((l) => (
                <LessonItem
                  key={l._id}
                  lesson={l}
                  isSelected={selectedLesson === l._id}
                  isLocked={!!lockedLessonId && lockedLessonId !== l._id}
                  onClick={() => onLessonClick(l._id)}
                />
              ))}
            </VStack>
          </Box>
        );
      })}
      {unstrandedLessons.length > 0 && (
        <VStack gap={0.5} align="stretch">
          {unstrandedLessons.map((l) => (
            <LessonItem
              key={l._id}
              lesson={l}
              isSelected={selectedLesson === l._id}
              isLocked={!!lockedLessonId && lockedLessonId !== l._id}
              onClick={() => onLessonClick(l._id)}
            />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

function LessonItem({
  lesson,
  isSelected,
  isLocked,
  onClick,
}: {
  lesson: { _id: string; title: string; processEmoji: string | null; processTitle: string | null; durationMinutes: number | null };
  isSelected: boolean;
  isLocked: boolean;
  onClick: () => void;
}) {
  return (
    <HStack
      px={2}
      py={1.5}
      borderRadius="md"
      cursor={isLocked ? "default" : "pointer"}
      opacity={isLocked ? 0.4 : 1}
      bg={isSelected ? "violet.100" : "transparent"}
      _hover={isLocked ? undefined : { bg: isSelected ? "violet.100" : "gray.50" }}
      transition="all 0.1s"
      onClick={isLocked ? undefined : onClick}
      gap={2}
    >
      <Text fontSize="xs" fontFamily="heading" fontWeight="500" color="navy.500" flex={1}>
        {lesson.title}
      </Text>
      {lesson.processEmoji && (
        <Text fontSize="2xs" color="charcoal.300">{lesson.processEmoji}</Text>
      )}
      {lesson.durationMinutes && (
        <Badge bg="gray.100" color="charcoal.400" fontSize="2xs" px={1}>
          {lesson.durationMinutes}m
        </Badge>
      )}
    </HStack>
  );
}

function UnitCard({
  emoji,
  title,
  description,
  isSelected,
  isDisabled,
  onClick,
}: {
  emoji: string;
  title: string;
  description?: string;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      px={3}
      py={2.5}
      borderRadius="lg"
      cursor={isDisabled ? "default" : "pointer"}
      opacity={isDisabled ? 0.4 : 1}
      bg={isSelected ? "violet.50" : "transparent"}
      _hover={isDisabled ? undefined : { bg: isSelected ? "violet.50" : "gray.50" }}
      transition="all 0.12s"
      onClick={isDisabled ? undefined : onClick}
    >
      <HStack gap={2.5} align="start">
        <Text fontSize="lg" lineHeight="1.3" flexShrink={0}>{emoji}</Text>
        <Box flex={1} minW={0}>
          <Text
            fontFamily="heading"
            fontWeight="600"
            color="navy.500"
            fontSize="sm"
          >
            {title}
          </Text>
          {description && (
            <Text
              fontSize="xs"
              color="charcoal.400"
              fontFamily="body"
              lineHeight="1.4"
              overflow="hidden"
              css={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {description}
            </Text>
          )}
        </Box>
      </HStack>
    </Box>
  );
}
