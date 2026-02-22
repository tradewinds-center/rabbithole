"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Input,
  Dialog,
  Portal,
  Tabs,
  Badge,
} from "@chakra-ui/react";
import { FiX, FiPlus, FiTrash2, FiCopy, FiCheck } from "react-icons/fi";

interface ParentAccessDialogProps {
  /** Scholar whose tokens to manage (teacher view) or undefined for self-service */
  scholarId?: string;
  scholarName: string;
  open: boolean;
  onClose: () => void;
  /** "teacher" = managing a scholar's tokens; "self" = managing your own */
  mode?: "teacher" | "self";
}

export function ParentAccessDialog({
  scholarId,
  scholarName,
  open,
  onClose,
  mode = "teacher",
}: ParentAccessDialogProps) {
  const isSelf = mode === "self";

  // Query tokens: self-service or for a specific scholar
  const selfTokens = useQuery(
    api.tokens.myTokens,
    isSelf ? {} : "skip"
  );
  const scholarTokens = useQuery(
    api.tokens.listForScholar,
    !isSelf && scholarId ? { scholarId: scholarId as Id<"users"> } : "skip"
  );
  const tokens = (isSelf ? selfTokens : scholarTokens) ?? [];

  const createMyToken = useMutation(api.tokens.createMyToken);
  const createForScholar = useMutation(api.tokens.createForScholar);
  const revokeToken = useMutation(api.tokens.revokeToken);

  const [label, setLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!label.trim()) return;
    setIsCreating(true);
    try {
      let result;
      if (isSelf) {
        result = await createMyToken({ label: label.trim() });
      } else {
        result = await createForScholar({
          scholarId: scholarId as Id<"users">,
          label: label.trim(),
        });
      }
      setNewToken(result.token);
      setLabel("");
    } catch (error) {
      console.error("Error creating token:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    try {
      await revokeToken({ tokenId: tokenId as Id<"tokens"> });
    } catch (error) {
      console.error("Error revoking token:", error);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const mcpUrl = newToken
    ? `https://learn.tradewinds.school/api/mcp?token=${newToken}`
    : "";

  const claudeDesktopConfig = newToken
    ? JSON.stringify(
        {
          mcpServers: {
            "tradewinds-learn": {
              type: "http",
              url: mcpUrl,
            },
          },
        },
        null,
        2
      )
    : "";

  const claudeCodeCmd = newToken
    ? `claude mcp add --transport http tradewinds-learn ${mcpUrl}`
    : "";

  const dialogTitle = isSelf ? "MCP Access" : `Parent Access — ${scholarName}`;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open) {
          setNewToken(null);
          onClose();
        }
      }}
      placement="center"
      motionPreset="slide-in-bottom"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="2xl" mx={4} borderRadius="xl" overflow="hidden">
            <Dialog.Header px={6} pt={5} pb={2}>
              <Dialog.Title
                fontFamily="heading"
                fontWeight="700"
                color="navy.500"
                fontSize="lg"
                flex={1}
              >
                {dialogTitle}
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

            <Dialog.Body px={6} py={4}>
              <VStack gap={5} align="stretch">
                {/* Existing tokens */}
                {tokens.length > 0 && (
                  <Box>
                    <Text
                      fontFamily="heading"
                      fontSize="xs"
                      fontWeight="600"
                      color="charcoal.400"
                      textTransform="uppercase"
                      letterSpacing="0.05em"
                      mb={2}
                    >
                      Active Tokens
                    </Text>
                    <VStack gap={2} align="stretch">
                      {tokens.map((t) => (
                        <HStack
                          key={t._id}
                          px={3}
                          py={2}
                          bg="gray.50"
                          borderRadius="md"
                          gap={3}
                        >
                          <Text
                            fontFamily="heading"
                            fontSize="sm"
                            fontWeight="500"
                            color="navy.500"
                            flex={1}
                          >
                            {t.label}
                          </Text>
                          <Text
                            fontSize="xs"
                            color="charcoal.300"
                            fontFamily="mono"
                          >
                            {t.token.slice(0, 8)}...
                          </Text>
                          <IconButton
                            aria-label="Copy token"
                            size="xs"
                            variant="ghost"
                            color="charcoal.400"
                            _hover={{ color: "violet.500", bg: "violet.50" }}
                            onClick={() =>
                              copyToClipboard(t.token, `token-${t._id}`)
                            }
                          >
                            {copiedField === `token-${t._id}` ? (
                              <FiCheck />
                            ) : (
                              <FiCopy />
                            )}
                          </IconButton>
                          <IconButton
                            aria-label="Revoke token"
                            size="xs"
                            variant="ghost"
                            color="charcoal.400"
                            _hover={{ color: "red.500", bg: "red.50" }}
                            onClick={() => handleRevoke(t._id)}
                          >
                            <FiTrash2 />
                          </IconButton>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                )}

                {/* Generate new token */}
                {!newToken && (
                  <Box>
                    <Text
                      fontFamily="heading"
                      fontSize="xs"
                      fontWeight="600"
                      color="charcoal.400"
                      textTransform="uppercase"
                      letterSpacing="0.05em"
                      mb={2}
                    >
                      Generate New Token
                    </Text>
                    <VStack gap={2} align="stretch">
                      <Input
                        size="sm"
                        placeholder={isSelf ? 'Label (e.g., "Claude Desktop", "Mom\'s MCP")' : 'Label (e.g., "Mom", "Dad", "Tutu")'}
                        fontFamily="heading"
                        fontSize="sm"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                      />
                      <Button
                        size="sm"
                        bg="violet.500"
                        color="white"
                        _hover={{ bg: "violet.600" }}
                        fontFamily="heading"
                        fontSize="sm"
                        disabled={!label.trim() || isCreating}
                        onClick={handleCreate}
                      >
                        <FiPlus style={{ marginRight: "4px" }} />
                        Generate Token
                      </Button>
                    </VStack>
                  </Box>
                )}

                {/* Setup instructions (shown after generating a token) */}
                {newToken && (
                  <Box>
                    <HStack mb={3} gap={2}>
                      <Badge
                        bg="green.100"
                        color="green.700"
                        fontFamily="heading"
                        fontSize="xs"
                      >
                        Token Created
                      </Badge>
                    </HStack>

                    <Box
                      mb={4}
                      px={3}
                      py={2}
                      bg="gray.50"
                      borderRadius="md"
                      fontFamily="mono"
                      fontSize="xs"
                      color="navy.500"
                      wordBreak="break-all"
                    >
                      <HStack justify="space-between" align="start">
                        <Text flex={1}>{newToken}</Text>
                        <IconButton
                          aria-label="Copy token"
                          size="xs"
                          variant="ghost"
                          color="charcoal.400"
                          _hover={{ color: "violet.500" }}
                          onClick={() => copyToClipboard(newToken, "new-token")}
                        >
                          {copiedField === "new-token" ? (
                            <FiCheck />
                          ) : (
                            <FiCopy />
                          )}
                        </IconButton>
                      </HStack>
                    </Box>

                    <Tabs.Root defaultValue="claude-desktop" variant="subtle" size="sm">
                      <Tabs.List gap={0} mb={3}>
                        <Tabs.Trigger
                          value="claude-desktop"
                          fontFamily="heading"
                          fontSize="xs"
                          px={3}
                          py={1.5}
                        >
                          Claude Desktop
                        </Tabs.Trigger>
                        <Tabs.Trigger
                          value="claude-code"
                          fontFamily="heading"
                          fontSize="xs"
                          px={3}
                          py={1.5}
                        >
                          Claude Code
                        </Tabs.Trigger>
                        <Tabs.Trigger
                          value="chatgpt"
                          fontFamily="heading"
                          fontSize="xs"
                          px={3}
                          py={1.5}
                        >
                          ChatGPT
                        </Tabs.Trigger>
                      </Tabs.List>

                      <Tabs.Content value="claude-desktop">
                        <VStack gap={2} align="stretch">
                          <Text
                            fontSize="xs"
                            color="charcoal.500"
                            fontFamily="heading"
                          >
                            Add to your Claude Desktop config
                            (Settings → Developer → Edit Config):
                          </Text>
                          <Box
                            position="relative"
                            bg="gray.50"
                            borderRadius="md"
                            p={3}
                          >
                            <Text
                              fontSize="xs"
                              fontFamily="mono"
                              color="navy.500"
                              whiteSpace="pre-wrap"
                              wordBreak="break-all"
                            >
                              {claudeDesktopConfig}
                            </Text>
                            <IconButton
                              aria-label="Copy config"
                              size="xs"
                              variant="ghost"
                              color="charcoal.400"
                              _hover={{ color: "violet.500" }}
                              position="absolute"
                              top={2}
                              right={2}
                              onClick={() =>
                                copyToClipboard(
                                  claudeDesktopConfig,
                                  "claude-desktop"
                                )
                              }
                            >
                              {copiedField === "claude-desktop" ? (
                                <FiCheck />
                              ) : (
                                <FiCopy />
                              )}
                            </IconButton>
                          </Box>
                        </VStack>
                      </Tabs.Content>

                      <Tabs.Content value="claude-code">
                        <VStack gap={2} align="stretch">
                          <Text
                            fontSize="xs"
                            color="charcoal.500"
                            fontFamily="heading"
                          >
                            Run this command in your terminal:
                          </Text>
                          <Box
                            position="relative"
                            bg="gray.50"
                            borderRadius="md"
                            p={3}
                          >
                            <Text
                              fontSize="xs"
                              fontFamily="mono"
                              color="navy.500"
                              whiteSpace="pre-wrap"
                              wordBreak="break-all"
                            >
                              {claudeCodeCmd}
                            </Text>
                            <IconButton
                              aria-label="Copy command"
                              size="xs"
                              variant="ghost"
                              color="charcoal.400"
                              _hover={{ color: "violet.500" }}
                              position="absolute"
                              top={2}
                              right={2}
                              onClick={() =>
                                copyToClipboard(claudeCodeCmd, "claude-code")
                              }
                            >
                              {copiedField === "claude-code" ? (
                                <FiCheck />
                              ) : (
                                <FiCopy />
                              )}
                            </IconButton>
                          </Box>
                        </VStack>
                      </Tabs.Content>

                      <Tabs.Content value="chatgpt">
                        <VStack gap={2} align="stretch">
                          <Text
                            fontSize="xs"
                            color="charcoal.500"
                            fontFamily="heading"
                          >
                            A Custom GPT will be set up for parents. When ready,
                            you&apos;ll get a link to share. The parent will enter
                            their token once in the GPT settings.
                          </Text>
                          <Text
                            fontSize="xs"
                            color="charcoal.400"
                            fontFamily="heading"
                            fontStyle="italic"
                          >
                            Coming soon — the REST API is already live for when
                            the GPT is created.
                          </Text>
                        </VStack>
                      </Tabs.Content>
                    </Tabs.Root>

                    <Button
                      size="sm"
                      variant="ghost"
                      color="charcoal.400"
                      fontFamily="heading"
                      fontSize="xs"
                      mt={3}
                      onClick={() => setNewToken(null)}
                    >
                      Done
                    </Button>
                  </Box>
                )}
              </VStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
