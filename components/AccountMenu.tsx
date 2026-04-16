"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Box, HStack, Text, Button, Menu } from "@chakra-ui/react";
import { FiLogOut, FiSettings, FiUser, FiEye, FiCpu } from "react-icons/fi";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar } from "./Avatar";
import { StatusOrb, PulseScoreDetail } from "./StatusOrb";
import { ParentAccessDialog } from "./ParentAccessDialog";

interface AccountMenuProps {
  onSignOut: () => void;
  /** Open in-page profile editor (scholar home only) */
  onOpenProfile?: () => void;
  /** Scholar-specific: current project pulse score */
  pulseScore?: number | null;
  /** Scholar-specific: timestamp of last user message */
  lastMessageAt?: number | null;
}

export function AccountMenu({
  onSignOut,
  onOpenProfile,
  pulseScore,
  lastMessageAt,
}: AccountMenuProps) {
  const { user } = useCurrentUser();
  const pathname = usePathname();

  const [showMcpDialog, setShowMcpDialog] = useState(false);

  const role = user?.role;
  const isScholar = role === "scholar";
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher" || isAdmin;
  const userName = user?.name ?? "User";
  const userUsername = user?.username;
  const userImage = user?.image;

  // Only show pulse orb for scholars
  const showOrb = isScholar && pulseScore !== undefined;

  // Derive view toggles from current path
  const isOnScholarPage = pathname?.startsWith("/scholar");
  const isOnParentPage = pathname?.startsWith("/parent");

  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          px={2}
          _hover={{ bg: "gray.100" }}
          flexShrink={0}
        >
          <HStack gap={2}>
            {showOrb && (
              <StatusOrb
                pulseScore={pulseScore ?? null}
                lastMessageAt={lastMessageAt ?? null}
                size="sm"
                disablePopover
              />
            )}
            <Avatar size="xs" name={userName} src={userImage} />
          </HStack>
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="180px">
          <Box px={3} py={2}>
            <Text fontFamily="heading" fontWeight="700" fontSize="sm" color="navy.500">
              {userName}
            </Text>
            {userUsername && (
              <Text fontFamily="heading" fontSize="xs" color="charcoal.400">
                @{userUsername}
              </Text>
            )}
          </Box>
          {showOrb && (
            <>
              <Menu.Separator />
              <Box px={3} py={2}>
                <PulseScoreDetail pulseScore={pulseScore ?? null} lastMessageAt={lastMessageAt ?? null} />
              </Box>
            </>
          )}
          <Menu.Separator />
          {/* View toggle */}
          {isScholar && isOnScholarPage && (
            <Menu.Item
              value="parent-view"
              cursor="pointer"
              onClick={() => { window.location.href = "/parent"; }}
            >
              <FiEye />
              Parent View
            </Menu.Item>
          )}
          {isScholar && isOnParentPage && (
            <Menu.Item
              value="student-view"
              cursor="pointer"
              onClick={() => { window.location.href = "/scholar"; }}
            >
              <FiEye />
              Student View
            </Menu.Item>
          )}
          {isAdmin && (
            <Menu.Item
              value="admin"
              cursor="pointer"
              onClick={() => { window.location.href = "/admin"; }}
            >
              <FiSettings />
              Admin Tools
            </Menu.Item>
          )}
          <Menu.Item
            value="account"
            cursor="pointer"
            onClick={() => {
              if (onOpenProfile) onOpenProfile();
              else window.location.href = "/scholar/account";
            }}
          >
            <FiUser />
            Account Details
          </Menu.Item>
          {isTeacher && (
            <Menu.Item
              value="mcp-token"
              cursor="pointer"
              onClick={() => setShowMcpDialog(true)}
            >
              <FiCpu />
              My MCP Token
            </Menu.Item>
          )}
          <Menu.Item
            value="sign-out"
            cursor="pointer"
            onClick={onSignOut}
          >
            <FiLogOut />
            Sign Out
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
      {isTeacher && (
        <ParentAccessDialog
          scholarName={userName}
          open={showMcpDialog}
          onClose={() => setShowMcpDialog(false)}
          mode="self"
        />
      )}
    </Menu.Root>
  );
}
