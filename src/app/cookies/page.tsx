import { Metadata } from "next";
import { LegalLayout } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Política de cookies de NEXA VISIT",
};

export default function CookiesPage() {
  return (
    <LegalLayout title="Política de cookies" lastUpdated="[FECHA POR DEFINIR]">
      {/* 
        ⚠️ BORRADOR PARA REVISIÓN LEGAL
        Este documento es un borrador que debe ser revisado por el área legal
        de Vortex Lab antes de su publicación.
      */}

      <section>
        <h2>1. ¿Qué son las cookies?</h2>
        <p>
          Las cookies son pequeños archivos de texto que los sitios web
          almacenan en su navegador cuando los visita. Permiten que el sitio
          recuerde información sobre su visita, como sus preferencias de idioma
          y otros ajustes, lo que puede facilitar su próxima visita y hacer que
          el sitio le resulte más útil.
        </p>
        <p>
          Además de las cookies, NEXA VISIT también utiliza tecnologías
          similares como el almacenamiento local del navegador (localStorage y
          sessionStorage) para los mismos propósitos.
        </p>
      </section>

      <section>
        <h2>2. Cookies que utilizamos</h2>
        <p>
          NEXA VISIT utiliza principalmente cookies esenciales para el
          funcionamiento del servicio, más una cookie de preferencias para
          recordar su idioma.
        </p>

        <h3>2.1. Cookies estrictamente necesarias</h3>
        <p>
          Estas cookies son imprescindibles para el funcionamiento de la
          Plataforma y no pueden desactivarse. Se establecen únicamente en
          respuesta a acciones realizadas por usted, como establecer sus
          preferencias de privacidad, iniciar sesión o completar formularios.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 py-2 text-left font-semibold">
                Cookie
              </th>
              <th className="border-b border-slate-200 py-2 text-left font-semibold">
                Propósito
              </th>
              <th className="border-b border-slate-200 py-2 text-left font-semibold">
                Duración
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b border-slate-100 py-2">
                <code>sb-*</code>
              </td>
              <td className="border-b border-slate-100 py-2">
                Cookies de autenticación de Supabase. Mantienen su sesión activa
                después de iniciar sesión.
              </td>
              <td className="border-b border-slate-100 py-2">Sesión / 1 año</td>
            </tr>
            <tr>
              <td className="border-b border-slate-100 py-2">
                <code>nexa-org</code>
              </td>
              <td className="border-b border-slate-100 py-2">
                Recuerda la organización seleccionada si el usuario pertenece a
                múltiples empresas.
              </td>
              <td className="border-b border-slate-100 py-2">30 días</td>
            </tr>
            <tr>
              <td className="border-b border-slate-100 py-2">
                <code>nexa-station</code>
              </td>
              <td className="border-b border-slate-100 py-2">
                Identifica el dispositivo de caseta para guardias de seguridad.
              </td>
              <td className="border-b border-slate-100 py-2">30 días</td>
            </tr>
            <tr>
              <td className="border-b border-slate-100 py-2">
                <code>nexa-station-booth</code>
              </td>
              <td className="border-b border-slate-100 py-2">
                Identifica la caseta específica asignada al dispositivo.
              </td>
              <td className="border-b border-slate-100 py-2">30 días</td>
            </tr>
          </tbody>
        </table>

        <h3>2.2. Cookies de preferencias</h3>
        <p>
          Estas cookies permiten que el sitio recuerde información que cambia la
          forma en que se comporta o se ve, como su idioma preferido.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 py-2 text-left font-semibold">
                Cookie
              </th>
              <th className="border-b border-slate-200 py-2 text-left font-semibold">
                Propósito
              </th>
              <th className="border-b border-slate-200 py-2 text-left font-semibold">
                Duración
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b border-slate-100 py-2">
                <code>nexa-locale</code>
              </td>
              <td className="border-b border-slate-100 py-2">
                Recuerda su preferencia de idioma (español o inglés).
              </td>
              <td className="border-b border-slate-100 py-2">1 año</td>
            </tr>
          </tbody>
        </table>

        <h3>2.3. Cookies de demostración (solo modo demo)</h3>
        <p>
          Estas cookies solo se establecen cuando utiliza la versión de
          demostración de la Plataforma, sin una cuenta real. No se usan en el
          modo de producción.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 py-2 text-left font-semibold">
                Cookie
              </th>
              <th className="border-b border-slate-200 py-2 text-left font-semibold">
                Propósito
              </th>
              <th className="border-b border-slate-200 py-2 text-left font-semibold">
                Duración
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b border-slate-100 py-2">
                <code>nexa-demo</code>
              </td>
              <td className="border-b border-slate-100 py-2">
                Indica que está usando el modo de demostración.
              </td>
              <td className="border-b border-slate-100 py-2">24 horas</td>
            </tr>
            <tr>
              <td className="border-b border-slate-100 py-2">
                <code>nexa-role</code>
              </td>
              <td className="border-b border-slate-100 py-2">
                Rol seleccionado en modo demostración.
              </td>
              <td className="border-b border-slate-100 py-2">24 horas</td>
            </tr>
            <tr>
              <td className="border-b border-slate-100 py-2">
                <code>nexa-demo-actor</code>
              </td>
              <td className="border-b border-slate-100 py-2">
                Perfil de demostración activo.
              </td>
              <td className="border-b border-slate-100 py-2">24 horas</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>3. Almacenamiento local del navegador</h2>
        <p>
          Además de las cookies, utilizamos el almacenamiento local
          (localStorage) para ciertos datos que mejoran su experiencia:
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 py-2 text-left font-semibold">
                Clave
              </th>
              <th className="border-b border-slate-200 py-2 text-left font-semibold">
                Propósito
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b border-slate-100 py-2">
                <code>nexa-locale</code>
              </td>
              <td className="border-b border-slate-100 py-2">
                Respaldo de la preferencia de idioma.
              </td>
            </tr>
            <tr>
              <td className="border-b border-slate-100 py-2">
                <code>nexa-updates-*</code>
              </td>
              <td className="border-b border-slate-100 py-2">
                Registra qué avisos de actualizaciones ya ha visto.
              </td>
            </tr>
            <tr>
              <td className="border-b border-slate-100 py-2">
                <code>nexa-visit-showcase-*</code>
              </td>
              <td className="border-b border-slate-100 py-2">
                Estado del modo demostración (solo demo).
              </td>
            </tr>
            <tr>
              <td className="border-b border-slate-100 py-2">
                <code>nexa-booth-*</code>
              </td>
              <td className="border-b border-slate-100 py-2">
                Preferencia de sede para personal con acceso a múltiples
                ubicaciones.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>4. Cookies de terceros</h2>
        <p>
          NEXA VISIT no utiliza cookies de terceros para publicidad o rastreo.
          Las únicas cookies de terceros son las de Supabase (nuestro proveedor
          de autenticación e infraestructura), que son estrictamente necesarias
          para el funcionamiento del servicio.
        </p>
      </section>

      <section>
        <h2>5. Cómo gestionar las cookies</h2>
        <p>
          Puede configurar su navegador para rechazar todas las cookies o para
          recibir un aviso cuando se envía una cookie. Sin embargo, tenga en
          cuenta que si rechaza las cookies esenciales, es posible que algunas
          partes de la Plataforma no funcionen correctamente.
        </p>
        <p>
          A continuación, le indicamos cómo gestionar las cookies en los
          navegadores más comunes:
        </p>
        <ul>
          <li>
            <strong>Chrome</strong>: Configuración → Privacidad y seguridad →
            Cookies y otros datos de sitios
          </li>
          <li>
            <strong>Firefox</strong>: Opciones → Privacidad y seguridad →
            Cookies y datos del sitio
          </li>
          <li>
            <strong>Safari</strong>: Preferencias → Privacidad → Cookies y datos
            del sitio web
          </li>
          <li>
            <strong>Edge</strong>: Configuración → Cookies y permisos del sitio
            → Cookies y datos del sitio
          </li>
        </ul>

        <p>
          Para eliminar los datos de almacenamiento local, puede usar las
          herramientas de desarrollador de su navegador (generalmente accesibles
          con F12) en la pestaña &quot;Aplicación&quot; o &quot;Almacenamiento&quot;.
        </p>
      </section>

      <section>
        <h2>6. Resumen: ¿Necesita aceptar cookies para usar NEXA VISIT?</h2>
        <p>
          <strong>Sí, las cookies esenciales son necesarias</strong> para que la
          Plataforma funcione. Estas cookies no recopilan información personal
          para fines de marketing ni rastrean su actividad en otros sitios.
        </p>
        <p>
          La cookie de idioma (<code>nexa-locale</code>) es técnicamente
          opcional: si la bloquea, la Plataforma funcionará pero no recordará su
          preferencia de idioma entre visitas.
        </p>
        <p>
          <strong>No utilizamos cookies de publicidad ni de rastreo</strong>.
        </p>
      </section>

      <section>
        <h2>7. Cambios a esta política</h2>
        <p>
          Podemos actualizar esta Política de Cookies ocasionalmente para
          reflejar cambios en las cookies que utilizamos o por otras razones
          operativas, legales o regulatorias. Le recomendamos revisar esta
          página periódicamente para mantenerse informado.
        </p>
      </section>

      <section>
        <h2>8. Contacto</h2>
        <p>
          Si tiene preguntas sobre nuestro uso de cookies, puede contactarnos
          en:
        </p>
        <ul>
          <li>
            <strong>Correo electrónico</strong>:{" "}
            <a href="mailto:soporte@vortexlabai.com">soporte@vortexlabai.com</a>
          </li>
        </ul>
      </section>
    </LegalLayout>
  );
}
