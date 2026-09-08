"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, MapPin, PenLine } from "lucide-react";
import { Field, cn, fieldClass } from "./ui";

type Suggestion = { id: string; label: string };
type SearchState = "idle" | "loading" | "done" | "error";

/**
 * Autocompletado de direcciones con OpenStreetMap (Photon). El visitante
 * elige una dirección real de la lista; no hace falta una llave de Google.
 * Si no hay resultados, puede usar la dirección escrita manualmente.
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
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [items, setItems] = useState<Suggestion[]>([]);
  const picked = useRef(false);

  useEffect(() => {
    if (picked.current) {
      picked.current = false;
      return;
    }
    const text = value.trim();
    if (text.length < 4) {
      return;
    }

    const timer = setTimeout(() => {
      setSearchState("loading");
      void (async () => {
        try {
          const response = await fetch(
            `/api/places?q=${encodeURIComponent(text)}`,
          );
          if (!response.ok) throw new Error("fetch");
          const payload = (await response.json()) as { places?: Suggestion[] };
          setItems(payload.places ?? []);
          setSearchState("done");
          setOpen(true);
        } catch {
          setItems([]);
          setSearchState("error");
          setOpen(true);
        }
      })();
    }, 350);

    return () => clearTimeout(timer);
  }, [value]);

  function choose(place: Suggestion) {
    picked.current = true;
    onChange(place.label);
    setOpen(false);
    setItems([]);
    setSearchState("idle");
  }

  function useManual() {
    picked.current = true;
    setOpen(false);
    setItems([]);
    setSearchState("idle");
  }

  const showDropdown = open && value.trim().length >= 4;
  const hasResults = items.length > 0;
  const noResults = searchState === "done" && !hasResults;
  const hasError = searchState === "error";

  return (
    <Field
      label={label}
      hint="Escribe la dirección. Puedes elegir de la lista o escribirla completa."
    >
      <div className="relative">
        <input
          className={fieldClass}
          placeholder="Calle, número, colonia, ciudad"
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => {
            if (value.trim().length >= 4 && (hasResults || noResults || hasError)) {
              setOpen(true);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 200);
          }}
        />
        {searchState === "loading" && (
          <Loader2
            size={16}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
          />
        )}
        {showDropdown && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-[0_18px_40px_-24px_rgba(7,20,38,.45)]"
          >
            {hasResults &&
              items.map((place) => (
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
            {(noResults || hasError) && (
              <>
                <li className="px-3.5 py-3 text-center text-sm text-slate-500">
                  {hasError
                    ? "No pudimos buscar direcciones. Escríbela manualmente."
                    : "No encontramos esa dirección en el mapa."}
                </li>
                <li>
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-3.5 py-3 text-sm font-medium text-[#0d9d99] hover:bg-slate-50"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={useManual}
                  >
                    <PenLine size={15} />
                    Usar &ldquo;{value.trim().slice(0, 30)}{value.trim().length > 30 ? "…" : ""}&rdquo;
                  </button>
                </li>
              </>
            )}
            {hasResults && (
              <li>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-3.5 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={useManual}
                >
                  <Check size={14} />
                  Usar lo que escribí
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </Field>
  );
}
