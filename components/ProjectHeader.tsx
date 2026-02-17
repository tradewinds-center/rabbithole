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
import { FiMenu } from "react-icons/fi";
import { CloudCheck, SquaresFour, SidebarSimple } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AccountMenu } from "./AccountMenu";
import { DimensionPicker } from "./DimensionPicker";
import type { DimensionOption } from "./DimensionPicker";
import { DimensionEditModal } from "./DimensionEditModal";
import type { DimensionType, DimensionEditData } from "./DimensionEditModal";

interface ProjectHeaderProps {
  projectTitle: string;
  // Current unit selection
  unitId: string | null;
  // Unit options
  unitOptions: DimensionOption[];
  // Building block info from unit (read-only display)
  unitPersonaEmoji?: string | null;
  unitPersonaTitle?: string | null;
  unitPerspectiveIcon?: string | null;
  unitPerspectiveTitle?: string | null;
  unitProcessEmoji?: string | null;
  unitProcessTitle?: string | null;
  // Full entity data for edit modal (optional — only needed when edit is enabled)
  unitData?: DimensionEditData[];
  // Handlers
  onUnitChange: (id: string | null) => void;
  // Focus lock (optional)
  focusLock?: { unitId?: string | null } | null;
  // Hamburger menu to open sidebar drawer
  onMenuClick?: () => void;
  // Global sync state indicator
  isSynced?: boolean;
  // User info for top-right display
  userName?: string;
  userImage?: string;
  isTestMode?: boolean;
  isAdmin?: boolean;
  // Current process step key (e.g. "C", "R", "A") for badge display
  currentStepKey?: string | null;
  // Sign out
  onSignOut?: () => void;
  // Project rename
  onProjectRename?: (title: string) => void;
  // When true, unit picker is always locked (scholar can't change mid-project)
  readOnly?: boolean;
  // Right panel toggle
  showRightPanel?: boolean;
  onToggleRightPanel?: () => void;
  // Status orb data
  pulseScore?: number | null;
  lastMessageAt?: number | null;
}

export function ProjectHeader({
  projectTitle,
  unitId,
  unitOptions,
  unitPersonaEmoji,
  unitPersonaTitle,
  unitPerspectiveIcon,
  unitPerspectiveTitle,
  unitProcessEmoji,
  unitProcessTitle,
  unitData,
  onUnitChange,
  focusLock,
  readOnly,
  onMenuClick,
  isSynced,
  userName,
  userImage,
  isTestMode,
  isAdmin,
  onSignOut,
  currentStepKey,
  onProjectRename,
  showRightPanel,
  onToggleRightPanel,
  pulseScore,
  lastMessageAt,
}: ProjectHeaderProps) {
  // In test mode, ignore focus lock — the teacher IS the teacher
  const effectiveLock = isTestMode ? null : focusLock;
  // Lock the unit picker if focus-locked OR if readOnly (scholar can't switch mid-project)
  const unitLocked = readOnly || effectiveLock?.unitId != null;

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

  // Building block lists for unit edit modal (only queried in test mode)
  const personasList = useQuery(api.personas.list, isTestMode ? {} : "skip");
  const perspectivesList = useQuery(api.perspectives.list, isTestMode ? {} : "skip");
  const processesList = useQuery(api.processes.list, isTestMode ? {} : "skip");

  // Edit modal state
  const [editModal, setEditModal] = useState<{
    type: DimensionType;
    data: DimensionEditData | null;
  } | null>(null);

  const openEdit = (type: DimensionType, id: string | null, dataList?: DimensionEditData[]) => {
    if (!id || !dataList) return;
    const item = dataList.find((d) => d._id === id);
    if (item) setEditModal({ type, data: item });
  };

  // Build building-block chips for display
  const buildingBlocks: { label: string; emoji: string }[] = [];
  if (unitPersonaTitle) buildingBlocks.push({ label: unitPersonaTitle, emoji: unitPersonaEmoji || "🤖" });
  if (unitPerspectiveTitle) buildingBlocks.push({ label: unitPerspectiveTitle, emoji: unitPerspectiveIcon || "🔍" });
  if (unitProcessTitle) buildingBlocks.push({ label: unitProcessTitle, emoji: unitProcessEmoji || "📋" });

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
          <Text
            flex={1}
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
        )}

        {isSynced !== undefined && (
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

        {userName && onSignOut && (
          <AccountMenu
            userName={userName}
            userImage={userImage}
            pulseScore={pulseScore}
            lastMessageAt={lastMessageAt}
            onSignOut={onSignOut}
            isAdmin={isAdmin}
          />
        )}
      </Flex>

      {/* Row 2: Unit picker + building block chips */}
      <Flex px={5} pb={2} gap={4} align="center" flexWrap="wrap">
        <DimensionPicker
          label="Unit"
          defaultLabel="Independent Study"
          activeId={unitId}
          options={unitOptions}
          locked={unitLocked}
          lockedTitle={unitOptions.find((p) => p.id === unitId)?.title}
          onChange={onUnitChange}
          renderOption={(p) => `${p.emoji || "📚"} ${p.title}`}
          renderActive={() => {
            const a = unitOptions.find((p) => p.id === unitId);
            return a ? `${a.emoji || "📚"} ${a.title}` : null;
          }}
          onEdit={isTestMode && unitData ? (id) => openEdit("unit", id, unitData) : undefined}
        />

        {/* Read-only building block chips from current unit */}
        {buildingBlocks.length > 0 && (
          <HStack gap={2} flexWrap="wrap">
            {buildingBlocks.map((bb) => (
              <HStack
                key={bb.label}
                gap={1}
                px={2}
                py={0.5}
                bg="gray.100"
                borderRadius="md"
                fontSize="xs"
                fontFamily="heading"
                color="charcoal.500"
              >
                <Text>{bb.emoji}</Text>
                <Text>{bb.label}</Text>
              </HStack>
            ))}
          </HStack>
        )}

        {/* Process step badge */}
        {currentStepKey && unitProcessTitle && (
          <HStack
            gap={1}
            px={2}
            py={0.5}
            bg="violet.100"
            borderRadius="md"
            fontSize="xs"
            fontFamily="heading"
            color="violet.700"
            fontWeight="600"
          >
            <Text>Step: {currentStepKey}</Text>
          </HStack>
        )}

        {onToggleRightPanel && (
          <IconButton
            aria-label={showRightPanel ? "Hide side panel" : "Show side panel"}
            size="xs"
            variant="ghost"
            color={showRightPanel ? "violet.500" : "charcoal.400"}
            _hover={{ bg: "gray.100" }}
            onClick={onToggleRightPanel}
            ml="auto"
            flexShrink={0}
          >
            <SidebarSimple size={16} weight={showRightPanel ? "fill" : "regular"} />
          </IconButton>
        )}
      </Flex>

      {/* Dimension edit modal (shared) */}
      {editModal && (
        <DimensionEditModal
          open={!!editModal}
          onClose={() => setEditModal(null)}
          dimensionType={editModal.type}
          data={editModal.data}
          personas={personasList as { _id: string; title: string; emoji: string }[] | undefined}
          perspectives={perspectivesList as { _id: string; title: string; icon?: string }[] | undefined}
          processes={processesList as { _id: string; title: string; emoji?: string }[] | undefined}
        />
      )}
    </Box>
  );
}
