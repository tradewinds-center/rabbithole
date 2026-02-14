"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Flex, Input, Text, Textarea, Button } from "@chakra-ui/react";

interface ArtifactPanelProps {
  title: string;
  content: string;
  lastEditedBy: string;
  onSave: (updates: { content?: string; title?: string }) => void;
  onSyncChange?: (synced: boolean) => void;
}

export function ArtifactPanel({
  title,
  content,
  lastEditedBy,
  onSave,
  onSyncChange,
}: ArtifactPanelProps) {
  const [localContent, setLocalContent] = useState(content);
  const [localTitle, setLocalTitle] = useState(title);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const lastKnownContentRef = useRef(content);
  const lastKnownTitleRef = useRef(title);
  const saveContentTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const saveTitleTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const isSynced = localContent === content && localTitle === title;

  // Report sync state changes to parent
  useEffect(() => {
    onSyncChange?.(isSynced);
  }, [isSynced, onSyncChange]);

  // Sync content from server when it changes externally (AI edits)
  useEffect(() => {
    if (content !== lastKnownContentRef.current) {
      const hasLocalEdits = localContent !== lastKnownContentRef.current;
      lastKnownContentRef.current = content;

      if (hasLocalEdits) {
        setShowUpdateBanner(true);
      } else {
        setLocalContent(content);
      }
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync title from server when it changes externally (AI rename)
  useEffect(() => {
    if (title !== lastKnownTitleRef.current) {
      lastKnownTitleRef.current = title;
      setLocalTitle(title);
    }
  }, [title]);

  // Debounced auto-save for content
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

  // Debounced auto-save for title
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setLocalTitle(newTitle);

    clearTimeout(saveTitleTimeoutRef.current);
    saveTitleTimeoutRef.current = setTimeout(() => {
      onSave({ title: newTitle });
      lastKnownTitleRef.current = newTitle;
    }, 500);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearTimeout(saveContentTimeoutRef.current);
      clearTimeout(saveTitleTimeoutRef.current);
    };
  }, []);

  const handleAcceptUpdate = () => {
    setLocalContent(content);
    lastKnownContentRef.current = content;
    setShowUpdateBanner(false);
  };

  const wordCount = localContent
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  return (
    <Flex
      flex={1}
      flexDir="column"
      overflow="hidden"
      bg="white"
    >
      {/* Editable title */}
      <Input
        value={localTitle}
        onChange={handleTitleChange}
        fontSize="lg"
        fontWeight="600"
        fontFamily="heading"
        color="navy.500"
        border="none"
        bg="transparent"
        px={6}
        pt={5}
        pb={1}
        h="auto"
        flexShrink={0}
        _focus={{ boxShadow: "none", outline: "none" }}
      />

      {/* Update banner (conflict — AI edited while scholar is typing) */}
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

      {/* Textarea body */}
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

      {/* Footer — word count */}
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
