"use client";

import { Box, HStack, Text, Button, Menu } from "@chakra-ui/react";
import { FiLogOut, FiSettings, FiUser, FiEye } from "react-icons/fi";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar } from "./Avatar";
import { StatusOrb, PulseScoreDetail } from "./StatusOrb";

interface AccountMenuProps {
  /** Override display name (falls back to current user) */
  userName?: string;
  userUsername?: string;
  userImage?: string;
  onSignOut: () => void;
  onOpenProfile?: () => void;
  /** Optional StatusOrb data — only displayed for scholar role */
  pulseScore?: number | null;
  lastMessageAt?: number | null;
  /** @deprecated — derived from current user now */
  isAdmin?: boolean;
  /** Current view context — enables view toggle */
  currentView?: "scholar" | "parent";
}

export function AccountMenu({
  userName: userNameProp,
  userUsername: userUsernameProp,
  userImage: userImageProp,
  onSignOut,
  onOpenProfile,
  pulseScore,
  lastMessageAt,
  isAdmin: isAdminProp,
  currentView,
}: AccountMenuProps) {
  const { user } = useCurrentUser();
  const role = user?.role;
  const isScholar = role === "scholar";
  const isAdmin = isAdminProp ?? role === "admin";
  const userName = userNameProp ?? user?.name ?? "User";
  const userUsername = userUsernameProp ?? user?.username;
  const userImage = userImageProp ?? user?.image;

  // Only show pulse orb for scholars
  const showOrb = isScholar && pulseScore !== undefined;

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
              <Menu.ItemGroup>
                <Menu.ItemGroupLabel>Pulse Score</Menu.ItemGroupLabel>
                <Box px={3} pb={2}>
                  <PulseScoreDetail pulseScore={pulseScore ?? null} lastMessageAt={lastMessageAt ?? null} />
                </Box>
              </Menu.ItemGroup>
            </>
          )}
          <Menu.Separator />
          {/* View toggle */}
          {currentView === "scholar" && (
            <Menu.Item
              value="parent-view"
              cursor="pointer"
              onClick={() => { window.location.href = "/parent"; }}
            >
              <FiEye />
              Parent View
            </Menu.Item>
          )}
          {currentView === "parent" && (
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
    </Menu.Root>
  );
}
