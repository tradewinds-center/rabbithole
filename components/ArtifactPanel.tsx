"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Flex, Input, Text, Textarea, Button, HStack, IconButton } from "@chakra-ui/react";
import { FiPlus, FiTrash2, FiFileText, FiCode, FiChevronDown, FiChevronRight } from "react-icons/fi";
import { ProcessPanel } from "./ProcessPanel";
import type { ProcessDefinition, ProcessStep } from "./ProcessPanel";
import { CodeArtifactViewer } from "./CodeArtifactViewer";

interface ArtifactDoc {
  _id: string;
  title: string;
  content: string;
  lastEditedBy: string;
  type?: "text" | "code";
  language?: string;
}

interface ArtifactPanelProps {
  artifacts: ArtifactDoc[];
  activeArtifactId: string | null;
  onSelectArtifact: (id: string) => void;
  onSave: (artifactId: string, updates: { content?: string; title?: string }) => void;
  onCreateArtifact: () => void;
  onDeleteArtifact: (id: string) => void;
  onSyncChange?: (synced: boolean) => void;
  youtubeUrl?: string | null;
  process?: ProcessDefinition | null;
  processCurrentStep?: string;
  processSteps?: ProcessStep[];
}

export function ArtifactPanel({
  artifacts,
  activeArtifactId,
  onSelectArtifact,
  onSave,
  onCreateArtifact,
  onDeleteArtifact,
  onSyncChange,
  youtubeUrl,
  process,
  processCurrentStep,
  processSteps,
}: ArtifactPanelProps) {
  const hasProcess = !!(process && processCurrentStep && processSteps);
  const hasArtifacts = artifacts.length > 0;

  // Section expand states
  const [processExpanded, setProcessExpanded] = useState(true);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(() => new Set(artifacts.map((a) => a._id)));

  // Auto-expand process when it first appears
  useEffect(() => {
    if (hasProcess) setProcessExpanded(true);
  }, [hasProcess]);

  // Auto-expand newly added artifacts
  const prevIdsRef = useRef<Set<string>>(new Set(artifacts.map((a) => a._id)));
  useEffect(() => {
    const prevIds = prevIdsRef.current;
    const newIds = artifacts.filter((a) => !prevIds.has(a._id)).map((a) => a._id);
    if (newIds.length > 0) {
      setExpandedDocs((prev) => {
        const next = new Set(prev);
        newIds.forEach((id) => next.add(id));
        return next;
      });
    }
    prevIdsRef.current = new Set(artifacts.map((a) => a._id));
  }, [artifacts]);

  const handleProcessTabClick = () => {
    setProcessExpanded((v) => !v);
  };

  const handleDocTabClick = (id: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    onSelectArtifact(id);
  };

  // Extract YouTube video ID for embed
  const youtubeVideoId = youtubeUrl ? extractYouTubeId(youtubeUrl) : null;

  // Neither section has content
  if (!hasProcess && !hasArtifacts && !youtubeVideoId) {
    return (
      <Flex flex={1} flexDir="column" align="center" justify="center" bg="gray.50" gap={3} p={6}>
        <Text fontSize="sm" fontFamily="heading" color="charcoal.300">
          No documents yet
        </Text>
        <Button
          size="sm"
          variant="outline"
          colorPalette="violet"
          onClick={onCreateArtifact}
        >
          <FiPlus />
          Add Document
        </Button>
      </Flex>
    );
  }

  return (
    <Flex flex={1} flexDir="column" overflow="hidden" bg="gray.50" gap={4} px={4} pt={1} pb={3}>
      {/* ── YouTube video embed ── */}
      {youtubeVideoId && (
        <Box flexShrink={0} pt={2}>
          <Box
            borderRadius="lg"
            overflow="hidden"
            shadow="0 1px 3px rgba(0,0,0,0.08)"
            bg="black"
            css={{ aspectRatio: "16 / 9" }}
          >
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${youtubeVideoId}`}
              title="Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: "none", display: "block" }}
            />
          </Box>
        </Box>
      )}

      {/* ── Process section ── */}
      {hasProcess && (
        <Flex flexDir="column" overflow="hidden" flexShrink={0}>
          {/* Process tab bar — on gray background */}
          <Flex py={3} align="center" gap={1} flexShrink={0}>
            <HStack gap={0.5} flex={1}>
              <Button
                size="sm"
                variant="ghost"
                fontFamily="heading"
                fontWeight={processExpanded ? "600" : "400"}
                color={processExpanded ? "navy.500" : "charcoal.400"}
                bg={processExpanded ? "white" : "transparent"}
                shadow={processExpanded ? "0 1px 3px rgba(0,0,0,0.08)" : "none"}
                _hover={{ bg: "white" }}
                borderRadius="md"
                px={2}
                py={2}
                h="auto"
                minH="24px"
                onClick={handleProcessTabClick}
                maxW="160px"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                gap={1}
              >
                {processExpanded ? <FiChevronDown size={14} style={{ flexShrink: 0 }} /> : <FiChevronRight size={14} style={{ flexShrink: 0 }} />}
                <Text as="span" flexShrink={0}>{process!.emoji || "📋"}</Text>
                {process!.title.length > 18 ? process!.title.slice(0, 18) + "..." : process!.title}
              </Button>
            </HStack>
          </Flex>
          {/* Process content — white card */}
          {processExpanded && (
            <Box
              overflow="auto"
              bg="white"
              borderRadius="lg"
              shadow="0 1px 3px rgba(0,0,0,0.08)"
            >
              <ProcessPanel
                process={process!}
                currentStep={processCurrentStep!}
                steps={processSteps!}
              />
            </Box>
          )}
        </Flex>
      )}

      {/* ── Document sections — one per artifact ── */}
      {artifacts.map((a) => {
        const isExpanded = expandedDocs.has(a._id);
        return (
          <Flex
            key={a._id}
            flexDir="column"
            overflow="hidden"
            flex={isExpanded ? 1 : undefined}
            flexShrink={isExpanded ? undefined : 0}
          >
            {/* Document tab bar */}
            <Flex py={3} align="center" gap={1} flexShrink={0}>
              <Button
                size="sm"
                variant="ghost"
                fontFamily="heading"
                fontWeight={isExpanded ? "600" : "400"}
                color={isExpanded ? "navy.500" : "charcoal.400"}
                bg={isExpanded ? "white" : "transparent"}
                shadow={isExpanded ? "0 1px 3px rgba(0,0,0,0.08)" : "none"}
                _hover={{ bg: "white" }}
                borderRadius="md"
                px={2}
                py={2}
                h="auto"
                minH="24px"
                onClick={() => handleDocTabClick(a._id)}
                maxW="180px"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                gap={1}
              >
                {isExpanded ? <FiChevronDown size={14} style={{ flexShrink: 0 }} /> : <FiChevronRight size={14} style={{ flexShrink: 0 }} />}
                {a.type === "code" ? <FiCode size={12} style={{ flexShrink: 0 }} /> : <FiFileText size={12} style={{ flexShrink: 0 }} />}
                {a.title.length > 18 ? a.title.slice(0, 18) + "..." : a.title}
              </Button>
            </Flex>
            {/* Document content — white card */}
            {isExpanded && (
              <Flex
                flex={1}
                flexDir="column"
                overflow="hidden"
                bg="white"
                borderRadius="lg"
                shadow="0 1px 3px rgba(0,0,0,0.08)"
              >
                {a.type === "code" ? (
                  <CodeArtifactViewer
                    key={a._id}
                    artifact={a}
                    onSave={(updates) => onSave(a._id, updates)}
                    onDelete={() => onDeleteArtifact(a._id)}
                    onSyncChange={onSyncChange}
                  />
                ) : (
                  <ArtifactEditor
                    key={a._id}
                    artifact={a}
                    onSave={(updates) => onSave(a._id, updates)}
                    onDelete={() => onDeleteArtifact(a._id)}
                    onSyncChange={onSyncChange}
                  />
                )}
              </Flex>
            )}
          </Flex>
        );
      })}

      {/* Add document button — at bottom */}
      <Flex flexShrink={0} py={1}>
        <Button
          size="sm"
          variant="ghost"
          fontFamily="heading"
          fontWeight="400"
          color="charcoal.400"
          _hover={{ color: "navy.500", bg: "white" }}
          borderRadius="md"
          px={2}
          py={1}
          h="auto"
          minH="24px"
          gap={1}
          onClick={onCreateArtifact}
        >
          <FiPlus size={14} style={{ flexShrink: 0 }} />
          Add Document
        </Button>
      </Flex>
    </Flex>
  );
}

// Single document editor
function ArtifactEditor({
  artifact,
  onSave,
  onDelete,
  onSyncChange,
}: {
  artifact: { _id: string; title: string; content: string; lastEditedBy: string };
  onSave: (updates: { content?: string; title?: string }) => void;
  onDelete?: () => void;
  onSyncChange?: (synced: boolean) => void;
}) {
  const [localContent, setLocalContent] = useState(artifact.content);
  const [localTitle, setLocalTitle] = useState(artifact.title);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const lastKnownContentRef = useRef(artifact.content);
  const lastKnownTitleRef = useRef(artifact.title);
  const saveContentTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const saveTitleTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const isSynced = localContent === artifact.content && localTitle === artifact.title;

  useEffect(() => {
    onSyncChange?.(isSynced);
  }, [isSynced, onSyncChange]);

  useEffect(() => {
    if (artifact.content !== lastKnownContentRef.current) {
      const hasLocalEdits = localContent !== lastKnownContentRef.current;
      lastKnownContentRef.current = artifact.content;

      if (hasLocalEdits) {
        setShowUpdateBanner(true);
      } else {
        setLocalContent(artifact.content);
      }
    }
  }, [artifact.content]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (artifact.title !== lastKnownTitleRef.current) {
      lastKnownTitleRef.current = artifact.title;
      setLocalTitle(artifact.title);
    }
  }, [artifact.title]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setLocalContent(newContent);
    setShowUpdateBanner(false);

    clearTimeout(saveContentTimeoutRef.current);
    saveContentTimeoutRef.current = setTimeout(() => {
      onSave({ content: newContent });
      lastKnownContentRef.current = newContent;
    }, 500);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setLocalTitle(newTitle);

    clearTimeout(saveTitleTimeoutRef.current);
    saveTitleTimeoutRef.current = setTimeout(() => {
      onSave({ title: newTitle });
      lastKnownTitleRef.current = newTitle;
    }, 500);
  };

  useEffect(() => {
    return () => {
      clearTimeout(saveContentTimeoutRef.current);
      clearTimeout(saveTitleTimeoutRef.current);
    };
  }, []);

  const handleAcceptUpdate = () => {
    setLocalContent(artifact.content);
    lastKnownContentRef.current = artifact.content;
    setShowUpdateBanner(false);
  };

  const wordCount = localContent
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  return (
    <Flex flex={1} flexDir="column" overflow="hidden">
      <Flex align="center" px={3} pt={3} pb={1} gap={1} flexShrink={0}>
        <Input
          value={localTitle}
          onChange={handleTitleChange}
          fontSize="lg"
          fontWeight="600"
          fontFamily="heading"
          color="navy.500"
          border="none"
          bg="transparent"
          px={3}
          h="auto"
          flex={1}
          _focus={{ boxShadow: "none", outline: "none" }}
        />
        {onDelete && (
          <IconButton
            aria-label="Delete document"
            size="xs"
            variant="ghost"
            color="charcoal.300"
            _hover={{ color: "red.500" }}
            onClick={onDelete}
          >
            <FiTrash2 />
          </IconButton>
        )}
      </Flex>

      {showUpdateBanner && (
        <Flex
          px={6}
          py={2}
          bg="violet.50"
          align="center"
          justify="space-between"
          flexShrink={0}
        >
          <Text fontSize="xs" fontFamily="heading" color="violet.700">
            AI updated the document
          </Text>
          <Button
            size="xs"
            variant="outline"
            colorPalette="violet"
            onClick={handleAcceptUpdate}
          >
            Accept
          </Button>
        </Flex>
      )}

      <Box flex={1} overflow="hidden" px={3}>
        <Textarea
          value={localContent}
          onChange={handleContentChange}
          placeholder="Start writing"
          resize="none"
          h="100%"
          fontFamily="body"
          fontSize="xl"
          lineHeight="1.6"
          border="none"
          bg="white"
          p={3}
          _focus={{ boxShadow: "none", outline: "none" }}
        />
      </Box>

      <Text
        fontSize="xs"
        fontFamily="heading"
        color="charcoal.300"
        px={6}
        py={1}
        flexShrink={0}
      >
        {wordCount} {wordCount === 1 ? "word" : "words"}
      </Text>
    </Flex>
  );
}

function extractYouTubeId(url: string): string | null {
  const watchMatch = url.match(/(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  return null;
}
