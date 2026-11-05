import { Metadata } from "next";
import { LegalLayout } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Aviso de privacidad de NEXA VISIT conforme a la LFPDPPP",
};

export default function PrivacidadPage() {
  return (
    <LegalLayout title="Aviso de privacidad" lastUpdated="[FECHA POR DEFINIR]">
      {/* 
        ⚠️ BORRADOR PARA REVISIÓN LEGAL
        Este documento es un borrador que debe ser revisado por el área legal
        de Vortex Lab antes de su publicación. Los campos marcados entre corchetes
        [EJEMPLO] requieren información específica de la empresa.
      */}

      <section>
        <h2>1. Identidad del responsable</h2>
        <p>
          <strong>[NOMBRE LEGAL COMPLETO DE LA EMPRESA]</strong>, conocida
          comercialmente como <strong>Vortex Lab</strong> (en adelante, &quot;el
          Responsable&quot; o &quot;Vortex Lab&quot;), con domicilio en{" "}
          <strong>[DIRECCIÓN FISCAL COMPLETA]</strong>, es responsable del
          tratamiento de sus datos personales conforme al presente Aviso de
          Privacidad.
        </p>
        <p>
          El Responsable opera la plataforma NEXA VISIT, un sistema de control
          inteligente de visitantes para empresas.
        </p>
      </section>

      <section>
        <h2>2. Datos personales que recabamos</h2>
        <p>
          Dependiendo de su relación con el servicio, podemos recabar los
          siguientes datos personales:
        </p>

        <h3>2.1. Visitantes</h3>
        <p>
          Cuando usted se registra como visitante a través de una invitación o
          al llegar a las instalaciones de una empresa cliente, recabamos:
        </p>
        <ul>
          <li>Nombre completo</li>
          <li>Correo electrónico</li>
          <li>Número telefónico</li>
          <li>Empresa u organización a la que pertenece</li>
          <li>Motivo de la visita</li>
          <li>Notas adicionales para recepción</li>
          <li>
            <strong>Datos de identificación oficial</strong> (cuando la empresa
            que visita lo requiere):
            <ul>
              <li>Tipo de identificación (INE, pasaporte, licencia, etc.)</li>
              <li>Número de folio o documento (almacenado de forma parcial/enmascarada)</li>
              <li>Fotografía del anverso y reverso del documento</li>
            </ul>
          </li>
          <li>
            <strong>Datos de vehículo</strong> (cuando aplica):
            <ul>
              <li>Número de placa</li>
              <li>Fotografías del vehículo o placas</li>
            </ul>
          </li>
          <li>
            <strong>Anexos adicionales</strong>: fotografías o textos que la
            empresa solicitante requiera (como constancias, certificados o
            comprobantes)
          </li>
        </ul>

        <h3>2.2. Anfitriones y personal administrativo</h3>
        <p>
          Cuando una empresa cliente registra a su personal en la plataforma,
          recabamos:
        </p>
        <ul>
          <li>Nombre completo</li>
          <li>Correo electrónico institucional</li>
          <li>Número telefónico (opcional)</li>
          <li>Fotografía de perfil (opcional)</li>
          <li>Área o departamento</li>
          <li>Rol dentro del sistema</li>
        </ul>

        <h3>2.3. Guardias de seguridad</h3>
        <p>Para el personal de vigilancia, recabamos:</p>
        <ul>
          <li>Nombre completo</li>
          <li>Correo electrónico o código de acceso</li>
          <li>Sede y caseta de trabajo asignada</li>
          <li>Registro de actividad (entradas y salidas procesadas)</li>
        </ul>
      </section>

      <section>
        <h2>3. Datos personales sensibles</h2>
        <p>
          Las fotografías de documentos de identificación pueden contener{" "}
          <strong>datos biométricos</strong> (fotografía del rostro) e
          información que la legislación considera sensible. Estos datos se
          recaban únicamente cuando la empresa que recibe su visita lo requiere,
          y solo con su consentimiento expreso otorgado al completar el
          preregistro.
        </p>
      </section>

      <section>
        <h2>4. Finalidades del tratamiento</h2>

        <h3>4.1. Finalidades primarias (necesarias para el servicio)</h3>
        <ul>
          <li>
            Gestionar el control de acceso a las instalaciones de las empresas
            clientes
          </li>
          <li>Verificar su identidad al momento de ingresar a las instalaciones</li>
          <li>Generar pases de acceso digitales con código QR</li>
          <li>
            Mantener un registro de visitantes conforme a las políticas de
            seguridad de cada empresa
          </li>
          <li>
            Notificarle sobre el estado de su visita (confirmaciones,
            recordatorios, cambios)
          </li>
          <li>
            Permitir a la empresa anfitriona cumplir con sus propias políticas
            de seguridad y normativas aplicables
          </li>
        </ul>

        <h3>4.2. Finalidades secundarias</h3>
        <ul>
          <li>Generar estadísticas de uso del servicio de forma agregada y anónima</li>
          <li>Mejorar la experiencia del usuario y la funcionalidad de la plataforma</li>
          <li>
            Contactarle para encuestas de satisfacción o comunicaciones
            relacionadas con el servicio
          </li>
        </ul>
        <p>
          Si no desea que sus datos se utilicen para las finalidades
          secundarias, puede manifestarlo enviando un correo a{" "}
          <a href="mailto:soporte@vortexlabai.com">soporte@vortexlabai.com</a>.
        </p>
      </section>

      <section>
        <h2>5. Transferencias de datos</h2>
        <p>
          Sus datos personales pueden ser transferidos y tratados dentro y fuera
          de México por las siguientes entidades:
        </p>
        <ul>
          <li>
            <strong>La empresa que usted visita</strong>: Como parte del
            servicio, la empresa cliente que gestiona su visita tiene acceso a
            sus datos de registro para cumplir con sus finalidades de control de
            acceso.
          </li>
          <li>
            <strong>Proveedores de infraestructura tecnológica</strong>:
            Utilizamos servicios de almacenamiento en la nube (Supabase, Vercel)
            que pueden procesar datos en servidores ubicados fuera de México.
            Estos proveedores cuentan con medidas de seguridad adecuadas.
          </li>
          <li>
            <strong>Proveedores de comunicación</strong>: Para el envío de
            correos electrónicos de notificación utilizamos servicios de terceros
            (Resend) que procesan la dirección de correo destinataria.
          </li>
        </ul>
        <p>
          Estas transferencias se realizan con fundamento en el artículo 37 de
          la LFPDPPP, ya que son necesarias para la prestación del servicio
          contratado o resultan de una relación jurídica entre el titular y el
          responsable.
        </p>
      </section>

      <section>
        <h2>6. Periodo de conservación</h2>
        <p>
          El tiempo de conservación de sus datos depende de la configuración
          establecida por cada empresa cliente:
        </p>
        <ul>
          <li>
            <strong>Fotografías de identificación</strong>: Se eliminan
            automáticamente según la política de retención de cada empresa,
            típicamente entre 30 y 365 días después de la visita. Algunas
            empresas pueden configurar retención indefinida según sus
            requerimientos normativos.
          </li>
          <li>
            <strong>Datos de registro</strong> (nombre, empresa, propósito de
            visita): Se conservan mientras la empresa cliente mantenga su cuenta
            activa, salvo que usted ejerza su derecho de cancelación.
          </li>
          <li>
            <strong>Registros de acceso</strong>: Se mantienen como bitácora de
            seguridad según los requerimientos legales y de la empresa cliente.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Derechos ARCO</h2>
        <p>
          Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al
          tratamiento de sus datos personales (derechos ARCO). Para ejercer
          estos derechos, envíe una solicitud a:
        </p>
        <ul>
          <li>
            <strong>Correo electrónico</strong>:{" "}
            <a href="mailto:soporte@vortexlabai.com">soporte@vortexlabai.com</a>
          </li>
          <li>
            <strong>Asunto</strong>: &quot;Solicitud de derechos ARCO&quot;
          </li>
        </ul>

        <p>Su solicitud debe incluir:</p>
        <ol>
          <li>Nombre completo del titular</li>
          <li>Correo electrónico o teléfono de contacto</li>
          <li>
            Descripción clara del derecho que desea ejercer y los datos sobre
            los que desea ejercerlo
          </li>
          <li>Copia de identificación oficial (para verificar su identidad)</li>
          <li>
            En caso de rectificación, los datos correctos y documentación de
            soporte
          </li>
        </ol>

        <p>
          Responderemos su solicitud en un plazo máximo de 20 días hábiles
          contados desde la fecha de recepción. Si la solicitud resulta
          procedente, se hará efectiva dentro de los 15 días hábiles siguientes.
        </p>

        <p>
          Si sus datos fueron recabados por una empresa cliente específica,
          también puede ejercer sus derechos directamente ante dicha empresa,
          quien es corresponsable del tratamiento para las finalidades propias
          de su visita.
        </p>
      </section>

      <section>
        <h2>8. Revocación del consentimiento</h2>
        <p>
          Puede revocar el consentimiento para el tratamiento de sus datos
          personales en cualquier momento, enviando una solicitud al correo{" "}
          <a href="mailto:soporte@vortexlabai.com">soporte@vortexlabai.com</a>.
          Tenga en cuenta que la revocación no aplica cuando el tratamiento sea
          necesario para cumplir obligaciones legales.
        </p>
      </section>

      <section>
        <h2>9. Uso de cookies y tecnologías de rastreo</h2>
        <p>
          NEXA VISIT utiliza cookies y almacenamiento local para el
          funcionamiento del servicio. Para más información, consulte nuestra{" "}
          <a href="/cookies">Política de Cookies</a>.
        </p>
      </section>

      <section>
        <h2>10. Medidas de seguridad</h2>
        <p>
          Implementamos medidas de seguridad técnicas, administrativas y físicas
          para proteger sus datos personales contra daño, pérdida, alteración,
          destrucción o uso, acceso o tratamiento no autorizado, incluyendo:
        </p>
        <ul>
          <li>Cifrado de datos en tránsito mediante TLS/HTTPS</li>
          <li>Cifrado de datos en reposo</li>
          <li>Control de acceso basado en roles</li>
          <li>
            Enmascaramiento de datos sensibles (números de documento parcialmente
            ocultos)
          </li>
          <li>Auditoría de acceso y actividad</li>
          <li>Eliminación automática de documentos según políticas de retención</li>
        </ul>
      </section>

      <section>
        <h2>11. Modificaciones al aviso de privacidad</h2>
        <p>
          Nos reservamos el derecho de efectuar modificaciones o actualizaciones
          al presente Aviso de Privacidad. Cualquier cambio será comunicado a
          través de esta página. Le recomendamos revisar periódicamente este
          documento.
        </p>
      </section>

      <section>
        <h2>12. Contacto</h2>
        <p>
          Para cualquier duda o comentario sobre este Aviso de Privacidad o el
          tratamiento de sus datos personales, puede contactarnos en:
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

      <section>
        <h2>13. Consentimiento</h2>
        <p>
          Al utilizar NEXA VISIT y proporcionar sus datos personales, usted
          acepta los términos de este Aviso de Privacidad. En el caso de datos
          sensibles (fotografías de identificación), solicitaremos su
          consentimiento expreso antes de recabarlos.
        </p>
      </section>
    </LegalLayout>
  );
}
