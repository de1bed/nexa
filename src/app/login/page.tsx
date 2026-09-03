import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Iniciar sesión" };

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginForm />
    </Suspense>
  );
}
