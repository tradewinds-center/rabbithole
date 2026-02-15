"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Flex, Spinner } from "@chakra-ui/react";

/**
 * /scholar — Landing page. Redirects to the first project or shows "new".
 * If ?remote=userId is set, stays in remote mode.
 * All actual UI lives in /scholar/[projectId]/page.tsx.
 */
export default function ScholarPage() {
  return (
    <Suspense fallback={<Flex minH="100vh" bg="gray.50" align="center" justify="center"><Spinner size="xl" color="violet.500" /></Flex>}>
      <ScholarRedirect />
    </Suspense>
  );
}

function ScholarRedirect() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const remoteUserId = searchParams.get("remote");
  const isRemoteMode = !!(remoteUserId && user && (user.role === "teacher" || user.role === "admin"));

  const projects = useQuery(
    api.projects.list,
    isRemoteMode ? { userId: remoteUserId as Id<"users"> } : {}
  );

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if ((user.role === "teacher" || user.role === "admin") && !remoteUserId) {
      router.replace("/teacher");
      return;
    }
  }, [user, isUserLoading, router, remoteUserId]);

  // Once projects load, redirect to the first one (or "new")
  useEffect(() => {
    if (projects === undefined) return; // still loading
    const remoteParam = remoteUserId ? `?remote=${remoteUserId}` : "";
    if (projects.length > 0) {
      router.replace(`/scholar/${projects[0]._id}${remoteParam}`);
    } else {
      router.replace(`/scholar/new${remoteParam}`);
    }
  }, [projects, router, remoteUserId]);

  return (
    <Flex minH="100vh" bg="gray.50" align="center" justify="center">
      <Spinner size="xl" color="violet.500" />
    </Flex>
  );
}
