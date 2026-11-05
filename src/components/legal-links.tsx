import Link from "next/link";
import { cn } from "./ui";

export function LegalLinks({
  className,
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <nav
      className={cn(
        "flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs",
        dark ? "text-slate-400" : "text-slate-500",
        className,
      )}
    >
      <Link
        href="/privacidad"
        className={cn(
          "hover:underline",
          dark ? "hover:text-slate-300" : "hover:text-slate-700",
        )}
      >
        Privacidad
      </Link>
      <Link
        href="/terminos"
        className={cn(
          "hover:underline",
          dark ? "hover:text-slate-300" : "hover:text-slate-700",
        )}
      >
        Términos
      </Link>
      <Link
        href="/cookies"
        className={cn(
          "hover:underline",
          dark ? "hover:text-slate-300" : "hover:text-slate-700",
        )}
      >
        Cookies
      </Link>
    </nav>
  );
}
