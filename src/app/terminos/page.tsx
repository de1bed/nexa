import { Metadata } from "next";
import { LegalLayout } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos y condiciones de uso de NEXA VISIT",
};

export default function TerminosPage() {
  return (
    <LegalLayout
      title="Términos y condiciones de uso"
      lastUpdated="[FECHA POR DEFINIR]"
    >
      {/* 
        ⚠️ BORRADOR PARA REVISIÓN LEGAL
        Este documento es un borrador que debe ser revisado por el área legal
        de Vortex Lab antes de su publicación. Los campos marcados entre corchetes
        [EJEMPLO] requieren información específica de la empresa.
      */}

      <section>
        <h2>1. Aceptación de los términos</h2>
        <p>
          Al acceder y utilizar la plataforma NEXA VISIT (en adelante, &quot;la
          Plataforma&quot; o &quot;el Servicio&quot;), operada por{" "}
          <strong>[NOMBRE LEGAL COMPLETO DE LA EMPRESA]</strong>, conocida
          comercialmente como <strong>Vortex Lab</strong> (en adelante, &quot;Vortex
          Lab&quot; o &quot;nosotros&quot;), usted acepta estar sujeto a estos Términos y
          Condiciones de Uso.
        </p>
        <p>
          Si no está de acuerdo con alguno de estos términos, le rogamos no
          utilice la Plataforma.
        </p>
      </section>

      <section>
        <h2>2. Descripción del servicio</h2>
        <p>
          NEXA VISIT es una plataforma de control inteligente de visitantes que
          permite a las empresas (Clientes) gestionar el acceso de visitantes a
          sus instalaciones. El Servicio incluye:
        </p>
        <ul>
          <li>Gestión de invitaciones y preregistro de visitantes</li>
          <li>Generación de pases de acceso digitales con código QR</li>
          <li>Captura y almacenamiento temporal de identificaciones</li>
          <li>Control de entrada y salida en tiempo real</li>
          <li>Notificaciones automáticas a anfitriones y visitantes</li>
          <li>Reportes y bitácora de accesos</li>
        </ul>
      </section>

      <section>
        <h2>3. Tipos de usuarios</h2>

        <h3>3.1. Empresas cliente</h3>
        <p>
          Organizaciones que contratan el Servicio para gestionar el acceso a
          sus instalaciones. Son responsables de configurar las políticas de
          acceso, retención de datos y uso de la plataforma dentro de su
          organización.
        </p>

        <h3>3.2. Personal autorizado</h3>
        <p>
          Administradores, anfitriones y guardias de seguridad que utilizan la
          Plataforma en nombre de una empresa cliente. Deben contar con
          credenciales de acceso proporcionadas por su organización.
        </p>

        <h3>3.3. Visitantes</h3>
        <p>
          Personas que reciben una invitación para visitar las instalaciones de
          una empresa cliente y utilizan la Plataforma para completar su
          preregistro y obtener un pase de acceso.
        </p>
      </section>

      <section>
        <h2>4. Registro y cuenta</h2>

        <h3>4.1. Para empresas cliente y personal autorizado</h3>
        <ul>
          <li>
            Debe proporcionar información veraz y actualizada durante el
            registro
          </li>
          <li>
            Es responsable de mantener la confidencialidad de sus credenciales
            de acceso
          </li>
          <li>
            Debe notificar inmediatamente cualquier uso no autorizado de su
            cuenta
          </li>
          <li>
            No puede compartir sus credenciales ni permitir que terceros accedan
            con su cuenta
          </li>
        </ul>

        <h3>4.2. Para visitantes</h3>
        <ul>
          <li>
            Debe proporcionar información veraz durante el preregistro
          </li>
          <li>
            El pase de acceso es personal e intransferible
          </li>
          <li>
            Debe seguir las instrucciones de la empresa que visita respecto a
            los documentos requeridos
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Uso aceptable</h2>
        <p>Al utilizar la Plataforma, usted se compromete a:</p>
        <ul>
          <li>Utilizar el Servicio únicamente para los fines previstos</li>
          <li>No intentar acceder sin autorización a sistemas o datos</li>
          <li>
            No utilizar la Plataforma para actividades ilegales o fraudulentas
          </li>
          <li>No suplantar la identidad de otra persona</li>
          <li>No interferir con el funcionamiento normal de la Plataforma</li>
          <li>
            No intentar eludir las medidas de seguridad o control de acceso
          </li>
          <li>
            No cargar contenido malicioso, ilegal u ofensivo
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Propiedad intelectual</h2>
        <p>
          La Plataforma, incluyendo su diseño, código, logotipos, marcas y
          contenido original, es propiedad de Vortex Lab o sus licenciantes y
          está protegida por las leyes de propiedad intelectual aplicables.
        </p>
        <p>
          Se le concede una licencia limitada, no exclusiva e intransferible
          para utilizar la Plataforma conforme a estos términos. Esta licencia
          no incluye el derecho a:
        </p>
        <ul>
          <li>Copiar, modificar o distribuir el software de la Plataforma</li>
          <li>
            Realizar ingeniería inversa o intentar extraer el código fuente
          </li>
          <li>
            Utilizar las marcas o logotipos de NEXA VISIT sin autorización
            expresa
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Privacidad y datos personales</h2>
        <p>
          El tratamiento de datos personales se rige por nuestro{" "}
          <a href="/privacidad">Aviso de Privacidad</a>, el cual forma parte
          integral de estos Términos y Condiciones.
        </p>
        <p>
          Las empresas cliente son corresponsables del tratamiento de los datos
          personales de sus visitantes y deben cumplir con la legislación
          aplicable en materia de protección de datos.
        </p>
      </section>

      <section>
        <h2>8. Disponibilidad del servicio</h2>
        <p>
          Nos esforzamos por mantener la Plataforma disponible de manera
          continua, pero no garantizamos disponibilidad ininterrumpida. El
          Servicio puede verse interrumpido por:
        </p>
        <ul>
          <li>Mantenimiento programado o de emergencia</li>
          <li>Fallas en servicios de terceros (internet, servidores, etc.)</li>
          <li>Eventos de fuerza mayor</li>
          <li>Actualizaciones o mejoras de la Plataforma</li>
        </ul>
        <p>
          No seremos responsables por daños derivados de la interrupción o falta
          de disponibilidad del Servicio.
        </p>
      </section>

      <section>
        <h2>9. Limitación de responsabilidad</h2>
        <p>
          En la medida permitida por la ley aplicable:
        </p>
        <ul>
          <li>
            La Plataforma se proporciona &quot;tal como está&quot; y &quot;según
            disponibilidad&quot;
          </li>
          <li>
            No garantizamos que el Servicio satisfaga todos sus requerimientos
            específicos
          </li>
          <li>
            No somos responsables por decisiones de control de acceso tomadas
            por las empresas cliente
          </li>
          <li>
            Nuestra responsabilidad máxima está limitada al monto pagado por el
            Servicio en los últimos 12 meses
          </li>
          <li>
            No seremos responsables por daños indirectos, incidentales,
            especiales o consecuentes
          </li>
        </ul>
      </section>

      <section>
        <h2>10. Indemnización</h2>
        <p>
          Usted acepta indemnizar y mantener indemne a Vortex Lab, sus
          directivos, empleados y agentes, de cualquier reclamación, daño,
          pérdida o gasto (incluyendo honorarios legales) derivados de:
        </p>
        <ul>
          <li>Su uso de la Plataforma en violación de estos términos</li>
          <li>La violación de derechos de terceros</li>
          <li>El incumplimiento de la legislación aplicable</li>
        </ul>
      </section>

      <section>
        <h2>11. Modificaciones al servicio y términos</h2>
        <p>
          Nos reservamos el derecho de modificar, suspender o discontinuar
          cualquier aspecto del Servicio en cualquier momento. También podemos
          actualizar estos Términos y Condiciones.
        </p>
        <p>
          Los cambios sustanciales serán comunicados con al menos 30 días de
          anticipación. El uso continuado del Servicio después de la
          notificación constituye aceptación de los nuevos términos.
        </p>
      </section>

      <section>
        <h2>12. Terminación</h2>

        <h3>12.1. Por parte del usuario</h3>
        <p>
          Las empresas cliente pueden cancelar su suscripción conforme a los
          términos de su contrato de servicio. Los usuarios individuales pueden
          solicitar la eliminación de su cuenta contactándonos en{" "}
          <a href="mailto:soporte@vortexlabai.com">soporte@vortexlabai.com</a>.
        </p>

        <h3>12.2. Por parte de Vortex Lab</h3>
        <p>
          Podemos suspender o cancelar el acceso a la Plataforma sin previo
          aviso en caso de:
        </p>
        <ul>
          <li>Violación de estos Términos y Condiciones</li>
          <li>Uso fraudulento o ilegal de la Plataforma</li>
          <li>Falta de pago (para empresas cliente)</li>
          <li>Por requerimiento de autoridad competente</li>
        </ul>
      </section>

      <section>
        <h2>13. Legislación aplicable y jurisdicción</h2>
        <p>
          Estos Términos y Condiciones se rigen por las leyes de los Estados
          Unidos Mexicanos. Para cualquier controversia derivada del uso de la
          Plataforma, las partes se someten a la jurisdicción de los tribunales
          competentes de <strong>[CIUDAD, ESTADO]</strong>, renunciando a
          cualquier otro fuero que pudiera corresponderles.
        </p>
      </section>

      <section>
        <h2>14. Disposiciones generales</h2>
        <ul>
          <li>
            <strong>Divisibilidad</strong>: Si alguna disposición de estos
            términos se considera inválida, las demás permanecerán en vigor.
          </li>
          <li>
            <strong>Renuncia</strong>: El no ejercicio de un derecho no
            constituye renuncia al mismo.
          </li>
          <li>
            <strong>Acuerdo completo</strong>: Estos términos, junto con el
            Aviso de Privacidad y la Política de Cookies, constituyen el acuerdo
            completo entre las partes respecto al uso de la Plataforma.
          </li>
        </ul>
      </section>

      <section>
        <h2>15. Contacto</h2>
        <p>
          Para cualquier pregunta o comentario sobre estos Términos y
          Condiciones, puede contactarnos en:
        </p>
        <ul>
          <li>
            <strong>Correo electrónico</strong>:{" "}
            <a href="mailto:soporte@vortexlabai.com">soporte@vortexlabai.com</a>
          </li>
          <li>
            <strong>Domicilio</strong>: [DIRECCIÓN FISCAL COMPLETA]
          </li>
        </ul>
      </section>
    </LegalLayout>
  );
}
