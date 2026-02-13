"use client";

import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Spinner,
  Card,
  SimpleGrid,
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import {
  FiLogOut,
  FiUsers,
  FiMessageSquare,
  FiEye,
  FiUser,
  FiBook,
  FiSmile,
  FiExternalLink,
} from "react-icons/fi";
import { ConversationViewer, ScholarProfile, EntityManager } from "@/components";

interface Scholar {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  conversationCount: number;
  messageCount: number;
  overallStatus: "green" | "yellow" | "red";
  lastActive: number;
  recentConversations: {
    id: string;
    title: string;
    status: "green" | "yellow" | "red";
    updatedAt: number;
  }[];
}

export default function TeacherDashboard() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const scholars = useQuery(api.users.listScholars) ?? [];
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [selectedScholarId, setSelectedScholarId] = useState<string | null>(null);
  const [activeEntityPanel, setActiveEntityPanel] = useState<"project" | "persona" | "perspective" | null>(null);

  // Auth redirect
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "teacher" && user.role !== "admin") {
      router.push("/scholar");
      return;
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || scholars === undefined) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <Spinner size="xl" color="violet.500" />
      </Flex>
    );
  }

  return (
    <Flex h="100vh" bg="gray.50">
      {/* Main Dashboard */}
      <Box flex={1} overflow="auto">
        {/* Header */}
        <Box
          bg="white"
          borderBottom="1px solid"
          borderColor="gray.200"
          px={6}
          py={4}
          position="sticky"
          top={0}
          zIndex={10}
        >
          <Flex justify="space-between" align="center">
            <HStack gap={4}>
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
                  fontSize="xl"
                  fontWeight="600"
                  fontFamily="heading"
                  color="navy.500"
                >
                  Makawulu Dashboard
                </Text>
                <Text color="charcoal.400" fontSize="sm" fontFamily="heading">
                  Teacher View
                </Text>
              </VStack>
            </HStack>

            <HStack gap={2}>
              {(["project", "persona", "perspective"] as const).map((type) => {
                const isActive = activeEntityPanel === type;
                const icons = { project: FiBook, persona: FiSmile, perspective: FiEye };
                const labels = { project: "Projects", persona: "Personas", perspective: "Perspectives" };
                const TypeIcon = icons[type];
                return (
                  <Button
                    key={type}
                    size="sm"
                    variant={isActive ? "solid" : "outline"}
                    colorPalette={isActive ? "violet" : "gray"}
                    fontFamily="heading"
                    fontWeight="500"
                    onClick={() => {
                      setSelectedConversationId(null);
                      setSelectedScholarId(null);
                      setActiveEntityPanel(isActive ? null : type);
                    }}
                  >
                    <TypeIcon />
                    {labels[type]}
                  </Button>
                );
              })}

              <Box w="1px" h={6} bg="gray.200" mx={1} />

              <HStack gap={2}>
                <Avatar
                  size="sm"
                  name={user?.name || "Teacher"}
                  src={user?.image || undefined}
                />
                <Text fontFamily="heading" fontSize="sm" fontWeight="500" color="charcoal.600">
                  {user?.name}
                </Text>
              </HStack>
              <IconButton
                aria-label="Sign out"
                variant="ghost"
                size="sm"
                color="charcoal.400"
                onClick={() => {
                  signOut();
                  router.push("/login");
                }}
              >
                <FiLogOut />
              </IconButton>
            </HStack>
          </Flex>
        </Box>

        {/* Scholars Grid */}
        <Box px={6} py={4}>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {scholars.map((scholar) => (
              <ScholarCard
                key={scholar.id}
                scholar={scholar}
                onViewConversation={(id) => {
                  setSelectedScholarId(null);
                  setSelectedConversationId(id);
                }}
                onViewProfile={() => {
                  setSelectedConversationId(null);
                  setSelectedScholarId(scholar.id);
                }}
              />
            ))}
          </SimpleGrid>

          {scholars.length === 0 && (
            <VStack py={12} gap={4}>
              <FiUsers size={48} color="#c1c1c1" />
              <Text color="charcoal.400" fontFamily="heading">
                No scholars enrolled yet
              </Text>
            </VStack>
          )}
        </Box>
      </Box>

      {/* Conversation Viewer Sidebar */}
      {selectedConversationId && (
        <ConversationViewer
          conversationId={selectedConversationId}
          onClose={() => setSelectedConversationId(null)}
          onUpdate={() => {}}
        />
      )}

      {/* Scholar Profile Sidebar */}
      {selectedScholarId && (
        <ScholarProfile
          scholarId={selectedScholarId}
          onClose={() => setSelectedScholarId(null)}
        />
      )}

      {/* Entity Manager Sidebar (Projects, Personas, or Perspectives) */}
      {activeEntityPanel && (
        <EntityManager
          key={activeEntityPanel}
          entityType={activeEntityPanel}
          onClose={() => setActiveEntityPanel(null)}
        />
      )}
    </Flex>
  );
}

// Scholar Card Component
function ScholarCard({
  scholar,
  onViewConversation,
  onViewProfile,
}: {
  scholar: Scholar;
  onViewConversation: (id: string) => void;
  onViewProfile: () => void;
}) {
  const statusColors = {
    green: { bg: "green.500", text: "On Track" },
    yellow: { bg: "yellow.500", text: "Attention" },
    red: { bg: "red.500", text: "Intervention" },
  };

  const remoteUrl = `/scholar?remote=${scholar.id}`;

  return (
    <Card.Root bg="white" shadow="sm" _hover={{ shadow: "md" }}>
      <Card.Body p={4}>
        <VStack align="stretch" gap={3}>
          {/* Header — click to open scholar's view in new tab */}
          <HStack justify="space-between">
            <Box
              flex={1}
              cursor="pointer"
              borderRadius="md"
              p={1}
              m={-1}
              _hover={{ bg: "gray.50" }}
              css={{ "& .remote-icon": { opacity: 0, transition: "opacity 0.15s" }, "&:hover .remote-icon": { opacity: 1 } }}
              onClick={() => window.open(remoteUrl, "_blank")}
            >
              <HStack gap={3}>
                <Avatar
                  size="md"
                  name={scholar.name}
                  src={scholar.image || undefined}
                />
                <VStack gap={0} align="start" flex={1}>
                  <HStack gap={1}>
                    <Text
                      fontWeight="600"
                      fontFamily="heading"
                      color="navy.500"
                      fontSize="md"
                    >
                      {scholar.name}
                    </Text>
                    <Box className="remote-icon" color="charcoal.300" fontSize="xs">
                      <FiExternalLink />
                    </Box>
                  </HStack>
                  <Text
                    fontSize="xs"
                    color="charcoal.400"
                    fontFamily="heading"
                  >
                    {scholar.email}
                  </Text>
                </VStack>
              </HStack>
            </Box>
            <HStack gap={2}>
              <IconButton
                aria-label="View Profile"
                size="sm"
                variant="ghost"
                color="violet.500"
                _hover={{ bg: "violet.50" }}
                onClick={onViewProfile}
              >
                <FiUser />
              </IconButton>
              <Box
                w={3}
                h={3}
                borderRadius="full"
                bg={statusColors[scholar.overallStatus].bg}
                title={statusColors[scholar.overallStatus].text}
              />
            </HStack>
          </HStack>

          {/* Stats */}
          <HStack gap={4} fontSize="sm" color="charcoal.400" fontFamily="heading">
            <HStack gap={1}>
              <FiMessageSquare />
              <Text>{scholar.conversationCount} chats</Text>
            </HStack>
            <Text>{scholar.messageCount} messages</Text>
          </HStack>

          {/* Recent Conversations */}
          {scholar.recentConversations.length > 0 && (
            <VStack align="stretch" gap={1}>
              <Text
                fontSize="xs"
                fontWeight="600"
                color="charcoal.400"
                fontFamily="heading"
              >
                Recent Conversations
              </Text>
              {scholar.recentConversations.slice(0, 3).map((conv) => (
                <HStack
                  key={conv.id}
                  p={2}
                  bg="gray.50"
                  borderRadius="md"
                  cursor="pointer"
                  _hover={{ bg: "gray.100" }}
                  onClick={() => onViewConversation(conv.id)}
                  justify="space-between"
                >
                  <Text
                    fontSize="sm"
                    fontFamily="heading"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                    flex={1}
                  >
                    {conv.title}
                  </Text>
                  <HStack gap={2}>
                    <Box
                      w={2}
                      h={2}
                      borderRadius="full"
                      bg={statusColors[conv.status].bg}
                    />
                    <IconButton
                      aria-label="View"
                      size="xs"
                      variant="ghost"
                    >
                      <FiEye />
                    </IconButton>
                  </HStack>
                </HStack>
              ))}
            </VStack>
          )}

          {scholar.recentConversations.length === 0 && (
            <Text
              fontSize="sm"
              color="charcoal.300"
              fontFamily="heading"
              textAlign="center"
              py={2}
            >
              No conversations yet
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}
