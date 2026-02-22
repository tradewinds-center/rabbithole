"use client";

import { Suspense } from "react";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Box, Flex, Spinner } from "@chakra-ui/react";
import { AppLogo } from "@/components/AppLogo";
import { AccountMenu } from "@/components/AccountMenu";
import { ScholarProfile, type ScholarTabKey } from "@/components/ScholarProfile";

const VALID_TABS: ScholarTabKey[] = [
  "activity", "mastery", "seeds", "standards", "strengths",
  "documents", "notes", "dossier", "reading",
];

export default function ParentPage() {
  return (
    <Suspense
      fallback={
        <Flex minH="100vh" bg="gray.50" align="center" justify="center">
          <Spinner size="xl" color="violet.500" />
        </Flex>
      }
    >
      <ParentView />
    </Suspense>
  );
}

function ParentView() {
  const { user, isLoading } = useCurrentUser();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const params = useParams();

  const tabSegment = (params.tab as string[] | undefined)?.[0];
  const activeTab: ScholarTabKey =
    tabSegment && VALID_TABS.includes(tabSegment as ScholarTabKey)
      ? (tabSegment as ScholarTabKey)
      : "activity";

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/sign-in");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <Spinner size="xl" color="violet.500" />
      </Flex>
    );
  }

  return (
    <Flex minH="100vh" bg="gray.50" flexDir="column">
      {/* Top bar */}
      <Flex
        px={{ base: 4, md: 6 }}
        py={3}
        borderBottom="1px solid"
        borderColor="gray.200"
        bg="white"
        align="center"
        justify="space-between"
        flexShrink={0}
      >
        <AppLogo variant="dark" />
        <AccountMenu
          onSignOut={() => signOut()}
        />
      </Flex>

      {/* Scholar profile in parent mode */}
      <Box flex={1} overflow="auto">
        <ScholarProfile
          scholarId={user._id}
          mode="parent"
          activeTab={activeTab}
          onTabChange={(tab) => router.replace(`/parent/${tab}`)}
        />
      </Box>
    </Flex>
  );
}
