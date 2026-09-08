"use client";

import { useState } from "react";
import { Check, Loader2, LockKeyhole, X } from "lucide-react";
import { Button, Field, cn, fieldClass } from "./ui";
import { createClient } from "@/lib/supabase/client";

const MIN_LENGTH = 8;

function checkPassword(value: string) {
  return {
    length: value.length >= MIN_LENGTH,
    hasLetter: /[a-zA-Z]/.test(value),
    hasNumber: /\d/.test(value),
  };
}

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

  const checks = checkPassword(password);
  const isValid = checks.length && checks.hasLetter && checks.hasNumber;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    
    if (!isValid) {
      setError("La contraseña no cumple con los requisitos");
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
        password,
      });
      if (authError) {
        if (authError.message.includes("weak") || authError.message.includes("password")) {
          setError("La contraseña es muy débil. Usa una combinación de letras y números.");
        } else {
          throw authError;
        }
        setBusy(false);
        return;
      }
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
        <Field label="Contraseña">
          <input
            required
            autoFocus
            type="password"
            autoComplete="new-password"
            className={fieldClass}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
          />
        </Field>

        {/* Requisitos de la contraseña */}
        {password.length > 0 && (
          <div className="rounded-2xl bg-slate-50 p-3 space-y-1.5">
            <p className="text-xs font-medium text-slate-500 mb-2">Requisitos:</p>
            <PasswordCheck passed={checks.length} label={`Mínimo ${MIN_LENGTH} caracteres`} />
            <PasswordCheck passed={checks.hasLetter} label="Al menos una letra" />
            <PasswordCheck passed={checks.hasNumber} label="Al menos un número" />
          </div>
        )}

        <Field label="Confirma tu contraseña">
          <input
            required
            type="password"
            autoComplete="new-password"
            className={fieldClass}
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
              setError("");
            }}
          />
        </Field>

        {confirm.length > 0 && password !== confirm && (
          <p className="flex items-center gap-2 text-sm text-amber-600">
            <X size={14} />
            Las contraseñas no coinciden
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 p-3.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" block disabled={busy || !isValid}>
          {busy ? <Loader2 size={19} className="animate-spin" /> : "Guardar y entrar"}
        </Button>
      </form>
    </div>
  );
}

function PasswordCheck({ passed, label }: { passed: boolean; label: string }) {
  return (
    <p className={cn("flex items-center gap-2 text-xs", passed ? "text-emerald-600" : "text-slate-400")}>
      {passed ? <Check size={14} /> : <X size={14} />}
      {label}
    </p>
  );
}
