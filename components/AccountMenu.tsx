"use client";

import { Box, HStack, Text, Button, Menu } from "@chakra-ui/react";
import { FiLogOut, FiSettings, FiUser, FiEye } from "react-icons/fi";
import { Avatar } from "./Avatar";
import { StatusOrb, PulseScoreDetail } from "./StatusOrb";

interface AccountMenuProps {
  userName: string;
  userImage?: string;
  onSignOut: () => void;
  onOpenProfile?: () => void;
  /** Optional StatusOrb data (scholar view) */
  pulseScore?: number | null;
  lastMessageAt?: number | null;
  /** Show "Admin Tools" link when true */
  isAdmin?: boolean;
  /** Current view context — enables view toggle */
  currentView?: "scholar" | "parent";
}

export function AccountMenu({
  userName,
  userImage,
  onSignOut,
  onOpenProfile,
  pulseScore,
  lastMessageAt,
  isAdmin,
  currentView,
}: AccountMenuProps) {
  const showOrb = pulseScore !== undefined;

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
