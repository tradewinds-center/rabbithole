"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import {
  Box,
  Button,
  Dialog,
  Input,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react";
import { StyledDialogContent } from "@/components/ui/StyledDialogContent";

interface SetPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  username: string;
  requireCurrentPassword: boolean;
}

export function SetPasswordDialog({
  open,
  onClose,
  username,
  requireCurrentPassword,
}: SetPasswordDialogProps) {
  const { signIn, signOut } = useAuthActions();
  const deleteMyAuthAccounts = useMutation(api.users.deleteMyAuthAccounts);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const email = `${username}@local`;

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    setError("");

    if (newPassword.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setIsSubmitting(true);

    try {
      // If voluntary change, verify current password first
      if (requireCurrentPassword) {
        try {
          await signIn("password", { email, password: currentPassword, flow: "signIn" });
        } catch {
          setError("Current password is incorrect");
          setIsSubmitting(false);
          return;
        }
      }

      // Delete auth accounts (clears mustResetPassword flag too)
      await deleteMyAuthAccounts({});

      // Sign out current session
      await signOut();

      // Create new auth account with new password
      await signIn("password", { email, password: newPassword, flow: "signUp" });

      // Done — redirect to home to let normal routing take over
      reset();
      onClose();
      window.location.href = "/";
    } catch (err) {
      console.error("Password change failed:", err);
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open && !requireCurrentPassword) {
          // Non-dismissible for forced resets — do nothing
          return;
        }
        if (!e.open) {
          reset();
          onClose();
        }
      }}
      placement="center"
      closeOnInteractOutside={requireCurrentPassword}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <StyledDialogContent>
            <Dialog.Header px={6} pt={5} pb={2}>
              <Dialog.Title fontFamily="heading" fontSize="lg" color="navy.500">
                {requireCurrentPassword ? "Change Password" : "Set a New Password"}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body px={6} py={3}>
              <VStack gap={3} w="full">
                {!requireCurrentPassword && (
                  <Text fontSize="sm" fontFamily="body" color="charcoal.500">
                    Your teacher has reset your password. Please set a new one to continue.
                  </Text>
                )}

                {requireCurrentPassword && (
                  <Box w="full">
                    <Text fontSize="xs" fontFamily="heading" color="charcoal.400" mb={1} fontWeight="500">
                      Current Password
                    </Text>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      bg="gray.50"
                      border="1px solid"
                      borderColor="gray.300"
                      borderRadius="lg"
                      fontFamily="body"
                      h={10}
                      _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
                      _focusVisible={{ boxShadow: "none", outline: "none" }}
                      autoComplete="current-password"
                      autoFocus
                    />
                  </Box>
                )}

                <Box w="full">
                  <Text fontSize="xs" fontFamily="heading" color="charcoal.400" mb={1} fontWeight="500">
                    New Password
                  </Text>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    bg="gray.50"
                    border="1px solid"
                    borderColor="gray.300"
                    borderRadius="lg"
                    fontFamily="body"
                    h={10}
                    _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
                    _focusVisible={{ boxShadow: "none", outline: "none" }}
                    autoComplete="new-password"
                    autoFocus={!requireCurrentPassword}
                  />
                </Box>

                <Box w="full">
                  <Text fontSize="xs" fontFamily="heading" color="charcoal.400" mb={1} fontWeight="500">
                    Confirm New Password
                  </Text>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    bg="gray.50"
                    border="1px solid"
                    borderColor="gray.300"
                    borderRadius="lg"
                    fontFamily="body"
                    h={10}
                    _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
                    _focusVisible={{ boxShadow: "none", outline: "none" }}
                    autoComplete="new-password"
                  />
                </Box>

                {error && (
                  <Text fontSize="sm" color="red.500" fontFamily="body">
                    {error}
                  </Text>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer px={6} pb={5} pt={2} gap={2}>
              {requireCurrentPassword && (
                <Button
                  size="sm"
                  variant="ghost"
                  fontFamily="heading"
                  onClick={() => {
                    reset();
                    onClose();
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                bg="violet.500"
                color="white"
                _hover={{ bg: "violet.600" }}
                fontFamily="heading"
                onClick={handleSubmit}
                disabled={isSubmitting || !newPassword || !confirmPassword || (requireCurrentPassword && !currentPassword)}
              >
                {isSubmitting
                  ? "Saving..."
                  : requireCurrentPassword
                    ? "Change Password"
                    : "Set Password"}
              </Button>
            </Dialog.Footer>
          </StyledDialogContent>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
