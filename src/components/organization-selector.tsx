"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, ChevronRight, Loader2, Plus } from "lucide-react";
import { Brand } from "./brand";
import { Button, Card, EmptyState } from "./ui";
import { roleLabels, type MemberRole } from "@/lib/domain";
import { roleHome } from "@/lib/config";

type Membership = {
  organizationId: string;
  organizationName: string;
  role: MemberRole;
};

/** Una persona puede trabajar en varias empresas: aquí elige con cuál opera. */
export function OrganizationSelector() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { memberships: [] }))
      .then((data: { memberships?: Membership[] }) =>
        setMemberships(data.memberships ?? []),
      )
      .catch(() => setMemberships([]))
      .finally(() => setLoading(false));
  }, []);

  async function select(membership: Membership) {
    setBusy(membership.organizationId);
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: membership.organizationId }),
    });
    if (response.ok) {
      router.replace(roleHome[membership.role]);
      router.refresh();
    } else {
      setBusy("");
    }
  }

  return (
    <main className="safe-top min-h-screen bg-[#f4f7fb] px-5 py-10">
      <div className="mx-auto max-w-lg">
        <Brand href="#" />

        <div className="mt-10">
          <h1 className="text-[26px] font-semibold tracking-[-.03em]">
            Selecciona una organización
          </h1>
          <p className="mt-2 text-[15px] text-slate-500">
            Tu cuenta tiene acceso a más de un espacio de trabajo.
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto animate-spin text-[#10aaa5]" size={32} />
          </div>
        ) : memberships.length === 0 ? (
          <div className="mt-7">
            <EmptyState
              icon={Building2}
              title="Todavía no perteneces a ninguna empresa"
              description="Crea la tuya o pide a un administrador que te invite."
              action={
                <Link href="/onboarding">
                  <Button variant="accent">
                    <Plus size={18} />
                    Crear mi empresa
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-7 space-y-3">
            {memberships.map((membership) => (
              <Card
                key={membership.organizationId}
                className="p-0 transition active:scale-[.99]"
              >
                <button
                  onClick={() => select(membership)}
                  disabled={Boolean(busy)}
                  className="flex w-full items-center gap-4 p-4 text-left"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#071426] text-white">
                    <Building2 size={21} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {membership.organizationName}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-500">
                      {roleLabels[membership.role]}
                    </span>
                  </span>
                  {busy === membership.organizationId ? (
                    <Loader2 size={19} className="shrink-0 animate-spin" />
                  ) : (
                    <ChevronRight size={19} className="shrink-0 text-slate-300" />
                  )}
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
