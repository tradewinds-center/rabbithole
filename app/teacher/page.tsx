import { Suspense } from "react";
import TeacherDashboard from "./TeacherDashboard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function TeacherPage() {
  return (
    <ErrorBoundary fallbackMessage="Something went wrong in the teacher dashboard">
      <Suspense>
        <TeacherDashboard />
      </Suspense>
    </ErrorBoundary>
  );
}
