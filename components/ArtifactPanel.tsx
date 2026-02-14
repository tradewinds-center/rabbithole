"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Flex, Text, Textarea, Button } from "@chakra-ui/react";
import { FiSave } from "react-icons/fi";

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
  const [isDirty, setIsDirty] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const lastKnownContentRef = useRef(content);

  // Sync from server when content changes externally
  useEffect(() => {
    if (content !== lastKnownContentRef.current) {
      lastKnownContentRef.current = content;
      if (isDirty) {
        // Scholar has unsaved edits and AI updated — show conflict banner
        setShowUpdateBanner(true);
      } else {
        // No local edits — silently sync
        setLocalContent(content);
      }
    }
  }, [content, isDirty]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalContent(e.target.value);
    setIsDirty(true);
  };

  const handleSave = () => {
    onSave(localContent);
    setIsDirty(false);
    lastKnownContentRef.current = localContent;
    setShowUpdateBanner(false);
  };

  const handleAcceptUpdate = () => {
    setLocalContent(content);
    setIsDirty(false);
    lastKnownContentRef.current = content;
    setShowUpdateBanner(false);
  };

  const wordCount = localContent
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  return (
    <Box
      w="320px"
      minW="320px"
      bg="gray.50"
      borderLeft="1px solid"
      borderColor="gray.200"
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
        <Text
          fontSize="xs"
          fontFamily="heading"
          color={lastEditedBy === "ai" ? "violet.500" : "charcoal.400"}
          flexShrink={0}
          ml={2}
        >
          {lastEditedBy === "ai" ? "AI" : "You"}
        </Text>
      </Flex>

      {/* Update banner (conflict) */}
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
          fontSize="sm"
          lineHeight="1.6"
          border="none"
          bg="white"
          borderRadius="md"
          p={3}
          _focus={{ boxShadow: "none", outline: "none" }}
        />
      </Box>

      {/* Footer */}
      <Flex
        px={3}
        py={2}
        borderTop="1px solid"
        borderColor="gray.200"
        align="center"
        justify="space-between"
        flexShrink={0}
      >
        <Text fontSize="xs" fontFamily="heading" color="charcoal.300">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </Text>
        <Button
          size="xs"
          bg="violet.500"
          color="white"
          _hover={{ bg: "violet.600" }}
          disabled={!isDirty}
          onClick={handleSave}
        >
          <FiSave />
          Save
        </Button>
      </Flex>
    </Box>
  );
}
