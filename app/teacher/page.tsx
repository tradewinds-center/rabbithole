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
  Badge,
  Card,
  SimpleGrid,
  Input,
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import {
  FiLogOut,
  FiUsers,
  FiMessageSquare,
  FiRefreshCw,
  FiEye,
  FiSearch,
  FiAlertCircle,
  FiCheckCircle,
  FiAlertTriangle,
} from "react-icons/fi";
import { ConversationViewer } from "@/components/ConversationViewer";

interface Scholar {
  id: string;
  email: string;
  name: string;
  image?: string;
  conversationCount: number;
  messageCount: number;
  overallStatus: "green" | "yellow" | "red";
  lastActive: string;
  recentConversations: {
    id: string;
    title: string;
    status: "green" | "yellow" | "red";
    updatedAt: string;
  }[];
}

export default function TeacherDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch scholars
  const fetchScholars = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setScholars(data.scholars);
      }
    } catch (error) {
      console.error("Error fetching scholars:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }
    if (session.user.role !== "teacher" && session.user.role !== "admin") {
      router.push("/scholar");
      return;
    }
    fetchScholars();
  }, [session, status, router, fetchScholars]);

  // Refresh data
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchScholars();
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchScholars, 30000);
    return () => clearInterval(interval);
  }, [fetchScholars]);

  // Filter scholars
  const filteredScholars = scholars.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Count by status
  const statusCounts = {
    green: scholars.filter((s) => s.overallStatus === "green").length,
    yellow: scholars.filter((s) => s.overallStatus === "yellow").length,
    red: scholars.filter((s) => s.overallStatus === "red").length,
  };

  if (status === "loading" || isLoading) {
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

            <HStack gap={4}>
              <IconButton
                aria-label="Refresh"
                variant="ghost"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <FiRefreshCw
                  className={isRefreshing ? "animate-spin" : ""}
                />
              </IconButton>
              <HStack gap={2}>
                <Avatar
                  size="sm"
                  name={session?.user?.name || "Teacher"}
                  src={session?.user?.image || undefined}
                />
                <Text fontFamily="heading" fontSize="sm" fontWeight="500">
                  {session?.user?.name}
                </Text>
              </HStack>
              <IconButton
                aria-label="Sign out"
                variant="ghost"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <FiLogOut />
              </IconButton>
            </HStack>
          </Flex>
        </Box>

        {/* Status Summary Cards */}
        <Box px={6} py={4}>
          <SimpleGrid columns={{ base: 1, md: 4 }} gap={4}>
            <StatusCard
              icon={<FiUsers />}
              label="Total Scholars"
              value={scholars.length}
              color="navy"
            />
            <StatusCard
              icon={<FiCheckCircle />}
              label="On Track"
              value={statusCounts.green}
              color="green"
            />
            <StatusCard
              icon={<FiAlertTriangle />}
              label="Needs Attention"
              value={statusCounts.yellow}
              color="yellow"
            />
            <StatusCard
              icon={<FiAlertCircle />}
              label="Requires Intervention"
              value={statusCounts.red}
              color="red"
            />
          </SimpleGrid>
        </Box>

        {/* Search */}
        <Box px={6} pb={4}>
          <Flex position="relative" maxW="md">
            <Input
              placeholder="Search scholars..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              bg="white"
              border="2px solid"
              borderColor="gray.200"
              _focus={{ borderColor: "violet.500" }}
              pl={10}
              fontFamily="heading"
            />
            <Box
              position="absolute"
              left={3}
              top="50%"
              transform="translateY(-50%)"
              color="gray.400"
            >
              <FiSearch />
            </Box>
          </Flex>
        </Box>

        {/* Scholars Grid */}
        <Box px={6} pb={6}>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {filteredScholars.map((scholar) => (
              <ScholarCard
                key={scholar.id}
                scholar={scholar}
                onViewConversation={(id) => setSelectedConversationId(id)}
              />
            ))}
          </SimpleGrid>

          {filteredScholars.length === 0 && (
            <VStack py={12} gap={4}>
              <FiUsers size={48} color="#c1c1c1" />
              <Text color="charcoal.400" fontFamily="heading">
                {searchQuery
                  ? "No scholars match your search"
                  : "No scholars enrolled yet"}
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
          onUpdate={fetchScholars}
        />
      )}
    </Flex>
  );
}

// Status Card Component
function StatusCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "navy" | "green" | "yellow" | "red";
}) {
  const colorMap = {
    navy: { bg: "navy.500", text: "white" },
    green: { bg: "green.100", text: "green.700" },
    yellow: { bg: "yellow.100", text: "yellow.800" },
    red: { bg: "red.100", text: "red.700" },
  };

  return (
    <Card.Root bg="white" shadow="sm">
      <Card.Body p={4}>
        <HStack gap={4}>
          <Box
            p={3}
            borderRadius="lg"
            bg={colorMap[color].bg}
            color={colorMap[color].text}
          >
            {icon}
          </Box>
          <VStack gap={0} align="start">
            <Text
              fontSize="2xl"
              fontWeight="bold"
              fontFamily="heading"
              color="navy.500"
            >
              {value}
            </Text>
            <Text fontSize="sm" color="charcoal.400" fontFamily="heading">
              {label}
            </Text>
          </VStack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}

// Scholar Card Component
function ScholarCard({
  scholar,
  onViewConversation,
}: {
  scholar: Scholar;
  onViewConversation: (id: string) => void;
}) {
  const statusColors = {
    green: { bg: "green.500", text: "On Track" },
    yellow: { bg: "yellow.500", text: "Attention" },
    red: { bg: "red.500", text: "Intervention" },
  };

  return (
    <Card.Root bg="white" shadow="sm" _hover={{ shadow: "md" }}>
      <Card.Body p={4}>
        <VStack align="stretch" gap={3}>
          {/* Header */}
          <HStack justify="space-between">
            <HStack gap={3}>
              <Avatar
                size="md"
                name={scholar.name}
                src={scholar.image || undefined}
              />
              <VStack gap={0} align="start">
                <Text
                  fontWeight="600"
                  fontFamily="heading"
                  color="navy.500"
                  fontSize="md"
                >
                  {scholar.name}
                </Text>
                <Text
                  fontSize="xs"
                  color="charcoal.400"
                  fontFamily="heading"
                >
                  {scholar.email}
                </Text>
              </VStack>
            </HStack>
            <Box
              w={3}
              h={3}
              borderRadius="full"
              bg={statusColors[scholar.overallStatus].bg}
              title={statusColors[scholar.overallStatus].text}
            />
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
