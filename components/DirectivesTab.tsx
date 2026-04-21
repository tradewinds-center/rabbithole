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
  Badge,
  Spinner,
  Button,
  Input,
  Textarea,
  IconButton,
  Switch,
  Dialog,
  Portal,
} from "@chakra-ui/react";
import { FiPlus, FiEdit3, FiTrash2 } from "react-icons/fi";
import { StyledDialogContent } from "@/components/ui/StyledDialogContent";

interface DirectivesTabProps {
  scholarId: string;
}

type Directive = {
  _id: Id<"teacherDirectives">;
  _creationTime: number;
  scholarId: Id<"users">;
  label: string;
  content: string;
  authorId: Id<"users">;
  isActive: boolean;
  updatedAt: number;
};

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

// ─── Directive Card ─────────────────────────────────────────────────

function DirectiveCard({ directive }: { directive: Directive }) {
  const upsert = useMutation(api.teacherDirectives.upsertByTeacher);
  const setActive = useMutation(api.teacherDirectives.setActive);
  const remove = useMutation(api.teacherDirectives.remove);

  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(directive.content);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleEditStart = () => {
    setDraftContent(directive.content);
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setDraftContent(directive.content);
  };

  const handleEditSave = async () => {
    if (!draftContent.trim()) return;
    setIsSaving(true);
    try {
      await upsert({
        scholarId: directive.scholarId,
        label: directive.label,
        content: draftContent.trim(),
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating directive:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (checked: boolean) => {
    try {
      await setActive({ id: directive._id, isActive: checked });
    } catch (err) {
      console.error("Error toggling directive:", err);
    }
  };

  const handleDelete = async () => {
    try {
      await remove({ id: directive._id });
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Error deleting directive:", err);
    }
  };

  const muted = !directive.isActive;

  return (
    <Box
      bg="white"
      borderRadius="md"
      p={3}
      borderLeft="3px solid"
      borderColor={muted ? "gray.300" : "violet.400"}
      opacity={muted ? 0.6 : 1}
    >
      <HStack justify="space-between" align="start" mb={1} gap={2}>
        <HStack gap={2} flex={1} minW={0}>
          <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
            {directive.label}
          </Text>
          {!directive.isActive && (
            <Badge bg="gray.100" color="gray.600" fontSize="2xs">
              inactive
            </Badge>
          )}
        </HStack>
        <HStack gap={1} flexShrink={0}>
          <Switch.Root
            size="sm"
            checked={directive.isActive}
            onCheckedChange={(e) => handleToggleActive(e.checked)}
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Root>
          {!isEditing && (
            <IconButton
              aria-label="Edit directive"
              size="xs"
              variant="ghost"
              color="violet.500"
              _hover={{ bg: "violet.50" }}
              onClick={handleEditStart}
            >
              <FiEdit3 />
            </IconButton>
          )}
          <IconButton
            aria-label="Delete directive"
            size="xs"
            variant="ghost"
            color="red.400"
            _hover={{ bg: "red.50", color: "red.600" }}
            onClick={() => setShowDeleteConfirm(true)}
          >
            <FiTrash2 />
          </IconButton>
        </HStack>
      </HStack>

      {isEditing ? (
        <VStack align="stretch" gap={2} mt={2}>
          <Textarea
            size="sm"
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            rows={4}
            bg="gray.50"
            fontFamily="body"
            fontSize="sm"
            autoFocus
          />
          <HStack gap={2}>
            <Button
              size="xs"
              bg="violet.500"
              color="white"
              _hover={{ bg: "violet.600" }}
              fontFamily="heading"
              onClick={handleEditSave}
              disabled={isSaving || !draftContent.trim()}
            >
              Save
            </Button>
            <Button
              size="xs"
              variant="ghost"
              fontFamily="heading"
              onClick={handleEditCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </HStack>
        </VStack>
      ) : (
        <Text
          fontSize="sm"
          color="charcoal.600"
          fontFamily="body"
          lineHeight="1.5"
          whiteSpace="pre-wrap"
        >
          {directive.content}
        </Text>
      )}

      <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mt={2}>
        Updated {timeAgo(directive.updatedAt)}
      </Text>

      {/* Delete confirmation */}
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
                  Delete Directive
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body px={6} py={3}>
                <Text fontSize="sm" fontFamily="body" color="charcoal.500">
                  Delete directive <strong>{directive.label}</strong>? This cannot be undone.
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
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              </Dialog.Footer>
            </StyledDialogContent>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}

// ─── Create Directive Form ──────────────────────────────────────────

function CreateDirectiveForm({
  scholarId,
  onDone,
}: {
  scholarId: string;
  onDone: () => void;
}) {
  const upsert = useMutation(api.teacherDirectives.upsertByTeacher);
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!label.trim() || !content.trim()) return;
    setIsSaving(true);
    try {
      await upsert({
        scholarId: scholarId as Id<"users">,
        label: label.trim(),
        content: content.trim(),
      });
      onDone();
    } catch (err) {
      console.error("Error creating directive:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box bg="white" borderRadius="md" p={3} border="1px solid" borderColor="violet.200">
      <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="navy.500" mb={2}>
        New Directive
      </Text>
      <VStack gap={2} align="stretch">
        <Input
          size="sm"
          placeholder="Label (e.g., Reading Approach)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          bg="gray.50"
          fontFamily="heading"
        />
        <Textarea
          size="sm"
          placeholder="Standing rule for the tutor to follow..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          bg="gray.50"
          fontFamily="body"
          fontSize="sm"
        />
        <HStack gap={2}>
          <Button
            size="xs"
            bg="violet.500"
            color="white"
            _hover={{ bg: "violet.600" }}
            fontFamily="heading"
            onClick={handleCreate}
            disabled={isSaving || !label.trim() || !content.trim()}
          >
            Save
          </Button>
          <Button
            size="xs"
            variant="ghost"
            fontFamily="heading"
            onClick={onDone}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </HStack>
        <Text fontSize="xs" color="charcoal.400" fontFamily="body">
          Labels are unique per scholar (case-insensitive). Reusing an existing label updates that directive.
        </Text>
      </VStack>
    </Box>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function DirectivesTab({ scholarId }: DirectivesTabProps) {
  const directives = useQuery(api.teacherDirectives.listByScholar, {
    scholarId: scholarId as Id<"users">,
  });
  const [showCreate, setShowCreate] = useState(false);

  if (directives === undefined) {
    return (
      <Flex justify="center" py={8}>
        <Spinner size="md" color="violet.500" />
      </Flex>
    );
  }

  const active = directives.filter((d) => d.isActive);
  const inactive = directives.filter((d) => !d.isActive);

  return (
    <VStack gap={4} align="stretch" maxW="700px">
      <HStack justify="space-between">
        <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
          Teacher Directives
        </Text>
        <Button
          size="xs"
          variant="ghost"
          color="violet.500"
          fontFamily="heading"
          _hover={{ bg: "violet.50" }}
          onClick={() => setShowCreate(!showCreate)}
        >
          <FiPlus style={{ marginRight: "3px" }} /> Add Directive
        </Button>
      </HStack>

      <Text fontSize="xs" color="charcoal.400" fontFamily="body">
        Standing pedagogical rules the tutor follows for this scholar. Active directives are injected into the system prompt.
      </Text>

      {showCreate && (
        <CreateDirectiveForm
          scholarId={scholarId}
          onDone={() => setShowCreate(false)}
        />
      )}

      {active.length > 0 && (
        <Box>
          <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="charcoal.400" mb={2}>
            Active ({active.length})
          </Text>
          <VStack gap={2} align="stretch">
            {active.map((d) => (
              <DirectiveCard key={d._id} directive={d} />
            ))}
          </VStack>
        </Box>
      )}

      {inactive.length > 0 && (
        <Box>
          <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="charcoal.400" mb={2}>
            Inactive ({inactive.length})
          </Text>
          <VStack gap={2} align="stretch">
            {inactive.map((d) => (
              <DirectiveCard key={d._id} directive={d} />
            ))}
          </VStack>
        </Box>
      )}

      {directives.length === 0 && !showCreate && (
        <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={8}>
          No teacher directives yet. Add one to set a standing pedagogical rule for this scholar.
        </Text>
      )}
    </VStack>
  );
}
