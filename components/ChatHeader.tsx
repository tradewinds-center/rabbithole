"use client";

import {
  Box,
  Flex,
  HStack,
  Text,
  Menu,
  Portal,
  IconButton,
} from "@chakra-ui/react";
import { FiBook, FiChevronDown, FiEye, FiLayers, FiLock } from "react-icons/fi";

interface DimensionOption {
  id: string;
  title: string;
  emoji?: string | null;
  icon?: string | null;
}

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
  // Handlers
  onPersonaChange: (id: string | null) => void;
  onProjectChange: (id: string | null) => void;
  onPerspectiveChange: (id: string | null) => void;
  onProcessChange: (id: string | null) => void;
  // Focus lock (optional)
  focusLock?: FocusLock | null;
}

const menuItemCss = {
  color: "charcoal.500",
  fontFamily: "var(--chakra-fonts-heading)",
  padding: "0.5rem 0.75rem",
  fontSize: "sm",
  "&[data-highlighted]": {
    background: "gray.100",
    color: "navy.500",
  },
};

const activeMenuItemCss = {
  ...menuItemCss,
  fontWeight: "600",
  color: "navy.500",
};

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
  onPersonaChange,
  onProjectChange,
  onPerspectiveChange,
  onProcessChange,
  focusLock,
}: ChatHeaderProps) {
  const personaLocked = focusLock?.personaId != null;
  const projectLocked = focusLock?.projectId != null;
  const perspectiveLocked = focusLock?.perspectiveId != null;
  const processLocked = focusLock?.processId != null;

  const activePersona = personaOptions.find((p) => p.id === personaId);
  const activeProject = projectOptions.find((p) => p.id === projectId);
  const activePerspective = perspectiveOptions.find((p) => p.id === perspectiveId);
  const activeProcess = processOptions.find((p) => p.id === processId);

  // Build subtitle badges
  const badges: string[] = [];
  if (activeProject) badges.push(activeProject.title);
  if (activePerspective) badges.push(`${activePerspective.icon || ""} ${activePerspective.title}`.trim());
  if (activeProcess) badges.push(`${activeProcess.emoji || "📋"} ${activeProcess.title}`.trim());

  return (
    <Flex
      px={4}
      py={2}
      bg="white"
      borderBottom="1px solid"
      borderColor="gray.200"
      align="center"
      gap={3}
      minH="56px"
    >
      {/* Persona Avatar (left) */}
      {personaLocked ? (
        <Box
          w={10}
          h={10}
          borderRadius="full"
          bg={activePersona ? "violet.100" : "gray.100"}
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
          position="relative"
          title={`${activePersona?.title || "Makawulu"} (locked by teacher)`}
        >
          <Text fontSize="xl" lineHeight={1}>
            {activePersona?.emoji || "🤖"}
          </Text>
          <Box position="absolute" bottom={-0.5} right={-0.5} bg="white" borderRadius="full" p={0.5}>
            <FiLock size={10} color="var(--chakra-colors-charcoal-400)" />
          </Box>
        </Box>
      ) : (
        <Menu.Root
          onSelect={({ value }) =>
            onPersonaChange(value === "none" ? null : value)
          }
        >
          <Menu.Trigger asChild>
            <Box
              w={10}
              h={10}
              borderRadius="full"
              bg={activePersona ? "violet.100" : "gray.100"}
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              _hover={{ bg: activePersona ? "violet.200" : "gray.200" }}
              flexShrink={0}
              title={activePersona ? activePersona.title : "Choose a persona"}
            >
              <Text fontSize="xl" lineHeight={1}>
                {activePersona?.emoji || "🤖"}
              </Text>
            </Box>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content
                css={{
                  padding: "0.5rem",
                  minWidth: "200px",
                }}
              >
                <Menu.Item
                  value="none"
                  css={!personaId ? activeMenuItemCss : menuItemCss}
                >
                  🤖 Makawulu (default)
                </Menu.Item>
                {personaOptions.map((p) => (
                  <Menu.Item
                    key={p.id}
                    value={p.id}
                    css={personaId === p.id ? activeMenuItemCss : menuItemCss}
                  >
                    {p.emoji} {p.title}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}

      {/* Title + badges (center) */}
      <Box flex={1} overflow="hidden">
        <Text
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
        {badges.length > 0 && (
          <Text
            fontSize="xs"
            color="charcoal.400"
            fontFamily="heading"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            {badges.join(" · ")}
          </Text>
        )}
      </Box>

      {/* Project menu (right) */}
      {projectLocked ? (
        <IconButton
          aria-label="Project (locked by teacher)"
          size="sm"
          variant="ghost"
          color="violet.500"
          cursor="default"
          title={`${activeProject?.title || "Project"} (locked by teacher)`}
        >
          <HStack gap={1}>
            <FiBook />
            <FiLock size={10} />
          </HStack>
        </IconButton>
      ) : (
        <Menu.Root
          onSelect={({ value }) =>
            onProjectChange(value === "none" ? null : value)
          }
        >
          <Menu.Trigger asChild>
            <IconButton
              aria-label="Select project"
              size="sm"
              variant="ghost"
              color={projectId ? "violet.500" : "charcoal.400"}
              _hover={{ bg: "gray.100" }}
            >
              <HStack gap={1}>
                <FiBook />
                <FiChevronDown size={12} />
              </HStack>
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content
                css={{
                  padding: "0.5rem",
                  minWidth: "200px",
                }}
              >
                <Menu.Item
                  value="none"
                  css={!projectId ? activeMenuItemCss : menuItemCss}
                >
                  No project
                </Menu.Item>
                {projectOptions.map((p) => (
                  <Menu.Item
                    key={p.id}
                    value={p.id}
                    css={projectId === p.id ? activeMenuItemCss : menuItemCss}
                  >
                    📚 {p.title}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}

      {/* Perspective menu (right) */}
      {perspectiveLocked ? (
        <IconButton
          aria-label="Perspective (locked by teacher)"
          size="sm"
          variant="ghost"
          color="violet.500"
          cursor="default"
          title={`${activePerspective?.title || "Perspective"} (locked by teacher)`}
        >
          <HStack gap={1}>
            <FiEye />
            <FiLock size={10} />
          </HStack>
        </IconButton>
      ) : (
        <Menu.Root
          onSelect={({ value }) =>
            onPerspectiveChange(value === "none" ? null : value)
          }
        >
          <Menu.Trigger asChild>
            <IconButton
              aria-label="Select perspective"
              size="sm"
              variant="ghost"
              color={perspectiveId ? "violet.500" : "charcoal.400"}
              _hover={{ bg: "gray.100" }}
            >
              <HStack gap={1}>
                <FiEye />
                <FiChevronDown size={12} />
              </HStack>
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content
                css={{
                  padding: "0.5rem",
                  minWidth: "220px",
                }}
              >
                <Menu.Item
                  value="none"
                  css={!perspectiveId ? activeMenuItemCss : menuItemCss}
                >
                  No lens
                </Menu.Item>
                {perspectiveOptions.map((p) => (
                  <Menu.Item
                    key={p.id}
                    value={p.id}
                    css={perspectiveId === p.id ? activeMenuItemCss : menuItemCss}
                  >
                    {p.icon || "🔍"} {p.title}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}

      {/* Process menu (right) */}
      {processLocked ? (
        <IconButton
          aria-label="Process (locked by teacher)"
          size="sm"
          variant="ghost"
          color="violet.500"
          cursor="default"
          title={`${activeProcess?.title || "Process"} (locked by teacher)`}
        >
          <HStack gap={1}>
            <FiLayers />
            <FiLock size={10} />
          </HStack>
        </IconButton>
      ) : (
        <Menu.Root
          onSelect={({ value }) =>
            onProcessChange(value === "none" ? null : value)
          }
        >
          <Menu.Trigger asChild>
            <IconButton
              aria-label="Select process"
              size="sm"
              variant="ghost"
              color={processId ? "violet.500" : "charcoal.400"}
              _hover={{ bg: "gray.100" }}
            >
              <HStack gap={1}>
                <FiLayers />
                <FiChevronDown size={12} />
              </HStack>
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content
                css={{
                  padding: "0.5rem",
                  minWidth: "200px",
                }}
              >
                <Menu.Item
                  value="none"
                  css={!processId ? activeMenuItemCss : menuItemCss}
                >
                  No process
                </Menu.Item>
                {processOptions.map((p) => (
                  <Menu.Item
                    key={p.id}
                    value={p.id}
                    css={processId === p.id ? activeMenuItemCss : menuItemCss}
                  >
                    {p.emoji || "📋"} {p.title}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}
    </Flex>
  );
}
