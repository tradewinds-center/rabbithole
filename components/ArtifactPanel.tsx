"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Flex, Text, Textarea, Button, Spinner } from "@chakra-ui/react";
import { FiCheck } from "react-icons/fi";

interface ArtifactPanelProps {
  title: string;
  content: string;
  lastEditedBy: string;
  onSave: (content: string) => void;
}

export function ArtifactPanel({
  title,
  content,
  lastEditedBy,
  onSave,
}: ArtifactPanelProps) {
  const [localContent, setLocalContent] = useState(content);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const lastKnownContentRef = useRef(content);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync from server when content changes externally (AI edits)
  useEffect(() => {
    if (content !== lastKnownContentRef.current) {
      const hasLocalEdits = localContent !== lastKnownContentRef.current;
      lastKnownContentRef.current = content;

      if (hasLocalEdits) {
        // Scholar is mid-edit and AI pushed an update — show conflict
        setShowUpdateBanner(true);
      } else {
        // No local edits — silently sync
        setLocalContent(content);
      }
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save on every keystroke
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setLocalContent(newContent);
    setShowUpdateBanner(false);

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      onSave(newContent);
      lastKnownContentRef.current = newContent;
    }, 500);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearTimeout(saveTimeoutRef.current);
  }, []);

  const handleAcceptUpdate = () => {
    setLocalContent(content);
    lastKnownContentRef.current = content;
    setShowUpdateBanner(false);
  };

  const isSynced = localContent === content;

  const wordCount = localContent
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  return (
    <Box
      flex={1}
      bg="gray.50"
      display="flex"
      flexDir="column"
      overflow="hidden"
    >
      {/* Header */}
      <Flex
        px={3}
        py={2}
        borderBottom="1px solid"
        borderColor="gray.200"
        align="center"
        justify="space-between"
        flexShrink={0}
      >
        <Text
          fontSize="sm"
          fontWeight="600"
          fontFamily="heading"
          color="navy.500"
          truncate
        >
          {title}
        </Text>
        {/* Sync status indicator */}
        <Box flexShrink={0} ml={2}>
          {isSynced ? (
            <FiCheck color="var(--chakra-colors-green-500)" size={16} />
          ) : (
            <Spinner size="xs" color="charcoal.300" />
          )}
        </Box>
      </Flex>

      {/* Update banner (conflict — AI edited while scholar is typing) */}
      {showUpdateBanner && (
        <Flex
          px={3}
          py={2}
          bg="violet.50"
          borderBottom="1px solid"
          borderColor="violet.200"
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

      {/* Textarea body */}
      <Box flex={1} overflow="hidden" p={2}>
        <Textarea
          value={localContent}
          onChange={handleChange}
          placeholder="Your document will appear here..."
          resize="none"
          h="100%"
          fontFamily="body"
          fontSize="lg"
          lineHeight="1.6"
          border="none"
          bg="white"
          borderRadius="md"
          p={3}
          _focus={{ boxShadow: "none", outline: "none" }}
        />
      </Box>

      {/* Footer — word count only */}
      <Flex
        px={3}
        py={1}
        borderTop="1px solid"
        borderColor="gray.200"
        align="center"
        flexShrink={0}
      >
        <Text fontSize="xs" fontFamily="heading" color="charcoal.300">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </Text>
      </Flex>
    </Box>
  );
}
