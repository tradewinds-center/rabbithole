"use client";

import { useState, useEffect } from "react";
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
  Dialog,
  Portal,
} from "@chakra-ui/react";
import {
  FiPlus,
  FiTrash2,
  FiFileText,
  FiDownload,
  FiEye,
  FiEyeOff,
  FiAlertCircle,
  FiCheckCircle,
  FiUpload,
} from "react-icons/fi";
import { StyledDialogContent } from "@/components/ui/StyledDialogContent";
import { ProposalDiffModal } from "@/components/ProposalDiffModal";

/**
 * Phase 2 — per-scholar document upload, redacted summary view, and
 * proposal-approval flow. Teacher/admin-only tab inside ScholarProfile.
 *
 * SAFETY: every field exposed in this component is either metadata or the
 * AI-produced redactedSummary + aiKeyFindings. The raw extractedText is
 * gated behind an explicit "Show extracted text" toggle that logs
 * view_extracted via api.scholarDocuments.logExtractedView. Never render
 * raw text by default.
 */

interface DocumentsTabProps {
  scholarId: string;
}

type DocumentKind = "assessment" | "iep" | "parent_email" | "observation" | "other";
type ProcessingStatus = "pending" | "extracting" | "redacting" | "ready" | "error";

const KIND_LABEL: Record<DocumentKind, string> = {
  assessment: "Assessment",
  iep: "IEP / 504",
  parent_email: "Parent email",
  observation: "Observation",
  other: "Other",
};

const KIND_COLOR: Record<DocumentKind, { bg: string; color: string }> = {
  assessment: { bg: "violet.100", color: "violet.700" },
  iep: { bg: "orange.100", color: "orange.700" },
  parent_email: { bg: "cyan.100", color: "cyan.700" },
  observation: { bg: "green.100", color: "green.700" },
  other: { bg: "gray.100", color: "gray.700" },
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

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Upload Modal ───────────────────────────────────────────────────

function UploadModal({
  scholarId,
  open,
  onClose,
}: {
  scholarId: string;
  open: boolean;
  onClose: () => void;
}) {
  const generateUploadUrl = useMutation(api.scholarDocuments.generateUploadUrl);
  const registerUpload = useMutation(api.scholarDocuments.registerUpload);

  const [kind, setKind] = useState<DocumentKind>("assessment");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setKind("assessment");
    setTitle("");
    setFile(null);
    setError(null);
    setIsUploading(false);
  };

  const handleClose = () => {
    if (isUploading) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Please choose a file to upload");
      return;
    }
    if (!title.trim()) {
      setError("Please give the document a title");
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const url = await generateUploadUrl();
      const putRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`);
      }
      const { storageId } = (await putRes.json()) as { storageId: Id<"_storage"> };
      await registerUpload({
        scholarId: scholarId as Id<"users">,
        kind,
        title: title.trim(),
        fileStorageId: storageId,
        fileMimeType: file.type || undefined,
        fileSizeBytes: file.size,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && handleClose()} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <StyledDialogContent maxW="md">
            <Dialog.Header px={6} pt={5} pb={2}>
              <Dialog.Title fontFamily="heading" fontSize="lg" color="navy.500">
                Upload Scholar Document
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body px={6} py={3}>
              <VStack gap={3} align="stretch">
                <Box>
                  <Text fontSize="xs" color="charcoal.500" mb={1} fontFamily="heading">
                    Kind
                  </Text>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as DocumentKind)}
                    disabled={isUploading}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      width: "100%",
                      background: "#f7fafc",
                    }}
                  >
                    <option value="assessment">Cognitive Assessment</option>
                    <option value="iep">IEP / 504 Plan</option>
                    <option value="parent_email">Parent Email / Note</option>
                    <option value="observation">Observation</option>
                    <option value="other">Other</option>
                  </select>
                </Box>

                <Box>
                  <Text fontSize="xs" color="charcoal.500" mb={1} fontFamily="heading">
                    Title
                  </Text>
                  <Input
                    size="sm"
                    placeholder="e.g. Neuropsych eval, Feb 2026"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isUploading}
                    bg="gray.50"
                    fontFamily="body"
                  />
                </Box>

                <Box>
                  <Text fontSize="xs" color="charcoal.500" mb={1} fontFamily="heading">
                    File (PDF or image)
                  </Text>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setFile(f ?? null);
                    }}
                    disabled={isUploading}
                    style={{ fontSize: "13px" }}
                  />
                  {file && (
                    <Text fontSize="xs" color="charcoal.400" mt={1}>
                      {file.name} · {formatBytes(file.size)}
                    </Text>
                  )}
                </Box>

                {error && (
                  <Text fontSize="sm" color="red.500" fontFamily="body">
                    {error}
                  </Text>
                )}

                <Text fontSize="xs" color="charcoal.400" fontFamily="body">
                  The file will be extracted and redacted automatically. The
                  redacted summary is what downstream AI sees — the raw text
                  stays teacher-only.
                </Text>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer px={6} pb={5} pt={2} gap={2}>
              <Button size="sm" variant="ghost" fontFamily="heading" onClick={handleClose} disabled={isUploading}>
                Cancel
              </Button>
              <Button
                size="sm"
                bg="violet.500"
                color="white"
                _hover={{ bg: "violet.600" }}
                fontFamily="heading"
                onClick={handleSubmit}
                disabled={isUploading || !file || !title.trim()}
              >
                {isUploading ? (
                  <>
                    <Spinner size="xs" mr={2} /> Uploading...
                  </>
                ) : (
                  <>
                    <FiUpload style={{ display: "inline", marginRight: "4px" }} /> Upload
                  </>
                )}
              </Button>
            </Dialog.Footer>
          </StyledDialogContent>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

// ─── Status Pill ────────────────────────────────────────────────────

function StatusPill({ status }: { status: ProcessingStatus }) {
  const color =
    status === "ready"
      ? { bg: "green.100", color: "green.700", label: "Ready" }
      : status === "error"
      ? { bg: "red.100", color: "red.700", label: "Error" }
      : status === "pending"
      ? { bg: "gray.100", color: "gray.600", label: "Queued" }
      : status === "extracting"
      ? { bg: "blue.100", color: "blue.700", label: "Extracting..." }
      : { bg: "violet.100", color: "violet.700", label: "Redacting..." };

  const isSpinning = status === "pending" || status === "extracting" || status === "redacting";

  return (
    <Badge bg={color.bg} color={color.color} fontSize="2xs" fontFamily="heading">
      {isSpinning && <Spinner size="xs" mr={1} />}
      {color.label}
    </Badge>
  );
}

// ─── Document Detail (redacted summary + actions) ───────────────────

function DocumentDetail({
  documentId,
  onClose,
  onDeleted,
}: {
  documentId: Id<"scholarDocuments">;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const doc = useQuery(api.scholarDocuments.get, { documentId });
  const proposal = useQuery(api.scholarDocumentProposals.getLatestProposal, { documentId });

  const logSummaryView = useMutation(api.scholarDocuments.logSummaryView);
  const logExtractedView = useMutation(api.scholarDocuments.logExtractedView);
  const generateProposal = useMutation(api.scholarDocumentProposals.generateProposal);
  const removeDocument = useMutation(api.scholarDocuments.deleteDocument);

  const [showExtracted, setShowExtracted] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [isLoadingExtracted, setIsLoadingExtracted] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasSummary = doc?.redactedSummary != null;

  // Fire the view_summary audit entry when the component mounts with a doc
  // whose summary is readable.
  useEffect(() => {
    if (hasSummary) {
      logSummaryView({ documentId }).catch(() => {
        /* non-fatal */
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, hasSummary]);

  const getExtractedText = useQuery(
    api.scholarDocuments.getExtractedText,
    showExtracted ? { documentId } : "skip"
  );

  useEffect(() => {
    if (showExtracted && getExtractedText) {
      setExtractedText(getExtractedText.extractedText);
      logExtractedView({ documentId }).catch(() => {
        /* non-fatal */
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExtracted, getExtractedText?._id]);

  if (!doc) {
    return (
      <Flex justify="center" py={6}>
        <Spinner size="sm" color="violet.500" />
      </Flex>
    );
  }

  const handleGenerateProposal = async () => {
    setIsGeneratingProposal(true);
    try {
      await generateProposal({ documentId });
    } catch (err) {
      console.error("generateProposal failed:", err);
    } finally {
      setIsGeneratingProposal(false);
    }
  };

  const handleDelete = async () => {
    try {
      await removeDocument({ documentId });
      setShowDeleteConfirm(false);
      onDeleted();
    } catch (err) {
      console.error("deleteDocument failed:", err);
    }
  };

  const isReady = doc.processingStatus === "ready";
  const hasProposal = proposal != null;

  return (
    <Box bg="white" borderRadius="lg" p={4} shadow="sm" borderLeft="3px solid" borderColor="violet.400">
      <HStack justify="space-between" align="start" mb={2}>
        <VStack align="start" gap={1} flex={1} minW={0}>
          <HStack gap={2}>
            <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="md">
              {doc.title}
            </Text>
            <Badge
              bg={KIND_COLOR[doc.kind].bg}
              color={KIND_COLOR[doc.kind].color}
              fontSize="2xs"
              fontFamily="heading"
            >
              {KIND_LABEL[doc.kind]}
            </Badge>
            <StatusPill status={doc.processingStatus} />
          </HStack>
          <Text fontSize="xs" color="charcoal.400" fontFamily="body">
            Uploaded {timeAgo(doc._creationTime)}
            {doc.fileSizeBytes ? ` · ${formatBytes(doc.fileSizeBytes)}` : ""}
          </Text>
        </VStack>
        <IconButton
          aria-label="Close detail"
          size="xs"
          variant="ghost"
          color="charcoal.400"
          onClick={onClose}
        >
          ✕
        </IconButton>
      </HStack>

      {doc.processingError && (
        <Box bg="red.50" borderRadius="md" p={3} my={3}>
          <HStack gap={2} color="red.700">
            <FiAlertCircle />
            <Text fontSize="sm" fontFamily="body">
              Processing error: {doc.processingError}
            </Text>
          </HStack>
        </Box>
      )}

      {!isReady && doc.processingStatus !== "error" && (
        <Box bg="gray.50" borderRadius="md" p={3} my={3}>
          <HStack gap={2}>
            <Spinner size="sm" color="violet.500" />
            <Text fontSize="sm" color="charcoal.500" fontFamily="body">
              Extracting + redacting document. This usually takes 30–60 seconds.
            </Text>
          </HStack>
        </Box>
      )}

      {isReady && doc.redactedSummary && (
        <Box mt={3}>
          <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="charcoal.500" mb={1}>
            REDACTED SUMMARY
          </Text>
          <Text
            fontSize="sm"
            color="charcoal.600"
            fontFamily="body"
            lineHeight="1.6"
            whiteSpace="pre-wrap"
          >
            {doc.redactedSummary}
          </Text>
        </Box>
      )}

      {isReady && doc.aiKeyFindings && doc.aiKeyFindings.length > 0 && (
        <Box mt={4}>
          <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="charcoal.500" mb={1}>
            KEY FINDINGS
          </Text>
          <VStack align="start" gap={1}>
            {doc.aiKeyFindings.map((f, i) => (
              <HStack key={i} align="start" gap={2}>
                <Text color="violet.500" fontSize="sm">
                  •
                </Text>
                <Text fontSize="sm" color="charcoal.600" fontFamily="body">
                  {f}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      {isReady && (
        <Box mt={4} pt={3} borderTop="1px solid" borderColor="gray.100">
          <HStack gap={2} wrap="wrap">
            {hasProposal ? (
              <Button
                size="sm"
                bg="violet.500"
                color="white"
                _hover={{ bg: "violet.600" }}
                fontFamily="heading"
                onClick={() => setShowDiff(true)}
              >
                <FiCheckCircle style={{ display: "inline", marginRight: "4px" }} />
                View proposal
                {proposal?.appliedAt ? " (applied)" : ""}
              </Button>
            ) : (
              <Button
                size="sm"
                bg="violet.500"
                color="white"
                _hover={{ bg: "violet.600" }}
                fontFamily="heading"
                onClick={handleGenerateProposal}
                disabled={isGeneratingProposal}
              >
                {isGeneratingProposal ? (
                  <>
                    <Spinner size="xs" mr={2} /> Generating...
                  </>
                ) : (
                  "Generate proposal"
                )}
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              fontFamily="heading"
              onClick={() => setShowExtracted((v) => !v)}
            >
              {showExtracted ? (
                <>
                  <FiEyeOff style={{ display: "inline", marginRight: "4px" }} /> Hide extracted text
                </>
              ) : (
                <>
                  <FiEye style={{ display: "inline", marginRight: "4px" }} /> Show extracted text
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              color="red.500"
              fontFamily="heading"
              _hover={{ bg: "red.50" }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <FiTrash2 style={{ display: "inline", marginRight: "4px" }} /> Delete
            </Button>
          </HStack>
        </Box>
      )}

      {showExtracted && (
        <Box mt={4} p={3} bg="yellow.50" borderRadius="md" border="1px solid" borderColor="yellow.200">
          <HStack gap={2} mb={2}>
            <FiAlertCircle color="#975A16" />
            <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="yellow.800">
              FULL EXTRACTED TEXT (audited)
            </Text>
          </HStack>
          {extractedText === null && isLoadingExtracted ? (
            <Spinner size="sm" color="violet.500" />
          ) : (
            <Text
              fontSize="xs"
              color="charcoal.700"
              fontFamily="mono"
              lineHeight="1.5"
              whiteSpace="pre-wrap"
              maxH="300px"
              overflowY="auto"
            >
              {extractedText ?? "(no text extracted)"}
            </Text>
          )}
        </Box>
      )}

      {showDiff && proposal && (
        <ProposalDiffModal
          documentId={documentId}
          scholarId={doc.scholarId}
          proposal={proposal.proposal}
          appliedAt={proposal.appliedAt ?? null}
          rejectedAt={proposal.rejectedAt ?? null}
          onClose={() => setShowDiff(false)}
        />
      )}

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
                  Delete Document
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body px={6} py={3}>
                <Text fontSize="sm" fontFamily="body" color="charcoal.500">
                  Delete <strong>{doc.title}</strong>? This removes the stored
                  file and document row. Audit log entries are retained.
                </Text>
              </Dialog.Body>
              <Dialog.Footer px={6} pb={5} pt={2} gap={2}>
                <Button size="sm" variant="ghost" fontFamily="heading" onClick={() => setShowDeleteConfirm(false)}>
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

// ─── Document Card (list item) ──────────────────────────────────────

function DocumentCard({
  doc,
  onClick,
  isActive,
}: {
  doc: {
    _id: Id<"scholarDocuments">;
    _creationTime: number;
    kind: DocumentKind;
    title: string;
    processingStatus: ProcessingStatus;
    fileSizeBytes?: number;
  };
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <Box
      bg="white"
      borderRadius="lg"
      p={3}
      shadow="xs"
      cursor="pointer"
      borderLeft="3px solid"
      borderColor={isActive ? "violet.500" : "gray.200"}
      _hover={{ borderColor: "violet.400", shadow: "sm" }}
      onClick={onClick}
    >
      <HStack justify="space-between" align="start" mb={1} gap={2}>
        <HStack gap={2} flex={1} minW={0}>
          <FiFileText color="#AD60BF" />
          <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm" truncate>
            {doc.title}
          </Text>
        </HStack>
        <StatusPill status={doc.processingStatus} />
      </HStack>
      <HStack gap={2} mt={1}>
        <Badge
          bg={KIND_COLOR[doc.kind].bg}
          color={KIND_COLOR[doc.kind].color}
          fontSize="2xs"
          fontFamily="heading"
        >
          {KIND_LABEL[doc.kind]}
        </Badge>
        <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
          {timeAgo(doc._creationTime)}
        </Text>
        {doc.fileSizeBytes ? (
          <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
            {formatBytes(doc.fileSizeBytes)}
          </Text>
        ) : null}
      </HStack>
    </Box>
  );
}

// ─── Main component ─────────────────────────────────────────────────

export function DocumentsTab({ scholarId }: DocumentsTabProps) {
  const docs = useQuery(api.scholarDocuments.listForScholar, {
    scholarId: scholarId as Id<"users">,
  });
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<Id<"scholarDocuments"> | null>(null);

  if (docs === undefined) {
    return (
      <Flex justify="center" py={8}>
        <Spinner size="md" color="violet.500" />
      </Flex>
    );
  }

  return (
    <VStack gap={4} align="stretch" maxW="800px">
      <HStack justify="space-between">
        <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
          Scholar Documents
        </Text>
        <Button
          size="xs"
          bg="violet.500"
          color="white"
          _hover={{ bg: "violet.600" }}
          fontFamily="heading"
          onClick={() => setShowUpload(true)}
        >
          <FiPlus style={{ marginRight: "3px" }} /> Upload Document
        </Button>
      </HStack>

      <Text fontSize="xs" color="charcoal.400" fontFamily="body">
        Upload cognitive assessments, IEPs, parent notes, or observations.
        Each document is extracted and redacted automatically. Teachers can then
        generate a proposal of directives + seeds to seed this scholar's tutor.
      </Text>

      {docs.length === 0 ? (
        <Box bg="gray.50" borderRadius="lg" p={6}>
          <Text fontSize="sm" color="charcoal.400" fontFamily="body" textAlign="center">
            No documents yet. Upload a cognitive assessment to get started.
          </Text>
        </Box>
      ) : (
        <VStack gap={2} align="stretch">
          {docs.map((d) => (
            <DocumentCard
              key={d._id}
              doc={d}
              isActive={selectedDocId === d._id}
              onClick={() =>
                setSelectedDocId((prev) => (prev === d._id ? null : d._id))
              }
            />
          ))}
        </VStack>
      )}

      {selectedDocId && (
        <DocumentDetail
          documentId={selectedDocId}
          onClose={() => setSelectedDocId(null)}
          onDeleted={() => setSelectedDocId(null)}
        />
      )}

      <UploadModal
        scholarId={scholarId}
        open={showUpload}
        onClose={() => setShowUpload(false)}
      />
    </VStack>
  );
}
