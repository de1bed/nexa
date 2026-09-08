"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Callout, Field, fieldClass } from "./ui";
import { roleLabels, type MemberRole } from "@/lib/domain";

export function JoinForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    organizationName: string;
    role: MemberRole;
    alreadyMember: boolean;
  } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;

    setBusy(true);
    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Código inválido");
        return;
      }

      setResult({
        organizationName: data.organizationName,
        role: data.role,
        alreadyMember: data.alreadyMember,
      });

      if (!data.alreadyMember) {
        toast.success(`¡Bienvenido a ${data.organizationName}!`);
      }
    } catch {
      toast.error("No fue posible validar el código");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="mt-6 space-y-4">
        <Callout tone={result.alreadyMember ? "neutral" : "success"}>
          {result.alreadyMember ? (
            <>Ya eres parte de <b>{result.organizationName}</b>.</>
          ) : (
            <>
              Te uniste a <b>{result.organizationName}</b> como{" "}
              <b>{roleLabels[result.role]}</b>.
            </>
          )}
        </Callout>
        <Button
          variant="accent"
          size="lg"
          block
          onClick={() => router.push("/select-organization")}
        >
          Continuar
          <ArrowRight size={18} />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Field label="Código de invitación">
        <div className="relative">
          <KeyRound
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            className={fieldClass + " pl-11 font-mono uppercase tracking-widest"}
            placeholder="ABCD1234"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="off"
            maxLength={12}
          />
        </div>
      </Field>

      <Button
        type="submit"
        variant="accent"
        size="lg"
        block
        disabled={busy || !code.trim()}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <KeyRound size={18} />
        )}
        Usar código
      </Button>

      <p className="text-center text-xs text-slate-400">
        El código te lo proporciona el administrador de la organización
      </p>
    </form>
  );
}
