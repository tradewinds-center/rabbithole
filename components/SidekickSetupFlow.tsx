"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Dialog,
  Portal,
  SimpleGrid,
  Spinner,
} from "@chakra-ui/react";
import { SidekickAvatar } from "./SidekickAvatar";

const COLOR_OPTIONS = [
  { label: "Ocean Blue", value: "ocean blue" },
  { label: "Forest Green", value: "forest green" },
  { label: "Warm Orange", value: "warm orange" },
  { label: "Sunset Purple", value: "sunset purple" },
  { label: "Coral Red", value: "coral red" },
  { label: "Golden Yellow", value: "golden yellow" },
  { label: "Teal", value: "teal" },
  { label: "Deep Navy", value: "deep navy" },
];

const COLOR_HEX: Record<string, string> = {
  "ocean blue": "#2B6CB0",
  "forest green": "#276749",
  "warm orange": "#DD6B20",
  "sunset purple": "#805AD5",
  "coral red": "#E53E3E",
  "golden yellow": "#D69E2E",
  "teal": "#319795",
  "deep navy": "#2A4365",
};

const THINKING_WORDS = [
  "curious", "creative", "careful", "bold", "deep", "fast", "playful", "analytical",
];

interface SidekickSetupFlowProps {
  open: boolean;
  onClose: () => void;
}

export function SidekickSetupFlow({ open, onClose }: SidekickSetupFlowProps) {
  const [step, setStep] = useState(0);
  const [animal, setAnimal] = useState("");
  const [color, setColor] = useState("");
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const upsertSidekick = useMutation(api.sidekicks.upsert);
  const sidekick = useQuery(api.sidekicks.getForScholar, {});

  const handleAnimalNext = () => {
    if (animal.trim()) setStep(1);
  };

  const handleColorNext = async () => {
    if (!color) return;
    // Save animal + color, trigger generation
    setIsSaving(true);
    try {
      await upsertSidekick({ animal: animal.trim().toLowerCase(), color });
      setStep(2);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameComplete = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await upsertSidekick({ name: name.trim(), setupComplete: true });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => { if (!e.open) onClose(); }}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="md" mx={4} borderRadius="xl" overflow="hidden" p={0}>
            <Box p={6}>
              {step === 0 && (
                <VStack gap={4} align="stretch">
                  <Text fontFamily="heading" fontSize="xl" fontWeight="700" color="navy.500" textAlign="center">
                    Meet your Sidekick
                  </Text>
                  <Text fontFamily="body" fontSize="sm" color="charcoal.400" textAlign="center">
                    Your Sidekick is an AI companion who will get to know you as a person and learner. First, let&apos;s design them!
                  </Text>
                  <Box>
                    <Text fontFamily="heading" fontSize="sm" fontWeight="600" color="navy.500" mb={2}>
                      What&apos;s your favorite animal or creature?
                    </Text>
                    <Input
                      value={animal}
                      onChange={(e) => setAnimal(e.target.value)}
                      placeholder="e.g., fox, owl, seahorse, dragon..."
                      fontFamily="body"
                      size="lg"
                      onKeyDown={(e) => e.key === "Enter" && handleAnimalNext()}
                      autoFocus
                    />
                  </Box>
                  <Button
                    onClick={handleAnimalNext}
                    disabled={!animal.trim()}
                    bg="violet.500"
                    color="white"
                    fontFamily="heading"
                    _hover={{ bg: "violet.600" }}
                  >
                    Next
                  </Button>
                </VStack>
              )}

              {step === 1 && (
                <VStack gap={4} align="stretch">
                  <Text fontFamily="heading" fontSize="xl" fontWeight="700" color="navy.500" textAlign="center">
                    Pick a color that feels like you
                  </Text>
                  <SimpleGrid columns={4} gap={3}>
                    {COLOR_OPTIONS.map((c) => (
                      <Box
                        key={c.value}
                        as="button"
                        w="full"
                        aspectRatio={1}
                        borderRadius="xl"
                        bg={COLOR_HEX[c.value] ?? "gray.300"}
                        border="3px solid"
                        borderColor={color === c.value ? "navy.500" : "transparent"}
                        cursor="pointer"
                        transition="all 0.15s"
                        _hover={{ transform: "scale(1.05)" }}
                        onClick={() => setColor(c.value)}
                        title={c.label}
                      />
                    ))}
                  </SimpleGrid>
                  {color && (
                    <Text fontFamily="heading" fontSize="sm" color="charcoal.500" textAlign="center">
                      {COLOR_OPTIONS.find((c) => c.value === color)?.label}
                    </Text>
                  )}
                  <HStack gap={2}>
                    <Button variant="ghost" onClick={() => setStep(0)} fontFamily="heading" flex={1}>
                      Back
                    </Button>
                    <Button
                      onClick={handleColorNext}
                      disabled={!color || isSaving}
                      bg="violet.500"
                      color="white"
                      fontFamily="heading"
                      _hover={{ bg: "violet.600" }}
                      flex={1}
                    >
                      {isSaving ? <Spinner size="sm" /> : "Next"}
                    </Button>
                  </HStack>
                </VStack>
              )}

              {step === 2 && (
                <VStack gap={4} align="stretch">
                  <Text fontFamily="heading" fontSize="xl" fontWeight="700" color="navy.500" textAlign="center">
                    Name your Sidekick
                  </Text>
                  <Flex justify="center">
                    <SidekickAvatar size={80} />
                  </Flex>
                  <Text fontFamily="body" fontSize="sm" color="charcoal.400" textAlign="center">
                    Your {animal} sidekick needs a name!
                  </Text>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Scout, Luna, Kai..."
                    fontFamily="body"
                    size="lg"
                    onKeyDown={(e) => e.key === "Enter" && handleNameComplete()}
                    autoFocus
                  />
                  <HStack gap={2} flexWrap="wrap" justify="center">
                    {THINKING_WORDS.slice(0, 4).map((w) => (
                      <Box
                        key={w}
                        as="button"
                        px={3}
                        py={1}
                        borderRadius="full"
                        bg="violet.50"
                        color="violet.600"
                        fontFamily="heading"
                        fontSize="xs"
                        fontWeight="500"
                        cursor="pointer"
                        _hover={{ bg: "violet.100" }}
                        onClick={() => setName(w.charAt(0).toUpperCase() + w.slice(1))}
                      >
                        {w.charAt(0).toUpperCase() + w.slice(1)}
                      </Box>
                    ))}
                  </HStack>
                  <Button
                    onClick={handleNameComplete}
                    disabled={!name.trim() || isSaving}
                    bg="violet.500"
                    color="white"
                    fontFamily="heading"
                    _hover={{ bg: "violet.600" }}
                  >
                    {isSaving ? <Spinner size="sm" /> : "Done!"}
                  </Button>
                </VStack>
              )}
            </Box>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
