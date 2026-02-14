"use client";

import { HStack, Text, Menu, Portal, Tooltip, Box } from "@chakra-ui/react";
import { FiChevronDown, FiLock } from "react-icons/fi";
import { Scroll } from "@phosphor-icons/react";

export interface DimensionOption {
  id: string;
  title: string;
  emoji?: string | null;
  icon?: string | null;
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

export interface DimensionPickerProps {
  label: string;
  defaultLabel: string;
  activeId: string | null;
  options: DimensionOption[];
  locked?: boolean;
  lockedTitle?: string;
  onChange: (id: string | null) => void;
  renderOption: (option: DimensionOption) => string;
  renderActive: () => string | null;
  /** Called when the edit pencil is clicked. Only shown when provided and a dimension is active. */
  onEdit?: () => void;
}

export function DimensionPicker({
  label,
  defaultLabel,
  activeId,
  options,
  locked = false,
  lockedTitle,
  onChange,
  renderOption,
  renderActive,
  onEdit,
}: DimensionPickerProps) {
  const activeLabel = renderActive();
  const displayLabel = activeLabel || defaultLabel;
  const isActive = !!activeLabel;

  const chipContent = (
    <HStack
      gap={1}
      bg={isActive ? "violet.50" : "gray.50"}
      color={isActive ? "violet.700" : "charcoal.500"}
      px={2.5}
      py={1}
      borderRadius="full"
      fontSize="xs"
      fontFamily="heading"
      fontWeight={isActive ? "600" : "400"}
      cursor={locked ? "default" : "pointer"}
      _hover={locked ? undefined : { bg: isActive ? "violet.100" : "gray.100" }}
      transition="background 0.15s"
      title={locked ? `${lockedTitle || label} (locked by teacher)` : undefined}
    >
      <Text>{displayLabel}</Text>
      {locked ? <FiLock size={10} /> : <FiChevronDown size={12} />}
    </HStack>
  );

  const editButton = onEdit && isActive ? (
    <Tooltip.Root openDelay={300} closeDelay={0}>
      <Tooltip.Trigger asChild>
        <Box
          as="button"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="charcoal.400"
          cursor="pointer"
          borderRadius="sm"
          p={0.5}
          _hover={{ color: "violet.500" }}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Scroll size={13} weight="bold" />
        </Box>
      </Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content>Edit Prompt</Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  ) : null;

  if (locked) {
    return (
      <HStack gap={1.5}>
        <Text fontSize="xs" fontFamily="heading" color="charcoal.500">{label}</Text>
        {chipContent}
        {editButton}
      </HStack>
    );
  }

  return (
    <HStack gap={1.5}>
      <Text fontSize="xs" fontFamily="heading" color="charcoal.500">{label}</Text>
      <Menu.Root
        onSelect={({ value }) => onChange(value === "none" ? null : value)}
      >
        <Menu.Trigger asChild>
          {chipContent}
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content
              css={{ padding: "0.5rem", minWidth: "200px" }}
            >
              <Menu.Item
                value="none"
                css={!activeId ? activeMenuItemCss : menuItemCss}
              >
                {defaultLabel}
              </Menu.Item>
              {options.map((p) => (
                <Menu.Item
                  key={p.id}
                  value={p.id}
                  css={activeId === p.id ? activeMenuItemCss : menuItemCss}
                >
                  {renderOption(p)}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
      {editButton}
    </HStack>
  );
}
