"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  IconButton,
  Table,
  Text,
  VStack,
  Dialog,
  Portal,
} from "@chakra-ui/react";
import { FiTrash2 } from "react-icons/fi";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

function RoleSelect({
  userId,
  currentRole,
}: {
  userId: Id<"users">;
  currentRole: string;
}) {
  const updateRole = useMutation(api.users.updateRole);

  return (
    <select
      value={currentRole}
      onChange={async (e) => {
        const role = e.target.value as "scholar" | "teacher" | "admin";
        await updateRole({ userId, role });
      }}
      style={{
        padding: "4px 8px",
        borderRadius: "6px",
        border: "1px solid #ccc",
        fontFamily: "var(--chakra-fonts-body)",
        fontSize: "14px",
      }}
    >
      <option value="scholar">scholar</option>
      <option value="teacher">teacher</option>
      <option value="admin">admin</option>
    </select>
  );
}

export default function AdminPage() {
  const { user, isLoading } = useCurrentUser();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const users = useQuery(api.users.listAllUsers);
  const deleteUser = useMutation(api.users.deleteUser);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"users">;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "admin") {
      router.push("/");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== "admin") {
    return null;
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteUser({ userId: deleteTarget.id });
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <Box minH="100vh" bg="gray.50" p={6}>
      <Container maxW="4xl">
        <VStack gap={6} align="stretch">
          <HStack justify="space-between">
            <Heading fontFamily="heading" color="navy.500" size="xl">
              Admin: Users
            </Heading>
            <HStack gap={3}>
              <Button
                size="sm"
                variant="outline"
                fontFamily="heading"
                onClick={() => router.push("/teacher")}
              >
                Teacher Dashboard
              </Button>
              <Button
                size="sm"
                variant="outline"
                fontFamily="heading"
                colorPalette="red"
                onClick={() => signOut().then(() => router.push("/login"))}
              >
                Sign Out
              </Button>
            </HStack>
          </HStack>

          <Box bg="white" borderRadius="xl" shadow="sm" overflow="hidden">
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader fontFamily="heading" pl={4}>Username</Table.ColumnHeader>
                  <Table.ColumnHeader fontFamily="heading">Name</Table.ColumnHeader>
                  <Table.ColumnHeader fontFamily="heading">Role</Table.ColumnHeader>
                  <Table.ColumnHeader fontFamily="heading">Created</Table.ColumnHeader>
                  <Table.ColumnHeader fontFamily="heading" w="50px"></Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {users?.map((u) => {
                  const isSelf = u._id === user._id;
                  return (
                    <Table.Row key={u._id}>
                      <Table.Cell fontFamily="body" pl={4}>
                        <Text fontWeight="500">{u.username ?? u.email ?? "—"}</Text>
                      </Table.Cell>
                      <Table.Cell fontFamily="body">{u.name ?? "—"}</Table.Cell>
                      <Table.Cell>
                        <RoleSelect userId={u._id} currentRole={u.role} />
                      </Table.Cell>
                      <Table.Cell fontFamily="body" fontSize="sm" color="charcoal.400">
                        {new Date(u._creationTime).toLocaleDateString()}
                      </Table.Cell>
                      <Table.Cell>
                        {!isSelf && (
                          <IconButton
                            aria-label="Delete user"
                            size="xs"
                            variant="ghost"
                            color="charcoal.300"
                            _hover={{ color: "red.500", bg: "red.50" }}
                            onClick={() =>
                              setDeleteTarget({
                                id: u._id,
                                name: u.name ?? u.username ?? u.email ?? "this user",
                              })
                            }
                          >
                            <FiTrash2 size={14} />
                          </IconButton>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        </VStack>
      </Container>

      {/* Delete confirmation dialog */}
      <Dialog.Root
        open={!!deleteTarget}
        onOpenChange={(e) => {
          if (!e.open) setDeleteTarget(null);
        }}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="sm" mx={4} borderRadius="xl">
              <Dialog.Header px={6} pt={5} pb={2}>
                <Dialog.Title fontFamily="heading" fontWeight="700" color="navy.500">
                  Delete User
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body px={6} py={3}>
                <Text fontFamily="body" color="charcoal.500">
                  Permanently delete <strong>{deleteTarget?.name}</strong> and all their projects,
                  messages, and data? This cannot be undone.
                </Text>
              </Dialog.Body>
              <Dialog.Footer px={6} pb={5} pt={3} gap={3}>
                <Dialog.CloseTrigger asChild>
                  <Button
                    variant="ghost"
                    fontFamily="heading"
                    size="sm"
                    color="charcoal.500"
                  >
                    Cancel
                  </Button>
                </Dialog.CloseTrigger>
                <Button
                  bg="red.500"
                  color="white"
                  _hover={{ bg: "red.600" }}
                  fontFamily="heading"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  loading={isDeleting}
                  loadingText="Deleting..."
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
