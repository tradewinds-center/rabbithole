"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FiX } from "react-icons/fi";

interface TimeLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  isActive: boolean;
  display: string;
  onSetLimit: (minutes: number, password: string) => Promise<void>;
  onClearLimit: (password: string) => Promise<void>;
}

export function TimeLimitModal({
  isOpen,
  onClose,
  isActive,
  display,
  onSetLimit,
  onClearLimit,
}: TimeLimitModalProps) {
  const [minutes, setMinutes] = useState("30");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear error when isActive changes (timer set/cleared from elsewhere)
  useEffect(() => { setError(""); }, [isActive]);

  // Clear password and error when modal opens/closes
  useEffect(() => {
    if (!isOpen) { setPassword(""); setError(""); }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSet = async () => {
    const mins = parseInt(minutes, 10);
    if (!mins || mins < 1) {
      setError("Enter a valid number of minutes.");
      return;
    }
    if (!password.trim()) {
      setError("Parent password is required.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await onSetLimit(mins, password.trim());
      setPassword("");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to set time limit.";
      setError(msg.includes("Incorrect") ? "Incorrect password." : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = async () => {
    if (!password.trim()) {
      setError("Parent password is required.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await onClearLimit(password.trim());
      setPassword("");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to clear time limit.";
      setError(msg.includes("Incorrect") ? "Incorrect password." : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={10001}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="blackAlpha.500"
      onClick={onClose}
    >
      <Box
        bg="white"
        borderRadius="xl"
        shadow="2xl"
        p={6}
        maxW="sm"
        w="full"
        mx={4}
        onClick={(e) => e.stopPropagation()}
      >
        <Flex justify="space-between" align="center" mb={4}>
          <Text fontFamily="heading" fontWeight="600" color="navy.500" fontSize="lg">
            Session Time Limit
          </Text>
          <Box as="button" onClick={onClose} color="charcoal.400" _hover={{ color: "charcoal.600" }}>
            <FiX size={20} />
          </Box>
        </Flex>

        {isActive ? (
          <VStack gap={4} align="stretch">
            <Box bg="orange.50" borderRadius="lg" p={4} textAlign="center">
              <Text fontFamily="heading" fontSize="2xl" color="orange.600" fontWeight="700">
                {display}
              </Text>
              <Text fontFamily="body" fontSize="sm" color="orange.500">
                remaining
              </Text>
            </Box>
            <Input
              type="password"
              placeholder="Parent password to remove"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleClear()}
              fontFamily="body"
              borderRadius="lg"
              _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
              _focusVisible={{ boxShadow: "none", outline: "none" }}
            />
            <Button
              bg="red.500"
              color="white"
              _hover={{ bg: "red.600" }}
              fontFamily="heading"
              borderRadius="lg"
              disabled={!password.trim() || isSubmitting}
              onClick={handleClear}
            >
              Remove Time Limit
            </Button>
          </VStack>
        ) : (
          <VStack gap={4} align="stretch">
            <Box>
              <Text fontFamily="heading" fontSize="sm" color="charcoal.500" mb={1}>
                Minutes
              </Text>
              <Input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                min={1}
                max={480}
                fontFamily="body"
                borderRadius="lg"
                textAlign="center"
                fontSize="lg"
                _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
                _focusVisible={{ boxShadow: "none", outline: "none" }}
              />
            </Box>
            <Box>
              <Text fontFamily="heading" fontSize="sm" color="charcoal.500" mb={1}>
                Parent Password
              </Text>
              <Input
                type="password"
                placeholder="Enter parent password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSet()}
                fontFamily="body"
                borderRadius="lg"
                _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
                _focusVisible={{ boxShadow: "none", outline: "none" }}
              />
            </Box>
            <Button
              bg="violet.500"
              color="white"
              _hover={{ bg: "violet.600" }}
              fontFamily="heading"
              borderRadius="lg"
              disabled={!password.trim() || !minutes || isSubmitting}
              onClick={handleSet}
            >
              Start Timer
            </Button>
          </VStack>
        )}

        {error && (
          <Text fontSize="sm" color="red.500" fontFamily="body" mt={3} textAlign="center">
            {error}
          </Text>
        )}
      </Box>
    </Box>
  );
}
