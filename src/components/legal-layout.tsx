import Link from "next/link";
import { Brand } from "./brand";

export function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f4f7fb]">
      <header className="safe-top sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
          <Brand />
          <Link
            href="/login"
            className="text-sm font-semibold text-[#0d9d99] hover:underline"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
        <article className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <header className="mb-8 border-b border-slate-100 pb-6">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">
              {title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Última actualización: {lastUpdated}
            </p>
          </header>

          <div className="legal-content prose prose-slate max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-8 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-lg prose-p:leading-7 prose-li:leading-7 prose-a:text-[#0d9d99] prose-a:no-underline hover:prose-a:underline">
            {children}
          </div>
        </article>

        <nav className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
          <Link href="/privacidad" className="hover:text-[#0d9d99] hover:underline">
            Aviso de privacidad
          </Link>
          <Link href="/terminos" className="hover:text-[#0d9d99] hover:underline">
            Términos y condiciones
          </Link>
          <Link href="/cookies" className="hover:text-[#0d9d99] hover:underline">
            Política de cookies
          </Link>
        </nav>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Vortex Lab. Todos los derechos reservados.
        </p>
      </div>
    </main>
  );
}
