"use client";

import { useState, useCallback } from "react";
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
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import {
  FiPlus,
  FiTrash2,
  FiBookOpen,
  FiFileText,
  FiExternalLink,
  FiUser,
  FiFolder,
  FiEdit3,
  FiCpu,
  FiClipboard,
} from "react-icons/fi";
import { Notebook, Plant, ShootingStar } from "@phosphor-icons/react";
import { MasteryTab } from "@/components/MasteryTab";
import { SeedsTab } from "@/components/SeedsTab";
import { SignalsTab } from "@/components/SignalsTab";
import { StandardsTab } from "@/components/StandardsTab";

export type ScholarTabKey = "dossier" | "mastery" | "standards" | "seeds" | "strengths" | "documents" | "observations" | "reports" | "reading";
type TabKey = ScholarTabKey;

interface ScholarProfileProps {
  scholarId: string;
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  onDelete?: () => void;
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
  { key: "dossier", label: "Dossier", icon: FiUser },
  { key: "mastery", label: "Mastery", icon: FiCpu },
  { key: "standards", label: "Standards", icon: FiClipboard },
  { key: "seeds", label: "Seeds", icon: Plant },
  { key: "strengths", label: "Strengths", icon: ShootingStar },
  { key: "documents", label: "Documents", icon: FiFolder },
  { key: "observations", label: "Notes", icon: FiFileText },
  { key: "reports", label: "Reports", icon: Notebook },
  { key: "reading", label: "Reading Level", icon: FiBookOpen },
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

export function ScholarProfile({ scholarId, activeTab: controlledTab, onTabChange, onDelete }: ScholarProfileProps) {
  const { user: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const deleteUser = useMutation(api.users.deleteUser);
  const profile = useQuery(api.scholars.getProfile, { scholarId: scholarId as Id<"users"> });
  const observations = useQuery(api.observations.listByScholar, { scholarId: scholarId as Id<"users"> }) ?? [];
  // masteryByDomain moved to MasteryTab component
  const dossierContent = useQuery(api.dossier.getForTeacher, { scholarId: scholarId as Id<"users"> });
  const artifacts = useQuery(api.artifacts.getByScholar, { scholarId: scholarId as Id<"users"> });
  const reports = useQuery(api.reports.list, { scholarId: scholarId as Id<"users"> }) ?? [];
  const createReport = useMutation(api.reports.create);
  const removeReport = useMutation(api.reports.remove);
  const updateDossier = useMutation(api.dossier.updateByTeacher);
  const updateReadingLevel = useMutation(api.scholars.updateReadingLevel);
  const addObservation = useMutation(api.observations.add);
  const removeObservation = useMutation(api.observations.remove);
  const { scholar, stats } = profile ?? {
    scholar: null,
    stats: { projectCount: 0, messageCount: 0, observationCount: 0 },
  };

  const isLoading = profile === undefined;

  const [internalTab, setInternalTab] = useState<TabKey>("dossier");
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [dossierDraft, setDossierDraft] = useState<string | null>(null);
  const [isSavingReadingLevel, setIsSavingReadingLevel] = useState(false);
  const [newObservation, setNewObservation] = useState({ type: "praise" as "praise" | "concern" | "suggestion" | "intervention", note: "" });
  const [isAddingObservation, setIsAddingObservation] = useState(false);
  const [newReport, setNewReport] = useState({ title: "", content: "" });
  const [isAddingReport, setIsAddingReport] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
            <Text color="charcoal.400" fontSize="xs" fontFamily="heading">
              {scholar?.email}
            </Text>
          </VStack>
        </HStack>

        {/* Inline stats */}
        <HStack gap={5}>
          {[
            { value: stats.projectCount, label: "Projects" },
            { value: stats.messageCount, label: "Messages" },
            { value: stats.observationCount, label: "Concepts" },
          ].map((stat) => (
            <HStack key={stat.label} gap={1}>
              <Text fontSize="lg" fontWeight="bold" fontFamily="heading" color="navy.500">
                {stat.value}
              </Text>
              <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                {stat.label}
              </Text>
            </HStack>
          ))}
        </HStack>

        <HStack ml="auto" gap={1}>
          <Button
            size="sm"
            variant="ghost"
            color="violet.500"
            fontFamily="heading"
            fontSize="xs"
            _hover={{ bg: "violet.50" }}
            onClick={() => window.open(`/scholar?remote=${scholarId}`, "_blank")}
          >
            <FiExternalLink style={{ marginRight: "4px" }} />
            Remote View
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

        {activeTab === "strengths" && (
          <SignalsTab scholarId={scholarId} />
        )}

        {activeTab === "documents" && (
          <VStack gap={3} align="stretch" maxW="700px">
            {artifacts === undefined ? (
              <Flex justify="center" py={8}>
                <Spinner size="md" color="violet.500" />
              </Flex>
            ) : artifacts.length === 0 ? (
              <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={8}>
                No documents yet. Documents are created during projects.
              </Text>
            ) : (
              artifacts.map((artifact) => (
                <Box
                  key={artifact._id}
                  bg="white"
                  borderRadius="lg"
                  p={4}
                  shadow="xs"
                  borderLeft="3px solid"
                  borderColor={artifact.lastEditedBy === "scholar" ? "cyan.400" : "violet.400"}
                >
                  <HStack justify="space-between" align="start" mb={1}>
                    <Text fontFamily="heading" fontSize="sm" fontWeight="600" color="navy.500">
                      {artifact.title}
                    </Text>
                    <HStack gap={2}>
                      <Badge
                        bg={artifact.lastEditedBy === "scholar" ? "cyan.100" : "violet.100"}
                        color={artifact.lastEditedBy === "scholar" ? "cyan.700" : "violet.700"}
                        fontSize="xs"
                      >
                        {artifact.lastEditedBy === "scholar" ? <><FiEdit3 style={{ display: "inline", marginRight: "3px" }} />scholar</> : <><FiCpu style={{ display: "inline", marginRight: "3px" }} />ai</>}
                      </Badge>
                      <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                        {timeAgo(artifact._creationTime)}
                      </Text>
                    </HStack>
                  </HStack>
                  {artifact.content && (
                    <Text fontSize="sm" color="charcoal.500" fontFamily="body" lineHeight="1.4" mb={2} lineClamp={2}>
                      {artifact.content.slice(0, 150)}{artifact.content.length > 150 ? "..." : ""}
                    </Text>
                  )}
                  <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                    from:{" "}
                    <Text as="span" color="violet.500" cursor="pointer" _hover={{ textDecoration: "underline" }}>
                      {artifact.projectTitle}
                    </Text>
                  </Text>
                </Box>
              ))
            )}
          </VStack>
        )}

        {activeTab === "observations" && (
          <Box bg="white" borderRadius="lg" p={4} shadow="xs" maxW="700px">
            <HStack mb={3}>
              <FiFileText color="#AD60BF" />
              <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                Observations
              </Text>
            </HStack>

            {/* Add new observation */}
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
        )}

        {activeTab === "reports" && (
          <Box maxW="700px">
            {/* Add new report */}
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
                      </HStack>
                    </HStack>
                    <Text fontSize="sm" color="charcoal.600" fontFamily="body" lineHeight="1.5" whiteSpace="pre-wrap">
                      {report.content}
                    </Text>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={8}>
                No reports yet. Reports are permanent records that also feed into the AI dossier.
              </Text>
            )}
          </Box>
        )}

        {activeTab === "reading" && (
          <Box bg="white" borderRadius="lg" p={4} shadow="xs" maxW="400px">
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
              disabled={isSavingReadingLevel}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                fontSize: "14px",
                fontFamily: "inherit",
                backgroundColor: isSavingReadingLevel ? "#f7f7f7" : "white",
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
        )}
      </Box>

      {/* Delete confirmation dialog */}
      <Dialog.Root
        open={showDeleteConfirm}
        onOpenChange={(e) => setShowDeleteConfirm(e.open)}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="sm" mx={4} borderRadius="xl" overflow="hidden">
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
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}
