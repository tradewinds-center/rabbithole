"use client";

import { useState, useRef, useEffect } from "react";
import { Box, Flex, Text, Button, IconButton, Textarea, HStack } from "@chakra-ui/react";
import { FiCode, FiEye, FiTrash2, FiRefreshCw } from "react-icons/fi";

interface CodeArtifactViewerProps {
  artifact: {
    _id: string;
    title: string;
    content: string;
    lastEditedBy: string;
    language?: string;
  };
  onSave: (updates: { content?: string; title?: string }) => void;
  onDelete?: () => void;
  onSyncChange?: (synced: boolean) => void;
}

export function CodeArtifactViewer({
  artifact,
  onSave,
  onDelete,
  onSyncChange,
}: CodeArtifactViewerProps) {
  const [view, setView] = useState<"preview" | "code">("preview");
  const [localCode, setLocalCode] = useState(artifact.content);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const lastKnownContentRef = useRef(artifact.content);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [previewKey, setPreviewKey] = useState(0);

  const isSynced = localCode === artifact.content;

  useEffect(() => {
    onSyncChange?.(isSynced);
  }, [isSynced, onSyncChange]);

  // Detect external updates (from AI)
  useEffect(() => {
    if (artifact.content !== lastKnownContentRef.current) {
      const hasLocalEdits = localCode !== lastKnownContentRef.current;
      lastKnownContentRef.current = artifact.content;
      if (hasLocalEdits) {
        setShowUpdateBanner(true);
      } else {
        setLocalCode(artifact.content);
      }
    }
  }, [artifact.content]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setLocalCode(newCode);
    setShowUpdateBanner(false);
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      onSave({ content: newCode });
      lastKnownContentRef.current = newCode;
    }, 800);
  };

  const handleAcceptUpdate = () => {
    setLocalCode(artifact.content);
    lastKnownContentRef.current = artifact.content;
    setShowUpdateBanner(false);
  };

  const refreshPreview = () => setPreviewKey((k) => k + 1);

  useEffect(() => {
    return () => clearTimeout(saveTimeoutRef.current);
  }, []);

  return (
    <Flex flex={1} flexDir="column" overflow="hidden">
      {/* Toolbar */}
      <Flex
        align="center"
        px={3}
        py={2}
        gap={2}
        flexShrink={0}
        borderBottomWidth="1px"
        borderColor="gray.100"
      >
        <HStack gap={1} flex={1}>
          <Button
            size="xs"
            variant={view === "preview" ? "solid" : "ghost"}
            bg={view === "preview" ? "violet.500" : undefined}
            color={view === "preview" ? "white" : "charcoal.500"}
            _hover={view === "preview" ? { bg: "violet.600" } : { bg: "gray.100" }}
            fontFamily="heading"
            onClick={() => setView("preview")}
          >
            <FiEye size={12} style={{ marginRight: "4px" }} />
            Preview
          </Button>
          <Button
            size="xs"
            variant={view === "code" ? "solid" : "ghost"}
            bg={view === "code" ? "violet.500" : undefined}
            color={view === "code" ? "white" : "charcoal.500"}
            _hover={view === "code" ? { bg: "violet.600" } : { bg: "gray.100" }}
            fontFamily="heading"
            onClick={() => setView("code")}
          >
            <FiCode size={12} style={{ marginRight: "4px" }} />
            Code
          </Button>
          {view === "preview" && (
            <IconButton
              aria-label="Refresh preview"
              size="xs"
              variant="ghost"
              color="charcoal.400"
              _hover={{ color: "violet.500" }}
              onClick={refreshPreview}
            >
              <FiRefreshCw size={12} />
            </IconButton>
          )}
        </HStack>
        <Text fontSize="xs" fontFamily="heading" color="charcoal.300">
          {artifact.language || "html"}
        </Text>
        {onDelete && (
          <IconButton
            aria-label="Delete"
            size="xs"
            variant="ghost"
            color="charcoal.300"
            _hover={{ color: "red.500" }}
            onClick={onDelete}
          >
            <FiTrash2 size={12} />
          </IconButton>
        )}
      </Flex>

      {showUpdateBanner && (
        <Flex px={4} py={2} bg="violet.50" align="center" justify="space-between" flexShrink={0}>
          <Text fontSize="xs" fontFamily="heading" color="violet.700">
            AI updated the code
          </Text>
          <Button size="xs" variant="outline" colorPalette="violet" onClick={handleAcceptUpdate}>
            Accept
          </Button>
        </Flex>
      )}

      {/* Content */}
      {view === "preview" ? (
        <Box flex={1} overflow="hidden" bg="white">
          <iframe
            key={previewKey}
            sandbox="allow-scripts"
            srcDoc={localCode}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "white",
            }}
            title={artifact.title}
          />
        </Box>
      ) : (
        <Box flex={1} overflow="hidden" p={2}>
          <Textarea
            value={localCode}
            onChange={handleCodeChange}
            fontFamily="monospace"
            fontSize="xs"
            lineHeight="1.5"
            resize="none"
            h="100%"
            bg="gray.900"
            color="green.300"
            border="none"
            borderRadius="md"
            p={3}
            spellCheck={false}
            _focus={{ boxShadow: "none", outline: "none" }}
          />
        </Box>
      )}
    </Flex>
  );
}
