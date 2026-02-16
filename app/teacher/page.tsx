import { Suspense } from "react";
import TeacherDashboard from "./TeacherDashboard";

export default function TeacherPage() {
  return (
    <Suspense>
      <TeacherDashboard />
    </Suspense>
  );
}
