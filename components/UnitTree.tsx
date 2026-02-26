"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Textarea,
  Input,
  Button,
  IconButton,
  Badge,
} from "@chakra-ui/react";
import { FiPlus, FiX } from "react-icons/fi";
import { STRAND_CONFIG, STRAND_ORDER, type Strand } from "@/lib/constants";
import { LessonCard } from "./LessonCard";

type Lesson = Doc<"lessons"> & { processTitle: string | null; processEmoji: string | null };

interface UnitTreeProps {
  unit: Doc<"units">;
  lessons: Lesson[];
}

export function UnitTree({ unit, lessons }: UnitTreeProps) {
  const updateUnit = useMutation(api.units.update);
  const createLesson = useMutation(api.lessons.create);

  // Local state for editable fields
  const [bigIdea, setBigIdea] = useState(unit.bigIdea ?? "");
  const [subject, setSubject] = useState(unit.subject ?? "");
  const [gradeLevel, setGradeLevel] = useState(unit.gradeLevel ?? "");

  // Essential Questions
  const eqs = unit.essentialQuestions ?? [];
  const [newEQ, setNewEQ] = useState("");

  // Enduring Understandings
  const eus = unit.enduringUnderstandings ?? [];
  const [newEU, setNewEU] = useState("");

  // Sync when unit updates from server (e.g. AI tool writes fields)
  useEffect(() => {
    setBigIdea(unit.bigIdea ?? "");
  }, [unit.bigIdea]);
  useEffect(() => {
    setSubject(unit.subject ?? "");
  }, [unit.subject]);
  useEffect(() => {
    setGradeLevel(unit.gradeLevel ?? "");
  }, [unit.gradeLevel]);

  // Adding lessons
  const [addingStrand, setAddingStrand] = useState<Strand | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");

  const handleBigIdeaBlur = useCallback(() => {
    if (bigIdea !== (unit.bigIdea ?? "")) {
      updateUnit({ id: unit._id, bigIdea: bigIdea || null });
    }
  }, [bigIdea, unit.bigIdea, unit._id, updateUnit]);

  const handleSubjectBlur = useCallback(() => {
    if (subject !== (unit.subject ?? "")) {
      updateUnit({ id: unit._id, subject: subject || null });
    }
  }, [subject, unit.subject, unit._id, updateUnit]);

  const handleGradeLevelBlur = useCallback(() => {
    if (gradeLevel !== (unit.gradeLevel ?? "")) {
      updateUnit({ id: unit._id, gradeLevel: gradeLevel || null });
    }
  }, [gradeLevel, unit.gradeLevel, unit._id, updateUnit]);

  const addEQ = useCallback(async () => {
    const trimmed = newEQ.trim();
    if (!trimmed) return;
    await updateUnit({ id: unit._id, essentialQuestions: [...eqs, trimmed] });
    setNewEQ("");
  }, [newEQ, eqs, unit._id, updateUnit]);

  const removeEQ = useCallback(async (idx: number) => {
    const updated = eqs.filter((_, i) => i !== idx);
    await updateUnit({ id: unit._id, essentialQuestions: updated });
  }, [eqs, unit._id, updateUnit]);

  const addEU = useCallback(async () => {
    const trimmed = newEU.trim();
    if (!trimmed) return;
    await updateUnit({ id: unit._id, enduringUnderstandings: [...eus, trimmed] });
    setNewEU("");
  }, [newEU, eus, unit._id, updateUnit]);

  const removeEU = useCallback(async (idx: number) => {
    const updated = eus.filter((_, i) => i !== idx);
    await updateUnit({ id: unit._id, enduringUnderstandings: updated });
  }, [eus, unit._id, updateUnit]);

  const handleAddLesson = useCallback(async (strand: Strand) => {
    const trimmed = newLessonTitle.trim();
    if (!trimmed) return;
    await createLesson({
      unitId: unit._id,
      title: trimmed,
      strand,
    });
    setNewLessonTitle("");
    setAddingStrand(null);
  }, [newLessonTitle, unit._id, createLesson]);

  // Group lessons by strand
  const lessonsByStrand: Record<string, Lesson[]> = {};
  for (const s of STRAND_ORDER) lessonsByStrand[s] = [];
  lessonsByStrand["none"] = [];
  for (const l of lessons) {
    const key = l.strand ?? "none";
    if (!lessonsByStrand[key]) lessonsByStrand[key] = [];
    lessonsByStrand[key].push(l);
  }

  return (
    <Box overflowY="auto" flex={1} px={4} py={4}>
      <VStack align="stretch" gap={4}>
        {/* Subject + Grade */}
        <Flex gap={3}>
          <Box flex={1}>
            <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mb={1}>Subject</Text>
            <Input
              size="sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onBlur={handleSubjectBlur}
              placeholder="e.g., Science"
              fontFamily="heading"
              fontSize="sm"
              borderColor="gray.200"
              _focus={{ borderColor: "violet.400", boxShadow: "none" }}
            />
          </Box>
          <Box flex={1}>
            <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mb={1}>Grade</Text>
            <Input
              size="sm"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              onBlur={handleGradeLevelBlur}
              placeholder="e.g., 3rd-5th"
              fontFamily="heading"
              fontSize="sm"
              borderColor="gray.200"
              _focus={{ borderColor: "violet.400", boxShadow: "none" }}
            />
          </Box>
        </Flex>

        {/* Big Idea */}
        <Box>
          <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mb={1}>Big Idea</Text>
          <Textarea
            value={bigIdea}
            onChange={(e) => setBigIdea(e.target.value)}
            onBlur={handleBigIdeaBlur}
            placeholder="The overarching concept or theme..."
            rows={2}
            fontSize="sm"
            fontFamily="body"
            borderColor="gray.200"
            _focus={{ borderColor: "violet.400", boxShadow: "none" }}
          />
        </Box>

        {/* Essential Questions */}
        <Box>
          <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mb={1}>
            Essential Questions
          </Text>
          <VStack align="stretch" gap={1}>
            {eqs.map((q, i) => (
              <Flex key={i} align="center" gap={1} bg="gray.50" px={2} py={1} borderRadius="md">
                <Text fontSize="sm" fontFamily="body" color="charcoal.500" flex={1}>{q}</Text>
                <IconButton
                  aria-label="Remove"
                  size="xs"
                  variant="ghost"
                  color="charcoal.300"
                  _hover={{ color: "red.500" }}
                  onClick={() => removeEQ(i)}
                >
                  <FiX size={12} />
                </IconButton>
              </Flex>
            ))}
            <Flex gap={1}>
              <Input
                size="sm"
                value={newEQ}
                onChange={(e) => setNewEQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEQ()}
                placeholder="Add essential question..."
                fontSize="sm"
                fontFamily="body"
                borderColor="gray.200"
                _focus={{ borderColor: "violet.400", boxShadow: "none" }}
              />
              <IconButton
                aria-label="Add"
                size="sm"
                variant="ghost"
                color="violet.500"
                onClick={addEQ}
                disabled={!newEQ.trim()}
              >
                <FiPlus size={14} />
              </IconButton>
            </Flex>
          </VStack>
        </Box>

        {/* Enduring Understandings */}
        <Box>
          <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mb={1}>
            Enduring Understandings
          </Text>
          <VStack align="stretch" gap={1}>
            {eus.map((u, i) => (
              <Flex key={i} align="center" gap={1} bg="gray.50" px={2} py={1} borderRadius="md">
                <Text fontSize="sm" fontFamily="body" color="charcoal.500" flex={1}>{u}</Text>
                <IconButton
                  aria-label="Remove"
                  size="xs"
                  variant="ghost"
                  color="charcoal.300"
                  _hover={{ color: "red.500" }}
                  onClick={() => removeEU(i)}
                >
                  <FiX size={12} />
                </IconButton>
              </Flex>
            ))}
            <Flex gap={1}>
              <Input
                size="sm"
                value={newEU}
                onChange={(e) => setNewEU(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEU()}
                placeholder="Add enduring understanding..."
                fontSize="sm"
                fontFamily="body"
                borderColor="gray.200"
                _focus={{ borderColor: "violet.400", boxShadow: "none" }}
              />
              <IconButton
                aria-label="Add"
                size="sm"
                variant="ghost"
                color="violet.500"
                onClick={addEU}
                disabled={!newEU.trim()}
              >
                <FiPlus size={14} />
              </IconButton>
            </Flex>
          </VStack>
        </Box>

        {/* Lessons by Strand */}
        {STRAND_ORDER.map((strand) => {
          const cfg = STRAND_CONFIG[strand];
          const strandLessons = lessonsByStrand[strand];
          return (
            <Box key={strand}>
              <HStack gap={2} mb={2}>
                <Text fontSize="lg">{cfg.emoji}</Text>
                <Text
                  fontSize="xs"
                  fontFamily="heading"
                  fontWeight="600"
                  color={`${cfg.color}.600`}
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  {cfg.label}
                </Text>
                {strand === "identity" && (
                  <Badge bg="gray.100" color="charcoal.400" fontSize="xs">optional</Badge>
                )}
                <Badge bg={`${cfg.color}.100`} color={`${cfg.color}.700`} fontSize="xs">
                  {strandLessons.length}
                </Badge>
              </HStack>

              <VStack align="stretch" gap={1.5} mb={2}>
                {strandLessons.map((lesson) => (
                  <LessonCard key={String(lesson._id)} lesson={lesson} />
                ))}

                {addingStrand === strand ? (
                  <Flex gap={1}>
                    <Input
                      size="sm"
                      value={newLessonTitle}
                      onChange={(e) => setNewLessonTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddLesson(strand);
                        if (e.key === "Escape") {
                          setAddingStrand(null);
                          setNewLessonTitle("");
                        }
                      }}
                      placeholder="Lesson title..."
                      autoFocus
                      fontFamily="heading"
                      fontSize="sm"
                      borderColor="gray.200"
                      _focus={{ borderColor: "violet.400", boxShadow: "none" }}
                    />
                    <Button
                      size="sm"
                      bg="violet.500"
                      color="white"
                      _hover={{ bg: "violet.600" }}
                      onClick={() => handleAddLesson(strand)}
                      disabled={!newLessonTitle.trim()}
                      fontFamily="heading"
                      fontSize="xs"
                    >
                      Add
                    </Button>
                    <IconButton
                      aria-label="Cancel"
                      size="sm"
                      variant="ghost"
                      onClick={() => { setAddingStrand(null); setNewLessonTitle(""); }}
                    >
                      <FiX size={14} />
                    </IconButton>
                  </Flex>
                ) : (
                  <Button
                    size="xs"
                    variant="ghost"
                    color="charcoal.400"
                    fontFamily="heading"
                    fontSize="xs"
                    _hover={{ color: "violet.500", bg: "violet.50" }}
                    onClick={() => { setAddingStrand(strand); setNewLessonTitle(""); }}
                  >
                    <FiPlus size={12} style={{ marginRight: 4 }} />
                    Add Lesson
                  </Button>
                )}
              </VStack>
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}
