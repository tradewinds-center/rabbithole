"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import {
  Box,
  Flex,
  HStack,
  VStack,
  Text,
  Badge,
  IconButton,
  Input,
  Textarea,
  Button,
} from "@chakra-ui/react";
import { FiTrash2, FiChevronDown, FiChevronRight, FiClock, FiPlay } from "react-icons/fi";
import { STRAND_CONFIG } from "@/lib/constants";

interface LessonCardProps {
  lesson: Doc<"lessons"> & { processTitle: string | null; processEmoji: string | null };
  unitSlug?: string;
}

export function LessonCard({ lesson, unitSlug }: LessonCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const updateLesson = useMutation(api.lessons.update);
  const removeLesson = useMutation(api.lessons.remove);
  const processes = useQuery(api.processes.list);

  const handleTitleBlur = async () => {
    setEditingTitle(false);
    if (title.trim() && title.trim() !== lesson.title) {
      await updateLesson({ id: lesson._id, title: title.trim() });
    } else {
      setTitle(lesson.title);
    }
  };

  const handleProcessChange = async (processId: string) => {
    await updateLesson({
      id: lesson._id,
      processId: processId ? (processId as Id<"processes">) : null,
    });
  };

  const handlePromptChange = async (prompt: string) => {
    await updateLesson({
      id: lesson._id,
      systemPrompt: prompt || null,
    });
  };

  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="lg"
      overflow="hidden"
      _hover={{ borderColor: "gray.300", shadow: "sm" }}
      transition="all 0.15s"
    >
      <Flex
        px={3}
        py={2.5}
        align="center"
        gap={2}
        cursor="pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <Box color="charcoal.400" flexShrink={0}>
          {expanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
        </Box>

        {editingTitle ? (
          <Input
            size="sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleBlur();
              if (e.key === "Escape") {
                setTitle(lesson.title);
                setEditingTitle(false);
              }
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            fontFamily="heading"
            fontWeight="500"
            fontSize="sm"
          />
        ) : (
          <Text
            fontFamily="heading"
            fontWeight="500"
            fontSize="sm"
            color="navy.500"
            flex={1}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingTitle(true);
            }}
            truncate
          >
            {lesson.title}
          </Text>
        )}

        <HStack gap={1} flexShrink={0}>
          {lesson.processEmoji && lesson.processTitle && (
            <Badge
              bg="violet.100"
              color="violet.700"
              fontSize="xs"
              fontFamily="heading"
            >
              {lesson.processEmoji} {lesson.processTitle}
            </Badge>
          )}
          {lesson.durationMinutes && (
            <Badge bg="gray.100" color="charcoal.500" fontSize="xs">
              <FiClock size={10} style={{ marginRight: 2 }} />
              {lesson.durationMinutes}m
            </Badge>
          )}
          {lesson.systemPrompt ? (
            <Box w={2} h={2} borderRadius="full" bg="green.400" title="Prompt generated" />
          ) : (
            <Box w={2} h={2} borderRadius="full" bg="gray.300" title="No prompt yet" />
          )}
        </HStack>

        {unitSlug && (
          <IconButton
            aria-label="Test lesson"
            size="xs"
            variant="ghost"
            color="teal.500"
            _hover={{ color: "teal.600", bg: "teal.50" }}
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/scholar/new?unit=${unitSlug}&lesson=${lesson._id}&demo=1`, "_blank");
            }}
          >
            <FiPlay size={12} />
          </IconButton>
        )}
        <IconButton
          aria-label="Delete lesson"
          size="xs"
          variant="ghost"
          color="charcoal.300"
          _hover={{ color: "red.500", bg: "red.50" }}
          onClick={(e) => {
            e.stopPropagation();
            removeLesson({ id: lesson._id });
          }}
        >
          <FiTrash2 size={12} />
        </IconButton>
      </Flex>

      {expanded && (
        <VStack px={3} pb={3} pt={1} gap={2} align="stretch" borderTop="1px solid" borderColor="gray.100">
          {/* Process selector */}
          <Flex align="center" gap={2}>
            <Text fontSize="xs" color="charcoal.400" fontFamily="heading" w="60px">
              Process
            </Text>
            <Box flex={1}>
              <select
                value={lesson.processId ? String(lesson.processId) : ""}
                onChange={(e) => handleProcessChange(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  fontFamily: "var(--chakra-fonts-heading)",
                }}
              >
                <option value="">None</option>
                {processes?.map((p) => (
                  <option key={String(p._id)} value={String(p._id)}>
                    {p.emoji} {p.title}
                  </option>
                ))}
              </select>
            </Box>
          </Flex>

          {/* Duration */}
          <Flex align="center" gap={2}>
            <Text fontSize="xs" color="charcoal.400" fontFamily="heading" w="60px">
              Duration
            </Text>
            <Input
              size="xs"
              type="number"
              placeholder="minutes"
              value={lesson.durationMinutes ?? ""}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value) : null;
                updateLesson({ id: lesson._id, durationMinutes: val });
              }}
              w="80px"
              fontFamily="heading"
              fontSize="xs"
            />
            <Text fontSize="xs" color="charcoal.300">min</Text>
          </Flex>

          {/* System prompt */}
          <Box>
            <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mb={1}>
              System Prompt
            </Text>
            <Textarea
              size="sm"
              value={lesson.systemPrompt ?? ""}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder="AI-generated or manually written lesson prompt..."
              rows={3}
              fontSize="xs"
              fontFamily="body"
              borderColor="gray.200"
              _focus={{ borderColor: "violet.400", boxShadow: "none" }}
            />
          </Box>
        </VStack>
      )}
    </Box>
  );
}
