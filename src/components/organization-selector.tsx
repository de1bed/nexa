"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, LoaderCircle } from "lucide-react";
import { Brand } from "./brand";

type Membership = {
  organizationId: string;
  organizationName: string;
  role: string;
};
export function OrganizationSelector() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    fetch("/api/session")
      .then((response) => response.json())
      .then((data: { memberships?: Membership[] }) =>
        setMemberships(data.memberships ?? []),
      )
      .finally(() => setLoading(false));
  }, []);
  async function select(organizationId: string) {
    setBusy(organizationId);
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    if (response.ok) router.replace("/app/dashboard");
    else setBusy("");
  }
  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8">
      <div className="mx-auto max-w-xl">
        <Brand />
        <div className="mt-16 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-semibold">
            Selecciona una organización
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Tu sesión tiene acceso a más de un espacio.
          </p>
          {loading ? (
            <LoaderCircle className="mx-auto mt-10 animate-spin text-[#10aaa5]" />
          ) : (
            <div className="mt-7 space-y-3">
              {memberships.map((membership) => (
                <button
                  key={membership.organizationId}
                  onClick={() => select(membership.organizationId)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left hover:border-[#10aaa5] hover:bg-cyan-50/30"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-[#071426] text-white">
                    <Building2 size={19} />
                  </span>
                  <span className="flex-1">
                    <b className="block">{membership.organizationName}</b>
                    <small className="text-slate-500">{membership.role}</small>
                  </span>
                  {busy === membership.organizationId ? (
                    <LoaderCircle className="animate-spin" size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
