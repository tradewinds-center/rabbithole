"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Input,
  Textarea,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import {
  FiX,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiBook,
  FiSave,
} from "react-icons/fi";

interface Project {
  id: string;
  title: string;
  description: string | null;
  systemPrompt: string | null;
  rubric: string | null;
  targetBloomLevel: string | null;
  isActive: boolean;
  teacherName: string | null;
  createdAt: string;
}

interface ProjectManagerProps {
  onClose: () => void;
}

const BLOOM_LEVELS = [
  { value: "", label: "None" },
  { value: "remember", label: "Remember" },
  { value: "understand", label: "Understand" },
  { value: "apply", label: "Apply" },
  { value: "analyze", label: "Analyze" },
  { value: "evaluate", label: "Evaluate" },
  { value: "create", label: "Create" },
];

export function ProjectManager({ onClose }: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    systemPrompt: "",
    rubric: "",
    targetBloomLevel: "",
  });

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
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Start creating a new project
  const handleStartCreate = () => {
    setFormData({
      title: "",
      description: "",
      systemPrompt: "",
      rubric: "",
      targetBloomLevel: "",
    });
    setEditingProject(null);
    setIsCreating(true);
  };

  // Start editing a project
  const handleStartEdit = (project: Project) => {
    setFormData({
      title: project.title,
      description: project.description || "",
      systemPrompt: project.systemPrompt || "",
      rubric: project.rubric || "",
      targetBloomLevel: project.targetBloomLevel || "",
    });
    setEditingProject(project);
    setIsCreating(true);
  };

  // Save project (create or update)
  const handleSave = async () => {
    if (!formData.title.trim()) return;

    setIsSaving(true);
    try {
      if (editingProject) {
        // Update existing project
        const res = await fetch(`/api/projects/${editingProject.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          fetchProjects();
          setIsCreating(false);
          setEditingProject(null);
        }
      } else {
        // Create new project
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          fetchProjects();
          setIsCreating(false);
        }
      }
    } catch (error) {
      console.error("Error saving project:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete (deactivate) project
  const handleDelete = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchProjects();
      }
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setIsCreating(false);
    setEditingProject(null);
  };

  if (isLoading) {
    return (
      <Box
        w={{ base: "full", md: "450px" }}
        bg="white"
        borderLeft="1px solid"
        borderColor="gray.200"
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
    <Box
      w={{ base: "full", md: "450px" }}
      bg="white"
      borderLeft="1px solid"
      borderColor="gray.200"
      h="full"
      display="flex"
      flexDir="column"
      position={{ base: "absolute", md: "relative" }}
      right={0}
      zIndex={30}
    >
      {/* Header */}
      <Flex
        p={4}
        borderBottom="1px solid"
        borderColor="gray.200"
        justify="space-between"
        align="center"
        bg="navy.500"
      >
        <HStack gap={3}>
          <FiBook color="white" size={20} />
          <Text fontWeight="600" fontFamily="heading" color="white" fontSize="lg">
            {isCreating ? (editingProject ? "Edit Project" : "New Project") : "Projects"}
          </Text>
        </HStack>
        <IconButton
          aria-label="Close"
          variant="ghost"
          color="white"
          _hover={{ bg: "whiteAlpha.200" }}
          onClick={onClose}
        >
          <FiX />
        </IconButton>
      </Flex>

      {/* Content */}
      <Box flex={1} overflow="auto" p={4}>
        {isCreating ? (
          /* Create/Edit Form */
          <VStack gap={4} align="stretch">
            <Box>
              <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                Title *
              </Text>
              <Input
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Hawaiian Ecosystem Research"
                fontFamily="body"
              />
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                Description
              </Text>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the project for scholars"
                rows={2}
                fontFamily="body"
              />
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                System Prompt (AI Instructions)
              </Text>
              <Textarea
                value={formData.systemPrompt}
                onChange={(e) => setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder="Instructions for the AI tutor. e.g., 'Help the scholar research Hawaiian ecosystems. Focus on native species and conservation efforts. Encourage them to think about human impact.'"
                rows={4}
                fontFamily="body"
                fontSize="sm"
              />
              <Text fontSize="xs" color="charcoal.400" fontFamily="body" mt={1}>
                This guides how the AI interacts with scholars on this project.
              </Text>
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                Rubric / Assessment Criteria
              </Text>
              <Textarea
                value={formData.rubric}
                onChange={(e) => setFormData((prev) => ({ ...prev, rubric: e.target.value }))}
                placeholder="What should scholars demonstrate? e.g., 'Identify 3 native species. Explain one conservation challenge. Propose a creative solution.'"
                rows={3}
                fontFamily="body"
                fontSize="sm"
              />
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="600" fontFamily="heading" color="navy.500" mb={1}>
                Target Bloom Level
              </Text>
              <select
                value={formData.targetBloomLevel}
                onChange={(e) => setFormData((prev) => ({ ...prev, targetBloomLevel: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  fontSize: "14px",
                  fontFamily: "inherit",
                }}
              >
                {BLOOM_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </Box>

            <HStack gap={2} pt={4}>
              <Button
                flex={1}
                variant="outline"
                fontFamily="heading"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                flex={1}
                bg="violet.500"
                color="white"
                _hover={{ bg: "violet.600" }}
                fontFamily="heading"
                onClick={handleSave}
                disabled={isSaving || !formData.title.trim()}
              >
                {isSaving ? <Spinner size="sm" /> : <><FiSave style={{ marginRight: "8px" }} /> Save</>}
              </Button>
            </HStack>
          </VStack>
        ) : (
          /* Projects List */
          <VStack gap={3} align="stretch">
            <Button
              w="full"
              bg="violet.500"
              color="white"
              _hover={{ bg: "violet.600" }}
              fontFamily="heading"
              onClick={handleStartCreate}
            >
              <FiPlus style={{ marginRight: "8px" }} />
              Create Project
            </Button>

            {projects.length === 0 ? (
              <VStack py={8} gap={2}>
                <FiBook size={32} color="#c1c1c1" />
                <Text color="charcoal.400" fontFamily="heading" fontSize="sm">
                  No projects yet
                </Text>
              </VStack>
            ) : (
              projects.map((project) => (
                <Box
                  key={project.id}
                  p={4}
                  bg="gray.50"
                  borderRadius="lg"
                  borderLeft="3px solid"
                  borderColor={project.isActive ? "violet.500" : "gray.300"}
                  opacity={project.isActive ? 1 : 0.6}
                >
                  <HStack justify="space-between" mb={2}>
                    <VStack gap={0} align="start">
                      <Text fontWeight="600" fontFamily="heading" color="navy.500">
                        {project.title}
                      </Text>
                      {project.targetBloomLevel && (
                        <Badge bg="violet.100" color="violet.700" fontSize="xs">
                          {project.targetBloomLevel}
                        </Badge>
                      )}
                    </VStack>
                    <HStack gap={1}>
                      <IconButton
                        aria-label="Edit"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStartEdit(project)}
                      >
                        <FiEdit2 />
                      </IconButton>
                      {project.isActive && (
                        <IconButton
                          aria-label="Delete"
                          size="sm"
                          variant="ghost"
                          color="red.500"
                          onClick={() => handleDelete(project.id)}
                        >
                          <FiTrash2 />
                        </IconButton>
                      )}
                    </HStack>
                  </HStack>
                  {project.description && (
                    <Text fontSize="sm" color="charcoal.500" fontFamily="body" mb={2}>
                      {project.description}
                    </Text>
                  )}
                  {!project.isActive && (
                    <Badge bg="gray.200" color="gray.600" fontSize="xs">
                      Archived
                    </Badge>
                  )}
                </Box>
              ))
            )}
          </VStack>
        )}
      </Box>
    </Box>
  );
}
