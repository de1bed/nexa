"use client";

import { useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button, Field, fieldClass } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema } from "@/lib/schemas";

/**
 * Tras verificar el correo con el código, la persona elige una contraseña.
 * Los siguientes ingresos ya no piden código.
 */
export function ChoosePasswordStep({
  title = "Elige tu contraseña",
  description = "La usarás de ahora en adelante. El código del correo solo sirvió para confirmar que eres tú.",
  onSaved,
}: {
  title?: string;
  description?: string;
  onSaved: () => void | Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Contraseña inválida");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { error: authError } = await createClient().auth.updateUser({
        password: parsed.data,
      });
      if (authError) throw authError;
      await onSaved();
    } catch {
      setError("No pudimos guardar la contraseña. Intenta de nuevo.");
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="grid size-16 place-items-center rounded-2xl bg-[#10cfc9]/15 text-[#0d9d99]">
        <LockKeyhole size={28} />
      </span>
      <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-[-.03em]">
        {title}
      </h1>
      <p className="mt-2.5 text-[15px] leading-6 text-slate-500">{description}</p>

      <form onSubmit={save} className="mt-7 space-y-4">
        <Field label="Contraseña" hint="Mínimo 8 caracteres.">
          <input
            required
            autoFocus
            type="password"
            autoComplete="new-password"
            className={fieldClass}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field label="Confírmala">
          <input
            required
            type="password"
            autoComplete="new-password"
            className={fieldClass}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 p-3.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? <Loader2 size={19} className="animate-spin" /> : "Guardar y entrar"}
        </Button>
      </form>
    </div>
  );
}
