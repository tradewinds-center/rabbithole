"use client";

import { useState } from "react";
import {
  Box,
  Flex,
  HStack,
  Text,
  IconButton,
  Tooltip,
  Portal,
} from "@chakra-ui/react";
import { FiMenu } from "react-icons/fi";
import { CloudCheck, SquaresFour } from "@phosphor-icons/react";
import { Avatar } from "./Avatar";
import { DimensionPicker } from "./DimensionPicker";
import type { DimensionOption } from "./DimensionPicker";
import { DimensionEditModal } from "./DimensionEditModal";
import type { DimensionType, DimensionEditData } from "./DimensionEditModal";

interface FocusLock {
  personaId?: string | null;
  projectId?: string | null;
  perspectiveId?: string | null;
  processId?: string | null;
}

interface ChatHeaderProps {
  conversationTitle: string;
  // Current selections
  personaId: string | null;
  projectId: string | null;
  perspectiveId: string | null;
  processId: string | null;
  // Options
  personaOptions: DimensionOption[];
  projectOptions: DimensionOption[];
  perspectiveOptions: DimensionOption[];
  processOptions: DimensionOption[];
  // Full entity data for edit modal (optional — only needed when edit is enabled)
  personaData?: DimensionEditData[];
  projectData?: DimensionEditData[];
  perspectiveData?: DimensionEditData[];
  processData?: DimensionEditData[];
  // Handlers
  onPersonaChange: (id: string | null) => void;
  onProjectChange: (id: string | null) => void;
  onPerspectiveChange: (id: string | null) => void;
  onProcessChange: (id: string | null) => void;
  // Focus lock (optional)
  focusLock?: FocusLock | null;
  // Hamburger menu to open sidebar drawer
  onMenuClick?: () => void;
  // Global sync state indicator
  isSynced?: boolean;
  // User info for top-right display
  userName?: string;
  userImage?: string;
  isTestMode?: boolean;
  // Current process step key (e.g. "C", "R", "A") for badge display
  currentStepKey?: string | null;
}

export function ChatHeader({
  conversationTitle,
  personaId,
  projectId,
  perspectiveId,
  processId,
  personaOptions,
  projectOptions,
  perspectiveOptions,
  processOptions,
  personaData,
  projectData,
  perspectiveData,
  processData,
  onPersonaChange,
  onProjectChange,
  onPerspectiveChange,
  onProcessChange,
  focusLock,
  onMenuClick,
  isSynced,
  userName,
  userImage,
  isTestMode,
  currentStepKey,
}: ChatHeaderProps) {
  // In test mode, ignore focus lock — the teacher IS the teacher
  const effectiveLock = isTestMode ? null : focusLock;
  const personaLocked = effectiveLock?.personaId != null;
  const projectLocked = effectiveLock?.projectId != null;
  const perspectiveLocked = effectiveLock?.perspectiveId != null;
  const processLocked = effectiveLock?.processId != null;

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

  return (
    <Box
      bg="white"
      borderBottom="1px solid"
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

        <Text
          flex={1}
          fontWeight="600"
          fontFamily="heading"
          color="navy.500"
          fontSize="sm"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
        >
          {conversationTitle}
        </Text>

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

        {userName && (
          <HStack gap={2} flexShrink={0}>
            <Text
              fontSize="xs"
              color="charcoal.400"
              fontFamily="heading"
              display={{ base: "none", md: "block" }}
            >
              {userName}
            </Text>
            <Avatar size="xs" name={userName} src={userImage} />
          </HStack>
        )}
      </Flex>

      {/* Row 2: Dimension pickers */}
      <Flex px={5} pb={2} gap={7} align="center" flexWrap="wrap">
        <DimensionPicker
          label="Persona"
          defaultLabel="🤖 Makawulu"
          activeId={personaId}
          options={personaOptions}
          locked={personaLocked}
          lockedTitle={personaOptions.find((p) => p.id === personaId)?.title}
          onChange={onPersonaChange}
          renderOption={(p) => `${p.emoji || "🤖"} ${p.title}`}
          renderActive={() => {
            const a = personaOptions.find((p) => p.id === personaId);
            return a ? `${a.emoji} ${a.title}` : "🤖 Makawulu";
          }}
          onEdit={isTestMode && personaData ? (id) => openEdit("persona", id, personaData) : undefined}
        />
        <DimensionPicker
          label="Project"
          defaultLabel="None"
          activeId={projectId}
          options={projectOptions}
          locked={projectLocked}
          lockedTitle={projectOptions.find((p) => p.id === projectId)?.title}
          onChange={onProjectChange}
          renderOption={(p) => `📚 ${p.title}`}
          renderActive={() => {
            const a = projectOptions.find((p) => p.id === projectId);
            return a ? `📚 ${a.title}` : null;
          }}
          onEdit={isTestMode && projectData ? (id) => openEdit("project", id, projectData) : undefined}
        />
        <DimensionPicker
          label="Lens"
          defaultLabel="None"
          activeId={perspectiveId}
          options={perspectiveOptions}
          locked={perspectiveLocked}
          lockedTitle={perspectiveOptions.find((p) => p.id === perspectiveId)?.title}
          onChange={onPerspectiveChange}
          renderOption={(p) => `${p.icon || "🔍"} ${p.title}`}
          renderActive={() => {
            const a = perspectiveOptions.find((p) => p.id === perspectiveId);
            return a ? `${a.icon || "🔍"} ${a.title}` : null;
          }}
          onEdit={isTestMode && perspectiveData ? (id) => openEdit("perspective", id, perspectiveData) : undefined}
        />
        <DimensionPicker
          label="Process"
          defaultLabel="None"
          activeId={processId}
          options={processOptions}
          locked={processLocked}
          lockedTitle={processOptions.find((p) => p.id === processId)?.title}
          onChange={onProcessChange}
          renderOption={(p) => `${p.emoji || "📋"} ${p.title}`}
          renderActive={() => {
            const a = processOptions.find((p) => p.id === processId);
            return a ? `${a.emoji || "📋"} ${a.title}` : null;
          }}
          onEdit={isTestMode && processData ? (id) => openEdit("process", id, processData) : undefined}
          stepBadge={currentStepKey || undefined}
        />
      </Flex>

      {/* Dimension edit modal (shared) */}
      {editModal && (
        <DimensionEditModal
          open={!!editModal}
          onClose={() => setEditModal(null)}
          dimensionType={editModal.type}
          data={editModal.data}
        />
      )}
    </Box>
  );
}
