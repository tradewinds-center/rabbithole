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
import { FiBook, FiChevronDown, FiEye } from "react-icons/fi";

interface DimensionOption {
  id: string;
  title: string;
  emoji?: string | null;
  icon?: string | null;
}

interface ChatHeaderProps {
  conversationTitle: string;
  // Current selections
  personaId: string | null;
  projectId: string | null;
  perspectiveId: string | null;
  // Options
  personaOptions: DimensionOption[];
  projectOptions: DimensionOption[];
  perspectiveOptions: DimensionOption[];
  // Handlers
  onPersonaChange: (id: string | null) => void;
  onProjectChange: (id: string | null) => void;
  onPerspectiveChange: (id: string | null) => void;
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
  personaOptions,
  projectOptions,
  perspectiveOptions,
  onPersonaChange,
  onProjectChange,
  onPerspectiveChange,
}: ChatHeaderProps) {
  const activePersona = personaOptions.find((p) => p.id === personaId);
  const activeProject = projectOptions.find((p) => p.id === projectId);
  const activePerspective = perspectiveOptions.find((p) => p.id === perspectiveId);

  // Build subtitle badges
  const badges: string[] = [];
  if (activeProject) badges.push(activeProject.title);
  if (activePerspective) badges.push(`${activePerspective.icon || ""} ${activePerspective.title}`.trim());

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

      {/* Perspective menu (right) */}
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
    </Flex>
  );
}
