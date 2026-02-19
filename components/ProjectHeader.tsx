"use client";

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Flex,
  HStack,
  Text,
  IconButton,
  Tooltip,
  Portal,
  Input,
} from "@chakra-ui/react";
import { FiMenu, FiPaperclip } from "react-icons/fi";
import { CloudCheck, SquaresFour, SidebarSimple } from "@phosphor-icons/react";
import { AccountMenu } from "./AccountMenu";

interface UnitInfo {
  id: string;
  title: string;
  emoji?: string | null;
}

interface ProjectHeaderProps {
  projectTitle: string;
  unitId: string | null;
  unitOptions: UnitInfo[];
  onMenuClick?: () => void;
  isSynced?: boolean;
  userName?: string;
  userImage?: string;
  isTestMode?: boolean;
  isAdmin?: boolean;
  onSignOut?: () => void;
  onProjectRename?: (title: string) => void;
  showRightPanel?: boolean;
  onToggleRightPanel?: () => void;
  mobileAttachmentCount?: number;
  onMobileAttachmentClick?: () => void;
  isMobile?: boolean;
  pulseScore?: number | null;
  lastMessageAt?: number | null;
}

export function ProjectHeader({
  projectTitle,
  unitId,
  unitOptions,
  onMenuClick,
  isSynced,
  userName,
  userImage,
  isTestMode,
  isAdmin,
  onSignOut,
  onProjectRename,
  showRightPanel,
  onToggleRightPanel,
  mobileAttachmentCount,
  onMobileAttachmentClick,
  isMobile,
  pulseScore,
  lastMessageAt,
}: ProjectHeaderProps) {
  // Inline title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(projectTitle);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditingTitle) setEditTitle(projectTitle);
  }, [projectTitle, isEditingTitle]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const commitTitle = () => {
    setIsEditingTitle(false);
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== projectTitle && onProjectRename) {
      onProjectRename(trimmed);
    }
  };

  return (
    <Box
      bg="white"
      borderBottom="0.5px solid"
      borderColor="gray.200"
      shadow="0 1px 3px rgba(0,0,0,0.06)"
    >
      {/* Row 1: Hamburger | Title | User info */}
      <Flex px={5} py={2} align="center" gap={3} minH="44px">
        {onMenuClick && (
          <IconButton
            aria-label="Open sidebar"
            size="sm"
            variant="ghost"
            color="charcoal.400"
            _hover={{ bg: "gray.100" }}
            onClick={onMenuClick}
          >
            <FiMenu />
          </IconButton>
        )}

        {isEditingTitle && onProjectRename ? (
          <Input
            ref={titleInputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") { setIsEditingTitle(false); setEditTitle(projectTitle); }
            }}
            flex={1}
            fontWeight="600"
            fontFamily="heading"
            color="navy.500"
            fontSize="sm"
            size="sm"
            variant="flushed"
            borderColor="violet.300"
            px={0}
          />
        ) : (
          <Box flex={1} minW={0}>
            <Text
              fontWeight="600"
              fontFamily="heading"
              color="navy.500"
              fontSize="sm"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
              cursor={onProjectRename ? "text" : "default"}
              onClick={onProjectRename ? () => setIsEditingTitle(true) : undefined}
              _hover={onProjectRename ? { color: "violet.500" } : undefined}
            >
              {projectTitle}
            </Text>
            {!isMobile && unitId && (() => {
              const activeUnit = unitOptions.find((u) => u.id === unitId);
              return activeUnit ? (
                <Text fontSize="xs" color="charcoal.400" fontFamily="heading" lineHeight="1.2" mt={0.5}>
                  {activeUnit.emoji || "📚"} {activeUnit.title}
                </Text>
              ) : null;
            })()}
          </Box>
        )}

        {!isMobile && isSynced !== undefined && (
          <Tooltip.Root openDelay={400} closeDelay={0}>
            <Tooltip.Trigger asChild>
              <Box flexShrink={0} cursor="default">
                <CloudCheck
                  size={18}
                  weight="regular"
                  color="var(--chakra-colors-charcoal-400)"
                />
              </Box>
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Positioner>
                <Tooltip.Content>
                  {isSynced ? "All changes saved" : "Saving..."}
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Portal>
          </Tooltip.Root>
        )}

        {isTestMode && (
          <a href="/teacher" style={{ textDecoration: "none", flexShrink: 0 }}>
            <HStack
              gap={1.5}
              color="charcoal.400"
              fontFamily="heading"
              fontSize="xs"
              fontWeight="500"
              px={2}
              py={1}
              borderRadius="md"
              _hover={{ bg: "gray.100", color: "navy.500" }}
              cursor="pointer"
            >
              <SquaresFour size={14} weight="bold" />
              <Text>Teacher Dashboard</Text>
            </HStack>
          </a>
        )}

        {onToggleRightPanel && (
          <IconButton
            aria-label={showRightPanel ? "Hide side panel" : "Show side panel"}
            size="xs"
            variant="ghost"
            color={showRightPanel ? "violet.500" : "charcoal.400"}
            _hover={{ bg: "gray.100" }}
            onClick={onToggleRightPanel}
            flexShrink={0}
          >
            <SidebarSimple size={16} weight={showRightPanel ? "fill" : "regular"} />
          </IconButton>
        )}

        {onMobileAttachmentClick && mobileAttachmentCount != null && mobileAttachmentCount > 0 && (
          <Box position="relative" flexShrink={0}>
            <IconButton
              aria-label="Attachments"
              size="xs"
              variant="ghost"
              color="charcoal.400"
              _hover={{ bg: "gray.100" }}
              onClick={onMobileAttachmentClick}
            >
              <FiPaperclip size={16} />
            </IconButton>
            <Box
              position="absolute"
              top="-2px"
              right="-2px"
              bg="violet.500"
              color="white"
              fontSize="2xs"
              fontFamily="heading"
              fontWeight="700"
              borderRadius="full"
              minW="16px"
              h="16px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              px={1}
              lineHeight={1}
            >
              {mobileAttachmentCount}
            </Box>
          </Box>
        )}

        {userName && onSignOut && (
          <AccountMenu
            userName={userName}
            userImage={userImage}
            pulseScore={pulseScore}
            lastMessageAt={lastMessageAt}
            onSignOut={onSignOut}
            isAdmin={isAdmin}
            isMobile={isMobile}
          />
        )}
      </Flex>
    </Box>
  );
}
