import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getSessionContext } from "@/lib/server/session";
import { isLiveMode } from "@/lib/config";

export const metadata = { title: "Configura tu empresa" };

export default async function Page() {
  if (!isLiveMode()) redirect("/login");

  const context = await getSessionContext();
  if (!context.user) redirect("/login");

  return (
    <OnboardingForm
      defaultName={context.profile?.fullName ?? ""}
      hasOtherOrgs={context.memberships.length > 0}
    />
  );
}
