import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata = { title: "Unirse a una organización" };

export default function JoinPage() {
  return (
    <main className="safe-top grid min-h-screen place-items-center bg-[#f4f7fb] px-5 py-10">
      <div className="w-full max-w-md rounded-[26px] border border-slate-200 bg-white p-6 text-center sm:p-8">
        <Brand />
        <h1 className="mt-8 text-2xl font-semibold tracking-[-.03em]">
          Este código ya no abre acceso
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-slate-500">
          Para entrar a una empresa necesitas el correo de invitación.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-blue-600">
          Ir a entrar
        </Link>
      </div>
    </main>
  );
}
