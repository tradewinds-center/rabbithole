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
  FiUser,
  FiBook,
  FiSmile,
  FiEye,
  FiExternalLink,
} from "react-icons/fi";
import { ScholarProfile, EntityManager } from "@/components";

type Tab = "scholars" | "projects" | "personas" | "perspectives";

const TABS: { key: Tab; label: string; icon: typeof FiUsers }[] = [
  { key: "scholars", label: "Scholars", icon: FiUsers },
  { key: "projects", label: "Projects", icon: FiBook },
  { key: "personas", label: "Personas", icon: FiSmile },
  { key: "perspectives", label: "Perspectives", icon: FiEye },
];

interface Scholar {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  conversationCount: number;
  messageCount: number;
  overallStatus: "green" | "yellow" | "red";
  lastActive: number;
  statusSummary: string | null;
  progressScore: number | null;
  lastMessage: string | null;
}

export default function TeacherDashboard() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const scholars = useQuery(api.users.listScholars) ?? [];
  const [activeTab, setActiveTab] = useState<Tab>("scholars");
  const [selectedScholarId, setSelectedScholarId] = useState<string | null>(
    null
  );

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
    <Flex h="100vh" bg="gray.50" direction="column">
      {/* Header */}
      <Box bg="white" borderBottom="1px solid" borderColor="gray.200" px={6} py={3}>
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
              <Text fontSize="lg" fontWeight="bold" color="white" fontFamily="heading">
                M
              </Text>
            </Box>
            <VStack gap={0} align="start">
              <Text fontSize="xl" fontWeight="600" fontFamily="heading" color="navy.500">
                Makawulu Dashboard
              </Text>
              <Text color="charcoal.400" fontSize="sm" fontFamily="heading">
                Teacher View
              </Text>
            </VStack>
          </HStack>

          <HStack gap={2}>
            <Avatar
              size="sm"
              name={user?.name || "Teacher"}
              src={user?.image || undefined}
            />
            <Text fontFamily="heading" fontSize="sm" fontWeight="500" color="charcoal.600">
              {user?.name}
            </Text>
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

      {/* Tab Bar */}
      <Box bg="white" borderBottom="1px solid" borderColor="gray.200" px={6}>
        <HStack gap={0}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const TabIcon = tab.icon;
            return (
              <Button
                key={tab.key}
                variant="ghost"
                borderRadius={0}
                borderBottom="2px solid"
                borderColor={isActive ? "violet.500" : "transparent"}
                color={isActive ? "violet.600" : "charcoal.400"}
                fontFamily="heading"
                fontWeight={isActive ? "600" : "500"}
                fontSize="sm"
                px={5}
                py={3}
                h="auto"
                _hover={{ color: "violet.500", bg: "violet.50" }}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSelectedScholarId(null);
                }}
              >
                <TabIcon style={{ marginRight: "6px" }} />
                {tab.label}
              </Button>
            );
          })}
        </HStack>
      </Box>

      {/* Content */}
      <Flex flex={1} overflow="hidden">
        <Box flex={1} overflow="auto" px={6} py={4}>
          {activeTab === "scholars" && (
            <>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                {scholars.map((scholar) => (
                  <ScholarCard
                    key={scholar.id}
                    scholar={scholar}
                    onViewProfile={() => setSelectedScholarId(scholar.id)}
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
            </>
          )}

          {activeTab === "projects" && <EntityManager entityType="project" />}
          {activeTab === "personas" && <EntityManager entityType="persona" />}
          {activeTab === "perspectives" && (
            <EntityManager entityType="perspective" />
          )}
        </Box>

        {/* Scholar Profile Sidebar (only on scholars tab) */}
        {activeTab === "scholars" && selectedScholarId && (
          <ScholarProfile
            scholarId={selectedScholarId}
            onClose={() => setSelectedScholarId(null)}
          />
        )}
      </Flex>
    </Flex>
  );
}

// Scholar Card Component
function ScholarCard({
  scholar,
  onViewProfile,
}: {
  scholar: Scholar;
  onViewProfile: () => void;
}) {
  const remoteUrl = `/scholar?remote=${scholar.id}`;
  const score = scholar.progressScore;
  const cardBg = score === null
    ? "white"
    : score <= 1
      ? "red.50"
      : score <= 2
        ? "yellow.50"
        : score <= 3
          ? "white"
          : score <= 4
            ? "green.50"
            : "violet.50";
  const cardBorder = score === null
    ? "transparent"
    : score <= 1
      ? "red.200"
      : score <= 2
        ? "yellow.200"
        : score <= 3
          ? "transparent"
          : score <= 4
            ? "green.200"
            : "violet.200";

  return (
    <Card.Root
      bg={cardBg}
      shadow="sm"
      cursor="pointer"
      _hover={{ shadow: "md", borderColor: "violet.300" }}
      borderWidth="1px"
      borderColor={cardBorder}
      transition="all 0.15s"
      onClick={() => window.open(remoteUrl, "_blank")}
      css={{
        "& .remote-icon": { opacity: 0, transition: "opacity 0.15s" },
        "&:hover .remote-icon": { opacity: 1 },
      }}
    >
      <Card.Body p={4}>
        <VStack align="stretch" gap={3}>
          <HStack justify="space-between">
            <HStack gap={3} flex={1}>
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
                  <Box
                    className="remote-icon"
                    color="charcoal.300"
                    fontSize="xs"
                  >
                    <FiExternalLink />
                  </Box>
                </HStack>
                <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                  {scholar.email}
                </Text>
              </VStack>
            </HStack>
            <IconButton
              aria-label="View Profile"
              size="sm"
              variant="ghost"
              color="violet.500"
              _hover={{ bg: "violet.50" }}
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile();
              }}
            >
              <FiUser />
            </IconButton>
          </HStack>

          <HStack
            gap={4}
            fontSize="sm"
            color="charcoal.400"
            fontFamily="heading"
          >
            <HStack gap={1}>
              <FiMessageSquare />
              <Text>{scholar.conversationCount} chats</Text>
            </HStack>
            <Text>{scholar.messageCount} messages</Text>
          </HStack>

          {scholar.lastMessage ? (
            <VStack align="stretch" gap={1}>
              <Text
                fontSize="sm"
                color="charcoal.600"
                fontFamily="heading"
                lineHeight="1.4"
              >
                {scholar.lastMessage}
              </Text>
              {scholar.statusSummary && (
                <Text
                  fontSize="xs"
                  color="charcoal.400"
                  fontFamily="heading"
                  fontStyle="italic"
                  lineHeight="1.3"
                >
                  {scholar.statusSummary}
                </Text>
              )}
            </VStack>
          ) : (
            <Text
              fontSize="sm"
              color="charcoal.300"
              fontFamily="heading"
              textAlign="center"
              py={2}
            >
              No activity yet
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}
