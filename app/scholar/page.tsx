"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Spinner,
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import {
  FiPlus,
  FiLogOut,
  FiMessageSquare,
  FiTrash2,
  FiMenu,
  FiX,
} from "react-icons/fi";
import { ChatInterface } from "@/components/ChatInterface";

export default function ScholarPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Remote mode: teacher viewing as a scholar
  const remoteUserId = searchParams.get("remote");
  const isRemoteMode = !!(remoteUserId && user && (user.role === "teacher" || user.role === "admin"));

  // Fetch conversations reactively via Convex
  const conversations = useQuery(
    api.conversations.list,
    isRemoteMode ? { userId: remoteUserId as Id<"users"> } : {}
  ) ?? [];

  // Fetch scholar info for remote mode banner
  const remoteUser = useQuery(
    api.users.getUser,
    isRemoteMode && remoteUserId ? { userId: remoteUserId as Id<"users"> } : "skip"
  );

  const createConversation = useMutation(api.conversations.create);
  const archiveConversation = useMutation(api.conversations.archive);

  // Redirect logic
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    // Only redirect teachers if NOT in remote mode
    if ((user.role === "teacher" || user.role === "admin") && !remoteUserId) {
      router.push("/teacher");
      return;
    }
  }, [user, isUserLoading, router, remoteUserId]);

  // Auto-select first conversation if none selected or current is not in list
  useEffect(() => {
    if (conversations.length === 0) {
      if (activeConversationId) setActiveConversationId(null);
      return;
    }
    const currentExists = conversations.some((c) => c._id === activeConversationId);
    if (!currentExists) {
      setActiveConversationId(conversations[0]._id);
    }
  }, [conversations, activeConversationId]);

  // Create new conversation
  const handleNewConversation = async () => {
    try {
      const result = await createConversation(
        isRemoteMode && remoteUserId ? { userId: remoteUserId as Id<"users"> } : {}
      );
      if (result) {
        setActiveConversationId(result.id as string);
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  // Archive conversation
  const handleArchiveConversation = async (id: string) => {
    try {
      await archiveConversation({ id: id as Id<"conversations"> });
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
    } catch (error) {
      console.error("Error archiving conversation:", error);
    }
  };

  if (isUserLoading || conversations === undefined) {
    return (
      <Flex
        minH="100vh"
        bg="gray.50"
        align="center"
        justify="center"
      >
        <Spinner size="xl" color="violet.500" />
      </Flex>
    );
  }

  const displayName = isRemoteMode ? (remoteUser?.name || "Scholar") : (user?.name || "Scholar");
  const displayImage = isRemoteMode ? (remoteUser?.image || undefined) : (user?.image || undefined);

  return (
    <Flex h="100vh" bg="gray.50">
      {/* Sidebar */}
      <Box
        w={isSidebarOpen ? { base: "full", md: "280px" } : "0"}
        bg="navy.500"
        position={{ base: "absolute", md: "relative" }}
        zIndex={20}
        h="full"
        overflow="hidden"
        transition="width 0.2s ease"
        display={isSidebarOpen ? "flex" : "none"}
        flexDir="column"
      >
        {/* Sidebar Header */}
        <Flex
          p={4}
          borderBottom="1px solid"
          borderColor="whiteAlpha.200"
          justify="space-between"
          align="center"
        >
          <HStack gap={3}>
            <Box
              w={10}
              h={10}
              borderRadius="full"
              bg="linear-gradient(135deg, #AD60BF 0%, #222656 100%)"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text
                fontSize="lg"
                fontWeight="bold"
                color="white"
                fontFamily="heading"
              >
                M
              </Text>
            </Box>
            <VStack gap={0} align="start">
              <Text
                color="white"
                fontWeight="600"
                fontFamily="heading"
                fontSize="lg"
              >
                Makawulu
              </Text>
              <Text color="whiteAlpha.700" fontSize="xs" fontFamily="heading">
                Learning AI
              </Text>
            </VStack>
          </HStack>
          <IconButton
            aria-label="Close sidebar"
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            display={{ base: "flex", md: "none" }}
            onClick={() => setIsSidebarOpen(false)}
          >
            <FiX />
          </IconButton>
        </Flex>

        {/* New Chat Button */}
        <Box p={3}>
          <Button
            w="full"
            size="md"
            bg="violet.500"
            color="white"
            _hover={{ bg: "violet.700" }}
            fontFamily="heading"
            onClick={handleNewConversation}
          >
            <FiPlus style={{ marginRight: "8px" }} />
            New Chat
          </Button>
        </Box>

        {/* Conversations List */}
        <VStack
          flex={1}
          overflowY="auto"
          p={2}
          gap={1}
          align="stretch"
        >
          {conversations.map((conv) => (
            <HStack
              key={conv._id}
              p={3}
              borderRadius="lg"
              cursor="pointer"
              bg={activeConversationId === conv._id ? "whiteAlpha.200" : "transparent"}
              _hover={{ bg: "whiteAlpha.100" }}
              onClick={() => setActiveConversationId(conv._id)}
              justify="space-between"
            >
              <HStack gap={3} flex={1} overflow="hidden">
                <FiMessageSquare color="white" opacity={0.7} />
                <Text
                  color="white"
                  fontSize="sm"
                  fontFamily="heading"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {conv.title}
                </Text>
              </HStack>
              <IconButton
                aria-label="Archive"
                size="xs"
                variant="ghost"
                color="white"
                opacity={0.5}
                _hover={{ opacity: 1, bg: "whiteAlpha.200" }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchiveConversation(conv._id);
                }}
              >
                <FiTrash2 />
              </IconButton>
            </HStack>
          ))}
          {conversations.length === 0 && (
            <Text
              color="whiteAlpha.500"
              fontSize="sm"
              fontFamily="heading"
              textAlign="center"
              py={4}
            >
              No conversations yet
            </Text>
          )}
        </VStack>

        {/* User Section */}
        <Box p={3} borderTop="1px solid" borderColor="whiteAlpha.200">
          <HStack justify="space-between">
            <HStack gap={3}>
              <Avatar
                size="sm"
                name={displayName}
                src={displayImage}
              />
              <VStack gap={0} align="start">
                <Text
                  color="white"
                  fontSize="sm"
                  fontFamily="heading"
                  fontWeight="500"
                >
                  {displayName}
                </Text>
                <Text color="whiteAlpha.600" fontSize="xs" fontFamily="heading">
                  {isRemoteMode ? "Scholar (Remote)" : "Scholar"}
                </Text>
              </VStack>
            </HStack>
            {!isRemoteMode && (
              <IconButton
                aria-label="Sign out"
                size="sm"
                variant="ghost"
                color="white"
                _hover={{ bg: "whiteAlpha.200" }}
                onClick={() => signOut()}
              >
                <FiLogOut />
              </IconButton>
            )}
          </HStack>
        </Box>
      </Box>

      {/* Main Chat Area */}
      <Flex flex={1} flexDir="column" overflow="hidden">
        {/* Mobile Header */}
        <Flex
          display={{ base: "flex", md: "none" }}
          p={3}
          bg="white"
          borderBottom="1px solid"
          borderColor="gray.200"
          align="center"
          gap={3}
        >
          <IconButton
            aria-label="Open sidebar"
            variant="ghost"
            onClick={() => setIsSidebarOpen(true)}
          >
            <FiMenu />
          </IconButton>
          <Text fontFamily="heading" fontWeight="600" color="navy.500">
            Makawulu
          </Text>
        </Flex>

        {/* Chat Interface */}
        {activeConversationId ? (
          <ChatInterface
            conversationId={activeConversationId}
            onConversationUpdate={() => {}}
          />
        ) : (
          <Flex
            flex={1}
            align="center"
            justify="center"
            flexDir="column"
            gap={4}
            p={8}
          >
            <Box
              w={24}
              h={24}
              borderRadius="full"
              bg="linear-gradient(135deg, #AD60BF 0%, #222656 100%)"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text
                fontSize="4xl"
                fontWeight="bold"
                color="white"
                fontFamily="heading"
              >
                M
              </Text>
            </Box>
            <VStack gap={2}>
              <Text
                fontSize="2xl"
                fontWeight="600"
                fontFamily="heading"
                color="navy.500"
              >
                Welcome to Makawulu
              </Text>
              <Text
                color="charcoal.400"
                fontFamily="body"
                textAlign="center"
                maxW="md"
              >
                Your AI learning companion. Start a new conversation to explore
                ideas, ask questions, and dive deep into any topic that sparks
                your curiosity.
              </Text>
            </VStack>
            <Button
              size="lg"
              bg="violet.500"
              color="white"
              _hover={{ bg: "violet.700" }}
              fontFamily="heading"
              onClick={handleNewConversation}
            >
              <FiPlus style={{ marginRight: "8px" }} />
              Start a Conversation
            </Button>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}
