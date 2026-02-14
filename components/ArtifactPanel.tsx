"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Flex, Input, Text, Textarea, Button, HStack, IconButton } from "@chakra-ui/react";
import { FiPlus, FiTrash2, FiFileText } from "react-icons/fi";
import { ProcessPanel } from "./ProcessPanel";
import type { ProcessDefinition, ProcessStep } from "./ProcessPanel";

interface ArtifactDoc {
  _id: string;
  title: string;
  content: string;
  lastEditedBy: string;
}

interface ArtifactPanelProps {
  artifacts: ArtifactDoc[];
  activeArtifactId: string | null;
  onSelectArtifact: (id: string) => void;
  onSave: (artifactId: string, updates: { content?: string; title?: string }) => void;
  onCreateArtifact: () => void;
  onDeleteArtifact: (id: string) => void;
  onSyncChange?: (synced: boolean) => void;
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
  process,
  processCurrentStep,
  processSteps,
}: ArtifactPanelProps) {
  const hasProcess = !!(process && processCurrentStep && processSteps);
  const hasArtifacts = artifacts.length > 0;

  // Section expand states — clicking active tab toggles collapse
  const [processExpanded, setProcessExpanded] = useState(true);
  const [docsExpanded, setDocsExpanded] = useState(true);

  // Auto-expand process when it first appears
  useEffect(() => {
    if (hasProcess) setProcessExpanded(true);
  }, [hasProcess]);

  // Auto-expand docs when first artifact appears
  useEffect(() => {
    if (hasArtifacts) setDocsExpanded(true);
  }, [hasArtifacts]);

  const active = artifacts.find((a) => a._id === activeArtifactId);

  const handleProcessTabClick = () => {
    setProcessExpanded((v) => !v);
  };

  const handleDocTabClick = (id: string) => {
    if (id === activeArtifactId && docsExpanded) {
      // Clicking active tab — collapse
      setDocsExpanded(false);
    } else {
      onSelectArtifact(id);
      setDocsExpanded(true);
    }
  };

  // Neither section has content
  if (!hasProcess && !hasArtifacts) {
    return (
      <Flex flex={1} flexDir="column" align="center" justify="center" bg="white" gap={3} p={6}>
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
    <Flex flex={1} flexDir="column" overflow="hidden" bg="white" gap={1}>
      {/* ── Process section ── */}
      {hasProcess && (
        <Flex
          flexDir="column"
          overflow="hidden"
          flexShrink={0}
        >
          {/* Process tab bar */}
          <Flex px={3} py={3.5} align="center" gap={1} flexShrink={0}>
            <HStack gap={0.5} flex={1}>
              <Button
                size="sm"
                variant="ghost"
                fontFamily="heading"
                fontWeight={processExpanded ? "600" : "400"}
                color={processExpanded ? "navy.500" : "charcoal.400"}
                bg={processExpanded ? "gray.100" : "transparent"}
                _hover={{ bg: "gray.100" }}
                borderRadius="md"
                px={2}
                py={1}
                h="auto"
                minH="24px"
                onClick={handleProcessTabClick}
                maxW="160px"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                gap={1}
              >
                <Text as="span" flexShrink={0}>{process!.emoji || "📋"}</Text>
                {process!.title.length > 18 ? process!.title.slice(0, 18) + "..." : process!.title}
              </Button>
            </HStack>
          </Flex>
          {/* Process content */}
          {processExpanded && (
            <Box overflow="auto" flex={1}>
              <ProcessPanel
                process={process!}
                currentStep={processCurrentStep!}
                steps={processSteps!}
              />
            </Box>
          )}
        </Flex>
      )}

      {/* ── Documents section ── */}
      <Flex
        flexDir="column"
        overflow="hidden"
        flex={docsExpanded && hasArtifacts && active ? 1 : undefined}
        flexShrink={docsExpanded && hasArtifacts && active ? undefined : 0}
      >
        {/* Document tab bar */}
        <Flex px={3} py={3.5} align="center" gap={1} flexShrink={0}>
          <HStack gap={0.5} flex={1} overflow="hidden" flexWrap="wrap">
            {artifacts.map((a) => {
              const isActive = docsExpanded && a._id === activeArtifactId;
              return (
                <Button
                  key={a._id}
                  size="sm"
                  variant="ghost"
                  fontFamily="heading"
                  fontWeight={isActive ? "600" : "400"}
                  color={isActive ? "navy.500" : "charcoal.400"}
                  bg={isActive ? "gray.100" : "transparent"}
                  _hover={{ bg: "gray.100" }}
                  borderRadius="md"
                  px={2}
                  py={1}
                  h="auto"
                  minH="24px"
                  onClick={() => handleDocTabClick(a._id)}
                  maxW="140px"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  gap={1}
                >
                  <FiFileText size={12} style={{ flexShrink: 0 }} />
                  {a.title.length > 15 ? a.title.slice(0, 15) + "..." : a.title}
                </Button>
              );
            })}
          </HStack>
          <IconButton
            aria-label="Add document"
            size="xs"
            variant="ghost"
            color="charcoal.400"
            _hover={{ color: "violet.500" }}
            onClick={() => {
              onCreateArtifact();
              setDocsExpanded(true);
            }}
            flexShrink={0}
          >
            <FiPlus />
          </IconButton>
        </Flex>
        {/* Document content */}
        {docsExpanded && active && (
          <ArtifactEditor
            key={active._id}
            artifact={active}
            onSave={(updates) => onSave(active._id, updates)}
            onDelete={() => onDeleteArtifact(active._id)}
            onSyncChange={onSyncChange}
          />
        )}
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
            Makawulu updated the document
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
          placeholder="Your document will appear here..."
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
