"use client";

import { Box, HStack, Text, Button, Menu } from "@chakra-ui/react";
import { FiLogOut, FiChevronDown, FiSettings, FiUser } from "react-icons/fi";
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
  /** Mobile layout: orb overlays avatar, pulse details in menu */
  isMobile?: boolean;
}

export function AccountMenu({
  userName,
  userImage,
  onSignOut,
  onOpenProfile,
  pulseScore,
  lastMessageAt,
  isAdmin,
  isMobile,
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
            {/* Desktop: standalone orb (popover disabled — details in menu) */}
            {showOrb && !isMobile && (
              <StatusOrb
                pulseScore={pulseScore ?? null}
                lastMessageAt={lastMessageAt ?? null}
                size="sm"
                disablePopover
              />
            )}
            {/* Avatar with optional orb overlay on mobile */}
            <Box position="relative" flexShrink={0}>
              <Avatar size="xs" name={userName} src={userImage} />
              {showOrb && isMobile && (
                <Box
                  position="absolute"
                  bottom="-4px"
                  right="-6px"
                >
                  <StatusOrb
                    pulseScore={pulseScore ?? null}
                    lastMessageAt={lastMessageAt ?? null}
                    size="sm"
                    disablePopover
                  />
                </Box>
              )}
            </Box>
            {!isMobile && (
              <>
                <Text
                  fontFamily="heading"
                  fontSize="xs"
                  fontWeight="500"
                  color="charcoal.500"
                >
                  {userName}
                </Text>
                <FiChevronDown size={12} color="var(--chakra-colors-charcoal-400)" />
              </>
            )}
          </HStack>
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="160px">
          {/* Pulse score details */}
          {showOrb && (
            <Box px={3} py={2} borderBottom="1px solid" borderColor="gray.100">
              <PulseScoreDetail pulseScore={pulseScore ?? null} lastMessageAt={lastMessageAt ?? null} />
            </Box>
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
