"use client";

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Breadcrumb,
  Flex,
  HStack,
  Text,
  IconButton,
  Tooltip,
  Portal,
  Input,
} from "@chakra-ui/react";
import { FiMenu, FiPaperclip, FiPlus } from "react-icons/fi";
import { CloudCheck, SidebarSimple } from "@phosphor-icons/react";
import { AccountMenu } from "./AccountMenu";
import { AppHeader } from "./AppHeader";
import { AppLogo } from "./AppLogo";
import { Avatar } from "./Avatar";

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
  isTestMode?: boolean;
  onSignOut?: () => void;
  onProjectRename?: (title: string) => void;
  showRightPanel?: boolean;
  onToggleRightPanel?: () => void;
  mobileAttachmentCount?: number;
  onMobileAttachmentClick?: () => void;
  isMobile?: boolean;
  pulseScore?: number | null;
  lastMessageAt?: number | null;
  isRemoteMode?: boolean;
  scholarName?: string | null;
  scholarImage?: string | null;
  remoteUserId?: string | null;
  onNewProject?: () => void;
}

export function ProjectHeader({
  projectTitle,
  unitId,
  unitOptions,
  onMenuClick,
  isSynced,
  isTestMode,
  onSignOut,
  onProjectRename,
  showRightPanel,
  onToggleRightPanel,
  mobileAttachmentCount,
  onMobileAttachmentClick,
  isMobile,
  pulseScore,
  lastMessageAt,
  isRemoteMode,
  scholarName,
  scholarImage,
  remoteUserId,
  onNewProject,
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
    <AppHeader>
      <Flex flex={1} align="center" gap={3}>
        {/* Remote mode: breadcrumb navigation */}
        {isRemoteMode && scholarName ? (
          <Breadcrumb.Root>
            <Breadcrumb.List fontFamily="heading" fontSize="sm" gap={2.5}>
              <Breadcrumb.Item>
                <Breadcrumb.Link href="/teacher" css={{ display: "flex", alignItems: "center" }}>
                  <AppLogo variant="dark" size={24} />
                </Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Separator color="charcoal.300" />
              <Breadcrumb.Item>
                <Breadcrumb.Link
                  href={`/scholar?remote=${remoteUserId}`}
                  css={{ display: "flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
                  _hover={{ color: "navy.500" }}
                  color="charcoal.500"
                  fontWeight="500"
                >
                  <Avatar size="xs" name={scholarName} src={scholarImage || undefined} />
                  {scholarName}
                </Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Separator color="charcoal.300" />
              <Breadcrumb.Item>
                <Breadcrumb.CurrentLink
                  fontWeight="600"
                  color="navy.500"
                  cursor={onProjectRename ? "text" : "default"}
                  onClick={onProjectRename ? () => setIsEditingTitle(true) : undefined}
                  _hover={onProjectRename ? { color: "violet.500" } : undefined}
                >
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
                      fontWeight="600"
                      fontFamily="heading"
                      color="navy.500"
                      fontSize="sm"
                      size="sm"
                      variant="flushed"
                      borderColor="violet.300"
                      px={0}
                      w="auto"
                      minW="120px"
                    />
                  ) : projectTitle}
                </Breadcrumb.CurrentLink>
              </Breadcrumb.Item>
            </Breadcrumb.List>
          </Breadcrumb.Root>
        ) : (
          <>
            {/* Normal mode: hamburger + title */}
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
          </>
        )}

        {/* Spacer to push right-side controls to edge */}
        {isRemoteMode && <Box flex={1} />}

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

        {isTestMode && !isRemoteMode && (
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
              <Text>Dashboard</Text>
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

        {onNewProject && !isRemoteMode && (
          <Tooltip.Root openDelay={400} closeDelay={0}>
            <Tooltip.Trigger asChild>
              <IconButton
                aria-label="New project"
                size="sm"
                variant="ghost"
                color="charcoal.400"
                _hover={{ bg: "gray.100", color: "violet.500" }}
                onClick={onNewProject}
                flexShrink={0}
              >
                <FiPlus />
              </IconButton>
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Positioner>
                <Tooltip.Content>New project</Tooltip.Content>
              </Tooltip.Positioner>
            </Portal>
          </Tooltip.Root>
        )}

        {onSignOut && (
          <AccountMenu
            onSignOut={onSignOut}
            pulseScore={pulseScore}
            lastMessageAt={lastMessageAt}
          />
        )}
      </Flex>
    </AppHeader>
  );
}
