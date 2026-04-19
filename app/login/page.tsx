import { redirect } from "next/navigation";

export default function LoginRedirect() {
  redirect("/sign-in");
}
