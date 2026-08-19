import { isDemoMode } from "@/lib/utils";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return <LoginForm demo={isDemoMode()} />;
}
