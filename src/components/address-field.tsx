"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Field, cn, fieldClass } from "./ui";

type Suggestion = { id: string; label: string };

/**
 * Autocompletado de direcciones con OpenStreetMap (Photon). El visitante
 * elige una dirección real de la lista; no hace falta una llave de Google.
 */
export function AddressField({
  value,
  onChange,
  label = "Dirección",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const picked = useRef(false);

  useEffect(() => {
    if (picked.current) {
      picked.current = false;
      return;
    }
    const text = value.trim();
    if (text.length < 4) return;

    const timer = setTimeout(() => {
      void (async () => {
        setBusy(true);
        try {
          const response = await fetch(
            `/api/places?q=${encodeURIComponent(text)}`,
          );
          const payload = (await response.json()) as { places?: Suggestion[] };
          setItems(payload.places ?? []);
          setOpen(Boolean(payload.places?.length));
        } catch {
          setItems([]);
        } finally {
          setBusy(false);
        }
      })();
    }, 280);

    return () => clearTimeout(timer);
  }, [value]);

  const visible = value.trim().length >= 4 ? items : [];

  function choose(place: Suggestion) {
    picked.current = true;
    onChange(place.label);
    setOpen(false);
    setItems([]);
  }

  return (
    <Field
      label={label}
      hint="Empieza a escribir y elige la dirección de la lista."
    >
      <div className="relative">
        <input
          className={fieldClass}
          placeholder="Calle, número, colonia, ciudad"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
        />
        {busy && (
          <Loader2
            size={16}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
          />
        )}
        {open && visible.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1.5 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-[0_18px_40px_-24px_rgba(7,20,38,.45)]"
          >
            {visible.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={cn(
                    "flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-sm leading-5 text-[#071426] hover:bg-slate-50",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(place)}
                >
                  <MapPin size={15} className="mt-0.5 shrink-0 text-[#0d9d99]" />
                  {place.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}
