"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
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
  FiBook,
  FiHome,
} from "react-icons/fi";
import { ChatInterface } from "@/components/ChatInterface";

interface Conversation {
  id: string;
  title: string;
  status: "green" | "yellow" | "red";
  updatedAt: string;
  projectId?: string | null;
  projectTitle?: string | null;
}

interface Project {
  id: string;
  title: string;
  description?: string | null;
}

export default function ScholarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null); // null = "General" (no project)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  }, []);

  // Fetch conversations (optionally filtered by project)
  const fetchConversations = useCallback(async () => {
    try {
      const url = selectedProjectId === null
        ? "/api/conversations?projectId=none"
        : `/api/conversations?projectId=${selectedProjectId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
        // Auto-select first conversation if none selected or if current is not in list
        const currentExists = data.conversations.some((c: Conversation) => c.id === activeConversationId);
        if (!currentExists && data.conversations.length > 0) {
          setActiveConversationId(data.conversations[0].id);
        } else if (!currentExists) {
          setActiveConversationId(null);
        }
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId, activeConversationId]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }
    if (session.user.role === "teacher" || session.user.role === "admin") {
      router.push("/teacher");
      return;
    }
    fetchProjects();
    fetchConversations();
  }, [session, status, router, fetchProjects, fetchConversations]);

  // Re-fetch conversations when selected project changes
  useEffect(() => {
    if (status !== "loading" && session) {
      fetchConversations();
    }
  }, [selectedProjectId]);

  // Create new conversation (optionally linked to a project)
  const handleNewConversation = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConversationId(data.conversation.id);
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  // Archive conversation
  const handleArchiveConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          setActiveConversationId(conversations[0]?.id || null);
        }
      }
    } catch (error) {
      console.error("Error archiving conversation:", error);
    }
  };

  if (status === "loading" || isLoading) {
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

        {/* Project Selector */}
        <Box px={3} pt={3} pb={1}>
          <Text fontSize="xs" fontWeight="600" color="whiteAlpha.600" fontFamily="heading" mb={2}>
            PROJECT
          </Text>
          <VStack gap={1} align="stretch">
            <HStack
              p={2}
              borderRadius="md"
              cursor="pointer"
              bg={selectedProjectId === null ? "whiteAlpha.200" : "transparent"}
              _hover={{ bg: "whiteAlpha.100" }}
              onClick={() => setSelectedProjectId(null)}
            >
              <FiHome color="white" opacity={0.7} size={14} />
              <Text color="white" fontSize="sm" fontFamily="heading">
                General
              </Text>
            </HStack>
            {projects.map((project) => (
              <HStack
                key={project.id}
                p={2}
                borderRadius="md"
                cursor="pointer"
                bg={selectedProjectId === project.id ? "whiteAlpha.200" : "transparent"}
                _hover={{ bg: "whiteAlpha.100" }}
                onClick={() => setSelectedProjectId(project.id)}
              >
                <FiBook color="white" opacity={0.7} size={14} />
                <Text
                  color="white"
                  fontSize="sm"
                  fontFamily="heading"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {project.title}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>

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
            {selectedProjectId ? "New Project Chat" : "New Chat"}
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
              key={conv.id}
              p={3}
              borderRadius="lg"
              cursor="pointer"
              bg={activeConversationId === conv.id ? "whiteAlpha.200" : "transparent"}
              _hover={{ bg: "whiteAlpha.100" }}
              onClick={() => setActiveConversationId(conv.id)}
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
                  handleArchiveConversation(conv.id);
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
                name={session?.user?.name || "Scholar"}
                src={session?.user?.image || undefined}
              />
              <VStack gap={0} align="start">
                <Text
                  color="white"
                  fontSize="sm"
                  fontFamily="heading"
                  fontWeight="500"
                >
                  {session?.user?.name || "Scholar"}
                </Text>
                <Text color="whiteAlpha.600" fontSize="xs" fontFamily="heading">
                  Scholar
                </Text>
              </VStack>
            </HStack>
            <IconButton
              aria-label="Sign out"
              size="sm"
              variant="ghost"
              color="white"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <FiLogOut />
            </IconButton>
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
            onConversationUpdate={fetchConversations}
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
