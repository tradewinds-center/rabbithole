"use client";

import { useState } from "react";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  Dialog,
  IconButton,
  Portal,
} from "@chakra-ui/react";
import { FiLock, FiX } from "react-icons/fi";

interface UnitOption {
  id: string;
  title: string;
  emoji?: string | null;
  description?: string | null;
}

interface UnitPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (unitId: string | null) => void;
  units: UnitOption[];
  focusLock?: { unitId?: string | null } | null;
  isCreating?: boolean;
}

export function UnitPickerDialog({
  open,
  onClose,
  onSelect,
  units,
  focusLock,
  isCreating = false,
}: UnitPickerDialogProps) {
  const lockedUnitId = focusLock?.unitId ?? null;
  const [selected, setSelected] = useState<string | null>(lockedUnitId);

  // Reset selection when dialog opens
  const handleOpenChange = (details: { open: boolean }) => {
    if (details.open) {
      setSelected(lockedUnitId);
    } else {
      onClose();
    }
  };

  const handleConfirm = () => {
    onSelect(selected);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={handleOpenChange}
      placement="center"
      motionPreset="slide-in-bottom"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="xl" mx={4} borderRadius="xl" overflow="hidden">
            <Dialog.Header px={6} pt={5} pb={2}>
              <Dialog.Title
                fontFamily="heading"
                fontWeight="700"
                color="navy.500"
                fontSize="lg"
                flex={1}
              >
                What would you like to work on?
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <IconButton
                  aria-label="Close"
                  size="sm"
                  variant="ghost"
                  color="charcoal.400"
                  _hover={{ bg: "gray.100" }}
                >
                  <FiX />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body px={6} py={3}>
              {/* Focus lock banner */}
              {lockedUnitId && (
                <HStack
                  gap={2}
                  bg="orange.50"
                  border="1px solid"
                  borderColor="orange.200"
                  borderRadius="lg"
                  px={3}
                  py={2}
                  mb={3}
                >
                  <FiLock size={14} color="var(--chakra-colors-orange-500)" />
                  <Text fontSize="xs" fontFamily="heading" color="orange.700" fontWeight="500">
                    Your teacher has set a focus
                  </Text>
                </HStack>
              )}

              <VStack gap={2} align="stretch" maxH="360px" overflowY="auto">
                {/* Focused unit first when focus lock is active */}
                {lockedUnitId && (() => {
                  const focusedUnit = units.find((u) => u.id === lockedUnitId);
                  return focusedUnit ? (
                    <UnitCard
                      key={focusedUnit.id}
                      emoji={focusedUnit.emoji || "📚"}
                      title={focusedUnit.title}
                      description={focusedUnit.description ?? undefined}
                      isSelected={selected === focusedUnit.id}
                      isDisabled={false}
                      onClick={() => setSelected(focusedUnit.id)}
                    />
                  ) : null;
                })()}

                {/* Independent Study option */}
                <UnitCard
                  emoji="📓"
                  title="Independent Study"
                  description="Explore any topic freely"
                  isSelected={selected === null}
                  isDisabled={!!lockedUnitId}
                  onClick={() => setSelected(null)}
                />

                {/* Remaining unit cards (skip focused unit if already shown) */}
                {units
                  .filter((unit) => !lockedUnitId || unit.id !== lockedUnitId)
                  .map((unit) => (
                    <UnitCard
                      key={unit.id}
                      emoji={unit.emoji || "📚"}
                      title={unit.title}
                      description={unit.description ?? undefined}
                      isSelected={selected === unit.id}
                      isDisabled={!!lockedUnitId && lockedUnitId !== unit.id}
                      onClick={() => setSelected(unit.id)}
                    />
                  ))}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer px={6} pb={5} pt={3}>
              <Button
                bg="violet.500"
                color="white"
                _hover={{ bg: "violet.700" }}
                fontFamily="heading"
                size="sm"
                onClick={handleConfirm}
                disabled={isCreating}
                loading={isCreating}
                loadingText="Creating..."
                w="full"
              >
                Start Project
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function UnitCard({
  emoji,
  title,
  description,
  isSelected,
  isDisabled,
  onClick,
}: {
  emoji: string;
  title: string;
  description?: string;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      px={3}
      py={2.5}
      borderRadius="lg"
      cursor={isDisabled ? "default" : "pointer"}
      opacity={isDisabled ? 0.4 : 1}
      bg={isSelected ? "violet.50" : "transparent"}
      _hover={isDisabled ? undefined : { bg: isSelected ? "violet.50" : "gray.50" }}
      transition="all 0.12s"
      onClick={isDisabled ? undefined : onClick}
    >
      <HStack gap={2.5} align="start">
        <Text fontSize="lg" lineHeight="1.3" flexShrink={0}>{emoji}</Text>
        <Box flex={1} minW={0}>
          <Text
            fontFamily="heading"
            fontWeight="600"
            color="navy.500"
            fontSize="sm"
          >
            {title}
          </Text>
          {description && (
            <Text
              fontSize="xs"
              color="charcoal.400"
              fontFamily="body"
              lineHeight="1.4"
              overflow="hidden"
              css={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {description}
            </Text>
          )}
        </Box>
      </HStack>
    </Box>
  );
}
