"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
  Textarea,
  Spinner,
  Badge,
  Input,
  Tabs,
  Dialog,
  Portal,
  Switch,
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import {
  FiPlus,
  FiTrash2,
  FiBookOpen,
  FiFileText,
  FiUser,
  FiFolder,
  FiEdit3,
  FiCpu,
  FiClipboard,
  FiShare2,
  FiClock,
  FiMessageSquare,
  FiActivity,
  FiVolume2,
  FiKey,
  FiFlag,
} from "react-icons/fi";
import { ParentAccessDialog } from "@/components/ParentAccessDialog";
import { Notebook, Plant, ShootingStar } from "@phosphor-icons/react";
import { MasteryTab } from "@/components/MasteryTab";
import { SeedsTab } from "@/components/SeedsTab";
import { DirectivesTab } from "@/components/DirectivesTab";
import { DocumentsTab } from "@/components/DocumentsTab";
import { SignalsTab } from "@/components/SignalsTab";
import { StandardsTab } from "@/components/StandardsTab";
import { StyledDialogContent } from "@/components/ui/StyledDialogContent";

export type ScholarTabKey = "activity" | "dossier" | "mastery" | "standards" | "seeds" | "directives" | "strengths" | "documents" | "notes" | "reading" | "chats";
type TabKey = ScholarTabKey;

interface ScholarProfileProps {
  scholarId: string;
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  onDelete?: () => void;
  /** "teacher" (default) shows all controls; "parent" hides teacher-only buttons */
  mode?: "teacher" | "parent";
}

const READING_LEVELS = [
  { value: "", label: "Not set" },
  { value: "K", label: "K - Kindergarten" },
  { value: "1", label: "1st Grade" },
  { value: "2", label: "2nd Grade" },
  { value: "3", label: "3rd Grade" },
  { value: "4", label: "4th Grade" },
  { value: "5", label: "5th Grade" },
  { value: "6", label: "6th Grade" },
  { value: "7", label: "7th Grade" },
  { value: "8", label: "8th Grade" },
  { value: "9", label: "9th Grade" },
  { value: "10", label: "10th Grade" },
  { value: "11", label: "11th Grade" },
  { value: "12", label: "12th Grade" },
  { value: "college", label: "College" },
];

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }[] = [
  { key: "activity", label: "Activity", icon: FiActivity },
  { key: "mastery", label: "Mastery", icon: FiCpu },
  { key: "seeds", label: "Seeds", icon: Plant },
  { key: "directives", label: "Directives", icon: FiFlag },
  { key: "standards", label: "Standards", icon: FiClipboard },
  { key: "strengths", label: "Strengths", icon: ShootingStar },
  { key: "documents", label: "Documents", icon: FiFolder },
  { key: "notes", label: "Notes", icon: FiFileText },
  { key: "dossier", label: "Dossier", icon: FiUser },
  { key: "reading", label: "Reading & Audio", icon: FiBookOpen },
  { key: "chats", label: "Chats", icon: FiMessageSquare },
];

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function ScholarProfile({ scholarId, activeTab: controlledTab, onTabChange, onDelete, mode = "teacher" }: ScholarProfileProps) {
  const isParentMode = mode === "parent";
  const router = useRouter();
  const { user: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const deleteUser = useMutation(api.users.deleteUser);
  const createChatSession = useMutation(api.curriculumAssistant.createSession);
  const chatSessions = useQuery(api.curriculumAssistant.listSessionsForScholar, { scholarId: scholarId as Id<"users"> }) ?? [];
  const resetPassword = useMutation(api.users.resetScholarPassword);
  const profile = useQuery(api.scholars.getProfile, { scholarId: scholarId as Id<"users"> });
  const observations = useQuery(api.observations.listByScholar, { scholarId: scholarId as Id<"users"> }) ?? [];
  // masteryByDomain moved to MasteryTab component
  const dossierContent = useQuery(api.dossier.getForTeacher, { scholarId: scholarId as Id<"users"> });
  const artifacts = useQuery(api.artifacts.getByScholar, { scholarId: scholarId as Id<"users"> });
  const scholarProjects = useQuery(api.projects.list, { userId: scholarId as Id<"users"> });
  const recentMessages = useQuery(api.messages.getRecentByScholar, { scholarId: scholarId as Id<"users"> });
  const reports = useQuery(api.reports.list, { scholarId: scholarId as Id<"users"> }) ?? [];
  const createReport = useMutation(api.reports.create);
  const removeReport = useMutation(api.reports.remove);
  const updateDossier = useMutation(api.dossier.updateByTeacher);
  const updateReadingLevel = useMutation(api.scholars.updateReadingLevel);
  const updateAudioSettings = useMutation(api.scholars.updateAudioSettings);
  const addObservation = useMutation(api.observations.add);
  const removeObservation = useMutation(api.observations.remove);
  const { scholar, stats } = profile ?? {
    scholar: null,
    stats: { projectCount: 0, messageCount: 0, observationCount: 0 },
  };

  const isLoading = profile === undefined;

  const [internalTab, setInternalTab] = useState<TabKey>("activity");
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [dossierDraft, setDossierDraft] = useState<string | null>(null);
  const [isSavingReadingLevel, setIsSavingReadingLevel] = useState(false);
  const [newObservation, setNewObservation] = useState({ type: "praise" as "praise" | "concern" | "suggestion" | "intervention", note: "" });
  const [isAddingObservation, setIsAddingObservation] = useState(false);
  const [newReport, setNewReport] = useState({ title: "", content: "" });
  const [isAddingReport, setIsAddingReport] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showParentAccess, setShowParentAccess] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Update reading level
  const handleReadingLevelChange = async (newLevel: string) => {
    setIsSavingReadingLevel(true);
    try {
      await updateReadingLevel({
        scholarId: scholarId as Id<"users">,
        readingLevel: newLevel || null,
      });
    } catch (error) {
      console.error("Error updating reading level:", error);
    } finally {
      setIsSavingReadingLevel(false);
    }
  };

  // Add an observation
  const handleAddObservation = async () => {
    if (!newObservation.note.trim()) return;
    setIsAddingObservation(true);
    try {
      await addObservation({
        scholarId: scholarId as Id<"users">,
        type: newObservation.type,
        note: newObservation.note,
      });
      setNewObservation({ type: "praise", note: "" });
    } catch (error) {
      console.error("Error adding observation:", error);
    } finally {
      setIsAddingObservation(false);
    }
  };

  // Delete an observation
  const handleDeleteObservation = async (observationId: string) => {
    try {
      await removeObservation({ observationId: observationId as Id<"observations"> });
    } catch (error) {
      console.error("Error deleting observation:", error);
    }
  };

  // Add a report
  const handleAddReport = async () => {
    if (!newReport.title.trim() || !newReport.content.trim()) return;
    setIsAddingReport(true);
    try {
      await createReport({
        scholarId: scholarId as Id<"users">,
        title: newReport.title,
        content: newReport.content,
      });
      setNewReport({ title: "", content: "" });
    } catch (error) {
      console.error("Error adding report:", error);
    } finally {
      setIsAddingReport(false);
    }
  };

  // Delete a report
  const handleDeleteReport = async (reportId: string) => {
    try {
      await removeReport({ reportId: reportId as Id<"reports"> });
    } catch (error) {
      console.error("Error deleting report:", error);
    }
  };

  if (isLoading) {
    return (
      <Box
        w="full"
        bg="white"
        h="full"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Spinner size="lg" color="violet.500" />
      </Box>
    );
  }

  return (
    <Box w="full" bg="gray.50" h="full" display="flex" flexDir="column">
      {/* Compact header bar */}
      <Flex
        px={5}
        py={4}
        align="center"
        gap={6}
        flexWrap="wrap"
      >
        <HStack gap={3} minW="200px">
          <Avatar
            size="md"
            name={scholar?.name || "Scholar"}
            src={scholar?.image || undefined}
          />
          <VStack gap={0} align="start">
            <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="lg">
              {scholar?.name}
            </Text>
            {scholar?.username && (
              <Text color="charcoal.300" fontSize="xs" fontFamily="heading">
                @{scholar.username}
              </Text>
            )}
          </VStack>
        </HStack>

        <HStack ml="auto" gap={1}>
          {isParentMode ? (
            <Button
              size="sm"
              variant="ghost"
              color="violet.500"
              fontFamily="heading"
              fontSize="xs"
              _hover={{ bg: "violet.50" }}
              onClick={() => setShowParentAccess(true)}
            >
              <FiShare2 style={{ marginRight: "4px" }} />
              MCP Access
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                color="violet.500"
                fontFamily="heading"
                fontSize="xs"
                _hover={{ bg: "violet.50" }}
                onClick={async () => {
                  const sessionId = await createChatSession({ scholarId: scholarId as Id<"users"> });
                  router.push(`/teacher?tab=assistant&session=${String(sessionId)}`);
                }}
              >
                <FiMessageSquare style={{ marginRight: "4px" }} />
                Chat with AI
              </Button>
              <Button
                size="sm"
                variant="ghost"
                color="violet.500"
                fontFamily="heading"
                fontSize="xs"
                _hover={{ bg: "violet.50" }}
                onClick={() => setShowResetPassword(true)}
              >
                <FiKey style={{ marginRight: "4px" }} />
                Reset Password
              </Button>
              <Button
                size="sm"
                variant="ghost"
                color="violet.500"
                fontFamily="heading"
                fontSize="xs"
                _hover={{ bg: "violet.50" }}
                onClick={() => setShowParentAccess(true)}
              >
                <FiShare2 style={{ marginRight: "4px" }} />
                Parent Access
              </Button>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  color="red.500"
                  fontFamily="heading"
                  fontSize="xs"
                  _hover={{ bg: "red.50" }}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <FiTrash2 style={{ marginRight: "4px" }} />
                  Delete
                </Button>
              )}
            </>
          )}
        </HStack>

      </Flex>

      {/* Tab bar */}
      <Tabs.Root
        value={activeTab}
        onValueChange={(e) => setActiveTab(e.value as TabKey)}
        variant="subtle"
        fitted={false}
        size="lg"
      >
        <Tabs.List px={5} gap={0}>
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <Tabs.Trigger
                key={tab.key}
                value={tab.key}
                fontFamily="heading"
                fontSize="xs"
                px={4}
                py={4}
                color="charcoal.400"
              >
                <TabIcon style={{ marginRight: "6px" }} />
                {tab.label}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
      </Tabs.Root>

      {/* Tab content */}
      <Box flex={1} overflow="auto" p={4}>
        {activeTab === "activity" && (
          <VStack gap={4} align="stretch" maxW="800px">
            {/* Projects */}
            <Box>
              <HStack mb={2} justify="space-between">
                <HStack>
                  <FiFolder color="#AD60BF" />
                  <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                    Projects ({stats.projectCount})
                  </Text>
                </HStack>
                {!isParentMode && (
                  <a
                    href={`/scholar?remote=${scholarId}`}
                    target="_blank"
                    rel="noopener"
                    style={{ textDecoration: "none" }}
                  >
                    <Text
                      fontSize="xs"
                      color="violet.500"
                      fontFamily="heading"
                      cursor="pointer"
                      _hover={{ textDecoration: "underline" }}
                    >
                      Show all
                    </Text>
                  </a>
                )}
              </HStack>
              {scholarProjects === undefined ? (
                <Flex justify="center" py={4}><Spinner size="sm" color="violet.500" /></Flex>
              ) : scholarProjects.length === 0 ? (
                <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={4}>
                  No projects yet.
                </Text>
              ) : (
                <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(220px, 1fr))" gap={3}>
                  {scholarProjects.slice(0, 6).map((project) => (
                    <a
                      key={project._id}
                      href={`/scholar/${String(project._id)}?remote=${scholarId}`}
                      target="_blank"
                      rel="noopener"
                      style={{ textDecoration: "none", color: "inherit", display: "contents" }}
                    >
                      <Box
                        bg="white"
                        borderRadius="lg"
                        p={3}
                        shadow="xs"
                        cursor="pointer"
                        _hover={{ shadow: "sm", borderColor: "violet.200" }}
                        border="1px solid"
                        borderColor="gray.100"
                      >
                      <Text fontFamily="heading" fontSize="sm" fontWeight="600" color="navy.500" lineClamp={1}>
                        {project.title}
                      </Text>
                      {project.unitTitle && (
                        <Text fontSize="xs" color="violet.500" fontFamily="heading" mt={0.5}>
                          {project.unitEmoji ? `${project.unitEmoji} ` : ""}{project.unitTitle}
                        </Text>
                      )}
                      <HStack mt={2} gap={3}>
                        <HStack gap={1}>
                          <FiMessageSquare size={11} color="#888" />
                          <Text fontSize="xs" color="charcoal.400" fontFamily="heading">{project.messageCount}</Text>
                        </HStack>
                        <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                          {timeAgo(project._creationTime)}
                        </Text>
                      </HStack>
                      {project.analysisSummary && (
                        <Text fontSize="xs" color="charcoal.500" fontFamily="body" mt={1.5} lineClamp={2}>
                          {project.analysisSummary}
                        </Text>
                      )}
                    </Box>
                    </a>
                  ))}
                </Box>
              )}
            </Box>

            {/* Messages */}
            <Box>
              <HStack mb={2}>
                <FiClock color="#AD60BF" />
                <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                  Messages ({stats.messageCount})
                </Text>
              </HStack>
              {recentMessages === undefined ? (
                <Flex justify="center" py={4}><Spinner size="sm" color="violet.500" /></Flex>
              ) : recentMessages.length === 0 ? (
                <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={4}>
                  No messages yet.
                </Text>
              ) : (
                <VStack gap={2} align="stretch">
                  {recentMessages.filter((m) => !(m.role === "user" && m.content === "<start>")).map((msg) => (
                    <a
                      key={msg._id}
                      href={`/scholar/${String(msg.projectId)}?remote=${scholarId}`}
                      target="_blank"
                      rel="noopener"
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <Box
                        bg="white"
                        borderRadius="md"
                        p={3}
                        shadow="xs"
                        cursor="pointer"
                        _hover={{ shadow: "sm" }}
                      >
                        <HStack justify="space-between" mb={1}>
                          <HStack gap={2}>
                            <Badge
                              bg={msg.role === "user" ? "cyan.100" : "violet.100"}
                              color={msg.role === "user" ? "cyan.700" : "violet.700"}
                              fontSize="xs"
                            >
                              {msg.role === "user" ? "scholar" : "ai"}
                            </Badge>
                            <Text fontSize="xs" color="violet.500" fontFamily="heading">
                              {msg.projectTitle}
                            </Text>
                          </HStack>
                          <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                            {timeAgo(msg._creationTime)}
                          </Text>
                        </HStack>
                        <Text fontSize="sm" color="charcoal.600" fontFamily="body" lineClamp={2}>
                          {msg.content.slice(0, 200)}
                        </Text>
                      </Box>
                    </a>
                  ))}
                </VStack>
              )}
            </Box>
          </VStack>
        )}

        {activeTab === "dossier" && (
          <Box bg="white" borderRadius="lg" p={4} shadow="xs" maxW="700px">
            <HStack mb={2}>
              <FiUser color="#AD60BF" />
              <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                Scholar Dossier
              </Text>
            </HStack>
            <Textarea
              size="sm"
              placeholder="No dossier yet — the AI will build one during conversations."
              value={dossierDraft ?? dossierContent ?? ""}
              onChange={(e) => setDossierDraft(e.target.value)}
              onBlur={async () => {
                if (dossierDraft !== null && dossierDraft !== (dossierContent ?? "")) {
                  await updateDossier({
                    scholarId: scholarId as Id<"users">,
                    content: dossierDraft,
                  });
                }
                setDossierDraft(null);
              }}
              rows={12}
              bg="gray.50"
              fontFamily="body"
              fontSize="sm"
              lineHeight="1.5"
            />
            <Text fontSize="xs" color="charcoal.400" fontFamily="body" mt={1}>
              AI-maintained learning profile. You can also edit manually.
            </Text>
          </Box>
        )}

        {activeTab === "mastery" && (
          <MasteryTab scholarId={scholarId} />
        )}

        {activeTab === "standards" && (
          <StandardsTab scholarId={scholarId} readingLevel={scholar?.readingLevel} />
        )}

        {activeTab === "seeds" && (
          <SeedsTab scholarId={scholarId} />
        )}

        {activeTab === "directives" && (
          <DirectivesTab scholarId={scholarId} />
        )}

        {activeTab === "strengths" && (
          <SignalsTab scholarId={scholarId} />
        )}

        {activeTab === "documents" && (
          <DocumentsTab scholarId={scholarId} />
        )}

        {activeTab === "notes" && (
          <VStack gap={4} align="stretch" maxW="700px">
            {/* Observations section */}
            <Box bg="white" borderRadius="lg" p={4} shadow="xs">
              <HStack mb={3}>
                <FiFileText color="#AD60BF" />
                <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                  Observations
                </Text>
              </HStack>

              {/* Add new observation */}
              {!isParentMode && (
                <Box p={3} bg="gray.50" borderRadius="md" mb={3}>
                  <select
                    value={newObservation.type}
                    onChange={(e) => setNewObservation((prev) => ({ ...prev, type: e.target.value as typeof prev.type }))}
                    style={{
                      padding: "5px 8px",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                      fontFamily: "inherit",
                      width: "140px",
                      marginBottom: "8px",
                    }}
                  >
                    <option value="praise">Praise</option>
                    <option value="concern">Concern</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="intervention">Intervention</option>
                  </select>
                  <Textarea
                    size="sm"
                    placeholder="Record an observation..."
                    value={newObservation.note}
                    onChange={(e) => setNewObservation((prev) => ({ ...prev, note: e.target.value }))}
                    rows={2}
                    bg="white"
                    fontFamily="body"
                    mb={2}
                  />
                  <Flex justify="flex-end">
                    <Button
                      size="sm"
                      bg="violet.500"
                      color="white"
                      _hover={{ bg: "violet.600" }}
                      fontFamily="heading"
                      onClick={handleAddObservation}
                      disabled={isAddingObservation || !newObservation.note.trim()}
                    >
                      Save
                    </Button>
                  </Flex>
                </Box>
              )}

              {/* Existing observations */}
              {observations.length > 0 ? (
                <VStack gap={2} align="stretch">
                  {observations.map((obs) => (
                    <Box
                      key={obs._id}
                      p={3}
                      bg="gray.50"
                      borderRadius="md"
                    >
                      <HStack justify="space-between" align="start">
                        <VStack gap={1} align="start" flex={1}>
                          <HStack>
                            <Badge
                              bg={
                                obs.type === "praise" ? "green.100" :
                                obs.type === "concern" ? "red.100" :
                                obs.type === "suggestion" ? "blue.100" :
                                "orange.100"
                              }
                              color={
                                obs.type === "praise" ? "green.700" :
                                obs.type === "concern" ? "red.700" :
                                obs.type === "suggestion" ? "blue.700" :
                                "orange.700"
                              }
                              fontSize="xs"
                            >
                              {obs.type}
                            </Badge>
                            <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                              {new Date(obs._creationTime).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </Text>
                          </HStack>
                          <Text fontSize="sm" color="charcoal.600" fontFamily="body" lineHeight="1.4">
                            {obs.note}
                          </Text>
                        </VStack>
                        {!isParentMode && (
                          <IconButton
                            aria-label="Delete"
                            size="xs"
                            variant="ghost"
                            color="red.400"
                            _hover={{ bg: "red.50", color: "red.600" }}
                            onClick={() => handleDeleteObservation(obs._id)}
                          >
                            <FiTrash2 />
                          </IconButton>
                        )}
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              ) : (
                <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={2}>
                  No observations yet.
                </Text>
              )}
            </Box>

            {/* Reports section */}
            <Box>
              {/* Add new report */}
              {!isParentMode && (
                <Box bg="white" borderRadius="lg" p={4} shadow="xs" mb={4}>
                  <HStack mb={3}>
                    <Notebook size={16} color="#AD60BF" />
                    <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                      New Report
                    </Text>
                  </HStack>
                  <Box p={3} bg="gray.50" borderRadius="md">
                    <Input
                      size="sm"
                      placeholder="Report title"
                      value={newReport.title}
                      onChange={(e) => setNewReport((prev) => ({ ...prev, title: e.target.value }))}
                      bg="white"
                      fontFamily="heading"
                      mb={2}
                    />
                    <Textarea
                      size="sm"
                      placeholder="Write your report..."
                      value={newReport.content}
                      onChange={(e) => setNewReport((prev) => ({ ...prev, content: e.target.value }))}
                      rows={8}
                      bg="white"
                      fontFamily="body"
                      mb={2}
                    />
                    <Flex justify="space-between" align="center">
                      <Text fontSize="xs" color="charcoal.400" fontFamily="body">
                        Reports auto-append to the AI dossier.
                      </Text>
                      <Button
                        size="sm"
                        bg="violet.500"
                        color="white"
                        _hover={{ bg: "violet.600" }}
                        fontFamily="heading"
                        onClick={handleAddReport}
                        disabled={isAddingReport || !newReport.title.trim() || !newReport.content.trim()}
                      >
                        Save
                      </Button>
                    </Flex>
                  </Box>
                </Box>
              )}

              {/* Existing reports */}
              {reports.length > 0 ? (
                <VStack gap={3} align="stretch">
                  {reports.map((report) => (
                    <Box
                      key={report._id}
                      bg="white"
                      borderRadius="lg"
                      p={4}
                      shadow="xs"
                      borderLeft="3px solid"
                      borderColor="violet.400"
                    >
                      <HStack justify="space-between" align="start" mb={1}>
                        <Text fontFamily="heading" fontSize="sm" fontWeight="600" color="navy.500">
                          {report.title}
                        </Text>
                        <HStack gap={2}>
                          <Text fontSize="xs" color="charcoal.400" fontFamily="heading" whiteSpace="nowrap">
                            {new Date(report._creationTime).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </Text>
                          {!isParentMode && (
                            <IconButton
                              aria-label="Delete report"
                              size="xs"
                              variant="ghost"
                              color="red.400"
                              _hover={{ bg: "red.50", color: "red.600" }}
                              onClick={() => handleDeleteReport(report._id)}
                            >
                              <FiTrash2 />
                            </IconButton>
                          )}
                        </HStack>
                      </HStack>
                      <Text fontSize="sm" color="charcoal.600" fontFamily="body" lineHeight="1.5" whiteSpace="pre-wrap">
                        {report.content}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              ) : (
                <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={4}>
                  No reports yet.
                </Text>
              )}
            </Box>
          </VStack>
        )}

        {activeTab === "reading" && (
          <VStack gap={4} align="stretch" maxW="400px">
            {isParentMode && (
              <Text fontSize="sm" color="charcoal.400" fontFamily="body" fontStyle="italic">
                These settings can only be edited by teacher
              </Text>
            )}
            <Box bg="white" borderRadius="lg" p={4} shadow="xs" opacity={isParentMode ? 0.7 : 1}>
              <HStack mb={2}>
                <FiBookOpen color="#AD60BF" />
                <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                  Reading Level
                </Text>
                {isSavingReadingLevel && <Spinner size="xs" color="violet.500" />}
              </HStack>
              <select
                value={scholar?.readingLevel || ""}
                onChange={(e) => handleReadingLevelChange(e.target.value)}
                disabled={isSavingReadingLevel || isParentMode}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  backgroundColor: isSavingReadingLevel || isParentMode ? "#f7f7f7" : "white",
                  cursor: isParentMode ? "not-allowed" : undefined,
                }}
              >
                {READING_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
              <Text fontSize="xs" color="charcoal.400" fontFamily="body" mt={1}>
                Adjusts vocabulary and complexity in conversations
              </Text>
            </Box>

            <Box bg="white" borderRadius="lg" p={4} shadow="xs" opacity={isParentMode ? 0.7 : 1}>
              <HStack mb={3}>
                <FiVolume2 color="#AD60BF" />
                <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                  Audio Controls
                </Text>
              </HStack>
              <VStack gap={3} align="stretch">
                <HStack justify="space-between">
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" fontFamily="heading" color="charcoal.500" fontWeight="500">
                      Text-to-Speech
                    </Text>
                    <Text fontSize="xs" color="charcoal.400" fontFamily="body">
                      Read AI responses aloud
                    </Text>
                  </VStack>
                  <Switch.Root
                    checked={scholar?.ttsEnabled !== false}
                    disabled={isParentMode}
                    onCheckedChange={(e) =>
                      updateAudioSettings({
                        scholarId: scholarId as Id<"users">,
                        ttsEnabled: e.checked,
                      })
                    }
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                </HStack>
                <HStack justify="space-between">
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" fontFamily="heading" color="charcoal.500" fontWeight="500">
                      Voice Dictation
                    </Text>
                    <Text fontSize="xs" color="charcoal.400" fontFamily="body">
                      Speech-to-text input
                    </Text>
                  </VStack>
                  <Switch.Root
                    checked={scholar?.sttEnabled !== false}
                    disabled={isParentMode}
                    onCheckedChange={(e) =>
                      updateAudioSettings({
                        scholarId: scholarId as Id<"users">,
                        sttEnabled: e.checked,
                      })
                    }
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                </HStack>
              </VStack>
            </Box>
          </VStack>
        )}

        {/* Chats tab */}
        {activeTab === "chats" && (
          <VStack gap={4} align="stretch">
            {/* Recent chats about this scholar */}
            <Box>
              <Text fontFamily="heading" fontWeight="600" fontSize="sm" color="navy.500" mb={3}>
                Recent chats about this scholar
              </Text>
              {chatSessions.length === 0 ? (
                <Text fontFamily="body" fontSize="sm" color="charcoal.300" fontStyle="italic">
                  No chats yet about this scholar.
                </Text>
              ) : (
                <VStack gap={1} align="stretch">
                  {chatSessions.map((s) => (
                    <Button
                      key={String(s._id)}
                      variant="ghost"
                      size="sm"
                      justifyContent="flex-start"
                      fontFamily="heading"
                      fontSize="xs"
                      color="violet.600"
                      _hover={{ bg: "violet.50" }}
                      onClick={() => router.push(`/teacher?tab=assistant&session=${String(s._id)}`)}
                    >
                      <FiMessageSquare style={{ marginRight: "6px", flexShrink: 0 }} />
                      <Text as="span" overflow="hidden" style={{ textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.title}
                      </Text>
                    </Button>
                  ))}
                </VStack>
              )}
            </Box>

            {/* Quick-launch chat box */}
            <Box>
              <Text fontFamily="heading" fontWeight="600" fontSize="sm" color="navy.500" mb={2}>
                Start a new chat about this scholar
              </Text>
              <QuickChatBox
                scholarId={scholarId}
                createSession={createChatSession}
                onNavigate={(id) => router.push(`/teacher?tab=assistant&session=${id}`)}
              />
            </Box>
          </VStack>
        )}
      </Box>

      {/* Reset Password confirmation / result dialog */}
      <Dialog.Root
        open={showResetPassword}
        onOpenChange={(e) => {
          if (!e.open) {
            setShowResetPassword(false);
            setTempPassword(null);
          }
        }}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <StyledDialogContent>
              <Dialog.Header px={6} pt={5} pb={2}>
                <Dialog.Title fontFamily="heading" fontSize="lg" color="navy.500">
                  {tempPassword ? "Password Reset" : "Reset Password"}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body px={6} py={3}>
                {tempPassword ? (
                  <VStack gap={2} align="start">
                    <Text fontSize="sm" fontFamily="body" color="charcoal.500">
                      The temporary password for <strong>{scholar?.name ?? "this scholar"}</strong> is:
                    </Text>
                    <Text
                      fontSize="2xl"
                      fontFamily="heading"
                      fontWeight="700"
                      color="violet.600"
                      letterSpacing="widest"
                      textAlign="center"
                      w="full"
                      py={2}
                    >
                      {tempPassword}
                    </Text>
                    <Text fontSize="xs" fontFamily="body" color="charcoal.400">
                      Give this to {scholar?.name ?? "the scholar"} to log in. They will be asked to set a new password.
                    </Text>
                  </VStack>
                ) : (
                  <Text fontSize="sm" fontFamily="body" color="charcoal.500">
                    Reset password for <strong>{scholar?.name ?? "this scholar"}</strong>? They will need a temporary password to log back in.
                  </Text>
                )}
              </Dialog.Body>
              <Dialog.Footer px={6} pb={5} pt={2} gap={2}>
                {tempPassword ? (
                  <Button
                    size="sm"
                    bg="violet.500"
                    color="white"
                    _hover={{ bg: "violet.600" }}
                    fontFamily="heading"
                    onClick={() => {
                      setShowResetPassword(false);
                      setTempPassword(null);
                    }}
                  >
                    Done
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      fontFamily="heading"
                      onClick={() => setShowResetPassword(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      bg="violet.500"
                      color="white"
                      _hover={{ bg: "violet.600" }}
                      fontFamily="heading"
                      onClick={async () => {
                        const result = await resetPassword({ scholarId: scholarId as Id<"users"> });
                        setTempPassword(result.tempPassword);
                      }}
                    >
                      Reset Password
                    </Button>
                  </>
                )}
              </Dialog.Footer>
            </StyledDialogContent>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Delete confirmation dialog */}
      <Dialog.Root
        open={showDeleteConfirm}
        onOpenChange={(e) => setShowDeleteConfirm(e.open)}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <StyledDialogContent>
              <Dialog.Header px={6} pt={5} pb={2}>
                <Dialog.Title fontFamily="heading" fontSize="lg" color="navy.500">
                  Delete Scholar
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body px={6} py={3}>
                <Text fontSize="sm" fontFamily="body" color="charcoal.500">
                  Delete <strong>{scholar?.name ?? "this scholar"}</strong> and ALL their data? This cannot be undone.
                </Text>
              </Dialog.Body>
              <Dialog.Footer px={6} pb={5} pt={2} gap={2}>
                <Button
                  size="sm"
                  variant="ghost"
                  fontFamily="heading"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  bg="red.500"
                  color="white"
                  _hover={{ bg: "red.600" }}
                  fontFamily="heading"
                  onClick={async () => {
                    setShowDeleteConfirm(false);
                    onDelete?.();
                    await deleteUser({ userId: scholarId as Id<"users"> });
                  }}
                >
                  Delete
                </Button>
              </Dialog.Footer>
            </StyledDialogContent>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Parent Access Dialog */}
      <ParentAccessDialog
        scholarId={scholarId}
        scholarName={scholar?.name ?? "Scholar"}
        open={showParentAccess}
        onClose={() => setShowParentAccess(false)}
        mode={isParentMode ? "self" : "teacher"}
      />
    </Box>
  );
}

// ── QuickChatBox ─────────────────────────────────────────────────────

function QuickChatBox({
  scholarId,
  createSession,
  onNavigate,
}: {
  scholarId: string;
  createSession: (args: { scholarId: Id<"users"> }) => Promise<Id<"chatSessions">>;
  onNavigate: (sessionId: string) => void;
}) {
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const sendSessionMessage = useMutation(api.curriculumAssistant.sendSessionMessage);
  const { user } = useCurrentUser();

  const handleSubmit = async () => {
    const text = value.trim();
    if (!text || isLoading) return;
    setIsLoading(true);
    try {
      const sessionId = await createSession({ scholarId: scholarId as Id<"users"> });
      await sendSessionMessage({ sessionId, message: text });
      onNavigate(String(sessionId));
    } catch (e) {
      console.error("QuickChatBox error:", e);
      setIsLoading(false);
    }
  };

  return (
    <VStack gap={2} align="stretch">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        placeholder="Ask something about this scholar…"
        rows={2}
        resize="none"
        bg="white"
        border="1px solid"
        borderColor="gray.300"
        borderRadius="lg"
        fontFamily="body"
        fontSize="sm"
        disabled={isLoading || !user}
      />
      <Button
        size="sm"
        bg="violet.500"
        color="white"
        fontFamily="heading"
        fontSize="xs"
        _hover={{ bg: "violet.600" }}
        _disabled={{ opacity: 0.4 }}
        disabled={!value.trim() || isLoading || !user}
        onClick={handleSubmit}
        alignSelf="flex-end"
      >
        {isLoading ? <Spinner size="xs" /> : <><FiMessageSquare style={{ marginRight: "4px" }} />Start chat</>}
      </Button>
    </VStack>
  );
}
