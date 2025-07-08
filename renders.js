export function renderDatosHtml(tipo, datos) {
  switch (tipo) {
    case "Cambio de descanso":
      return `<p><strong>Día asignado:</strong> ${datos.assignedRestDay}</p>
              <p><strong>Día solicitado:</strong> ${datos.requestedRestDay}</p>`;
    case "Cambio de horario":
      return `<p><strong>Nuevo horario solicitado:</strong> ${datos.newSchedule}</p>`;
    case "Comisión Prolongada fuera de Oficina":
      return `<p><strong>Dias de home office:</strong> ${datos.homeOfficeDays}</p>
              <p><strong>Inicio:</strong> ${datos.startDate}</p>
              <p><strong>Fin:</strong> ${datos.endDate}</p>
              <p><strong>Reincorporación:</strong> ${datos.resumeDate}</p>`;
    case "Descanso laborado":
      return `<p><strong>Día asignado como descanso:</strong> ${datos.assignedRestDay}</p>
              <p><strong>Día laborado:</strong> ${datos.requestedRestDay}</p>`;
    case "Viaje de Trabajo":
      return `
        <p><strong>Ubicación del viaje:</strong> ${datos.tripLocation}</p>
        <p><strong>Fecha de inicio:</strong> ${datos.startDate}</p>
        <p><strong>Fecha de fin:</strong> ${datos.endDate}</p>
        <p><strong>Fecha de reincorporación:</strong> ${datos.resumeDate}</p>
      `;
    case "Permisos Especiales":
      let dias = 0;
      switch ((datos.specialType || "").toLowerCase()) {
        case "matrimonio":
          dias = 5;
          break;
        case "muerte":
          dias = 2;
          break;
        case "paternidad":
          dias = 5;
          break;
      }
      return `<p><strong>Tipo de permiso especial:</strong> ${datos.specialType}</p>
              <p><strong>Días de descanso asignados:</strong> ${dias}</p>`;

    case "Viaje de Trabajo":
      return `<p><strong>Ubicación:</strong> ${datos.tripLocation}</p>
              <p><strong>Inicio:</strong> ${datos.startDate}</p>
              <p><strong>Fin:</strong> ${datos.endDate}</p>
              <p><strong>Reincorporación:</strong> ${datos.resumeDate}</p>`;

    case "Permiso sin goce de sueldo":
      return `<p><strong>Día solicitado:</strong> ${datos.requestedRestDay}</p>`;

    case "Permiso para llegar tarde":
      return `<p><strong>Hora de entrada:</strong> ${datos.entryTime}</p>`;
    case "Retardo justificado":
      return `<p><strong>Hora de entrada:</strong> ${datos.delayTime}</p>`;
    case "Salida anticipada":
      return `<p><strong>Hora de salida anticipada:</strong> ${datos.earlyTime}</p>`;
    case "Horario de Lactancia":
      return `
          <p><strong>Nuevo horario solicitado:</strong> ${datos.newSchedule}</p>
          <p><strong>Inicio:</strong> ${datos.startDate}</p>
          <p><strong>Fin:</strong> ${datos.endDate}</p>
          <p><strong>Reincorporación:</strong> ${datos.resumeDate}</p>
        `;

    case "Curso/Capacitación":
      return `
          <p><strong>Días de curso:</strong> ${datos.homeOfficeDays}</p>
          <p><strong>Inicio:</strong> ${datos.startDate}</p>
          <p><strong>Fin:</strong> ${datos.endDate}</p>
          <p><strong>Reincorporación:</strong> ${datos.resumeDate}</p>
        `;

    case "Junta de trabajo":
      return `
          <p><strong>Día de reunión asignado:</strong> ${datos.assignedRestDay}</p>
          <p><strong>Día de reunión solicitado:</strong> ${datos.requestedRestDay}</p>
        `;
    case "Tiempo extra":
      return `<p><strong>Horas extra:</strong> ${datos.hours}</p>
              <p><strong>Entrada:</strong> ${datos.entryTime}</p>
              <p><strong>Salida:</strong> ${datos.exitTime}</p>`;

    case "Vacaciones":
      return `
        <p><strong>Fecha de inicio:</strong> ${datos.fecha_inicio}</p>
        <p><strong>Fecha de fin:</strong> ${datos.fecha_fin}</p>
        <p><strong>Días solicitados:</strong> ${datos.total_dias}</p>
        <p><strong>Vacaciones acumuladas restantes:</strong> ${datos.vacaciones_acumuladas_restantes}</p>
        <p><strong>Vacaciones de ley restantes:</strong> ${datos.vacaciones_ley_restantes}</p>
        <p><strong>Fecha de ingreso:</strong> ${datos.fecha_ingreso}</p>
        <p><strong>Próximo incremento:</strong> ${datos.proximo_incremento}</p>
        <p><strong>Apto para Vacaciones:</strong> ${datos.empleado_apto ? "Sí" : "No"}</p>
        ${datos.fechas?.length > 0 ? `
          <p><strong>Días seleccionados:</strong></p>
          <ul style="margin-left: 1em;">
            ${datos.fechas.map((f) => `<li>${f}</li>`).join("")}
          </ul>
        ` : ""}
      `;
    case "Sustitución":
      return `
              <div class="p-6 bg-white rounded-xl shadow space-y-4">
                    <p><strong>Número de empleado:</strong> ${datos.num_empleado}</p>
                    <p><strong>Puesto solicitado:</strong> ${datos.puesto}</p>
                    <p><strong>Motivo:</strong> ${datos.motivo}</p>
                    <p><strong>Tipo de sustitución:</strong> ${datos.tipo_sustitucion}</p>
                    ${datos.tipo_sustitucion === "incapacidad" ? `
                      <p><strong>Tipo de incapacidad:</strong> ${datos.tipo_incapacidad || "No especificado"}</p>
                      <p><strong>Tiempo estimado de incapacidad:</strong> ${datos.tiempo_incapacidad || "No indicado"}</p>
                    ` : ""}
                    <p><strong>Justificación:</strong> ${datos.justificacion}</p>

                    <hr class="my-4" />

                    <h3 class="text-lg font-medium">Datos Generales del Perfil</h3>
                    <ul class="list-disc list-inside space-y-1">
                      <li><strong>Edad:</strong> ${datos.datos_generales.edad}</li>
                      <li><strong>Género:</strong> ${datos.datos_generales.genero}</li>
                      <li><strong>Escolaridad:</strong> ${datos.datos_generales.escolaridad}</li>
                      <li><strong>Idiomas:</strong> ${datos.datos_generales.idiomas}</li>
                      <li><strong>Experiencia:</strong> ${datos.datos_generales.experiencia}</li>
                      <li><strong>Conocimientos:</strong> ${datos.datos_generales.conocimientos}</li>
                      <li><strong>Competencias:</strong> ${datos.datos_generales.competencias}</li>
                      <li><strong>Habilidades:</strong> ${datos.datos_generales.habilidades}</li>
                      <li><strong>Turno:</strong> ${datos.datos_generales.turno}</li>
                      <li><strong>Horario:</strong> ${datos.datos_generales.horario}</li>
                      <li><strong>Descanso:</strong> ${datos.datos_generales.descanso}</li>
                      <li><strong>Evaluación:</strong> ${datos.datos_generales.evaluacion}</li>
                      <li><strong>Observaciones:</strong> ${datos.datos_generales.observaciones}</li>
                      <li><strong>Equipo requerido:</strong> ${datos.datos_generales.equipo?.length > 0
          ? datos.datos_generales.equipo.join(", ")
          : "Ninguno"
        }</li>
                    </ul>
                  </div>
                `;

    case "Nueva Posición":
      return `
    <div class="p-6 bg-white rounded-xl shadow space-y-4">
      <p><strong>Número de empleado:</strong> ${datos.num_empleado}</p>
      <p><strong>Motivo:</strong> ${datos.motivo}</p>
      <p><strong>Nombre de la posición:</strong> ${datos.nombre_posicion}</p>
      <p><strong>Departamento:</strong> ${datos.departamento}</p>
      <p><strong>Objetivo del puesto:</strong> ${datos.objetivo}</p>
      <p><strong>Funciones principales:</strong> ${datos.funciones}</p>
      <p><strong>Decisiones que puede tomar:</strong> ${datos.decisiones}</p>

      ${datos.puestos_ascendentes?.length > 0 ? `
        <h4 class="font-semibold mt-4">Puestos ascendentes</h4>
        <ul class="list-disc list-inside">
          ${datos.puestos_ascendentes.slice(0, 10).map((p) => `<li>${p}</li>`).join("")}
        </ul>
      ` : ""}

      ${datos.puestos_laterales?.length > 0 ? `
        <h4 class="font-semibold mt-4">Puestos laterales</h4>
        <ul class="list-disc list-inside">
          ${datos.puestos_laterales.slice(0, 10).map((p) => `<li>${p}</li>`).join("")}
        </ul>
      ` : ""}

      ${datos.relaciones_internas?.length > 0 ? `
        <h4 class="font-semibold mt-4">Relaciones internas</h4>
        <ul class="list-disc list-inside">
          ${datos.relaciones_internas.slice(0, 10).map((rel) => `<li><strong>${rel.area}:</strong> ${rel.descripcion}</li>`).join("")}
        </ul>
      ` : ""}

      ${datos.relaciones_externas?.length > 0 ? `
        <h4 class="font-semibold mt-4">Relaciones externas</h4>
        <ul class="list-disc list-inside">
          ${datos.relaciones_externas.slice(0, 10).map((rel) => `<li><strong>${rel.area}:</strong> ${rel.descripcion}</li>`).join("")}
        </ul>
      ` : ""}

      ${datos.riesgos?.length > 0 ? `
        <h4 class="font-semibold mt-4">Riesgos y acciones preventivas</h4>
        <ul class="list-disc list-inside">
          ${datos.riesgos.slice(0, 10).map((r) => `<li><strong>${r.riesgo}:</strong> ${r.accion}</li>`).join("")}
        </ul>
      ` : ""}

      <hr class="my-4" />
      <h3 class="text-lg font-medium">Datos Generales del Perfil</h3>
      <ul class="list-disc list-inside space-y-1">
        <li><strong>Edad:</strong> ${datos.datos_generales.edad}</li>
        <li><strong>Género:</strong> ${datos.datos_generales.genero}</li>
        <li><strong>Escolaridad:</strong> ${datos.datos_generales.escolaridad}</li>
        <li><strong>Idiomas:</strong> ${datos.datos_generales.idiomas}</li>
        <li><strong>Experiencia:</strong> ${datos.datos_generales.experiencia}</li>
        <li><strong>Conocimientos:</strong> ${datos.datos_generales.conocimientos}</li>
        <li><strong>Competencias:</strong> ${datos.datos_generales.competencias}</li>
        <li><strong>Habilidades:</strong> ${datos.datos_generales.habilidades}</li>
        <li><strong>Turno:</strong> ${datos.datos_generales.turno}</li>
        <li><strong>Horario:</strong> ${datos.datos_generales.horario}</li>
        <li><strong>Descanso:</strong> ${datos.datos_generales.descanso}</li>
        <li><strong>Evaluación:</strong> ${datos.datos_generales.evaluacion}</li>
        <li><strong>Observaciones:</strong> ${datos.datos_generales.observaciones}</li>
        <li><strong>Equipo requerido:</strong> ${datos.datos_generales.equipo?.length > 0
          ? datos.datos_generales.equipo.join(", ")
          : "Ninguno"
        }</li>
      </ul>
    </div>
  `;

    case "Cambio de puesto":
      return `
        
        `;
    case "Aumento Plantilla":
  return `
    <div class="p-6 bg-white rounded-xl shadow space-y-4">
      <h2 class="text-xl font-bold text-gray-800">Solicitud de Aumento de Plantilla</h2>
      <p><strong>Puesto solicitado:</strong> ${datos.puesto}</p>
      <p><strong>Motivo:</strong> ${datos.motivo}</p>
      <p><strong>Justificación:</strong> ${datos.justificacion}</p>
      <p><strong>Fecha de solicitud:</strong> ${new Date(datos.fecha_solicitud).toLocaleDateString('es-MX')}</p>

      <hr class="my-4" />
      <h3 class="text-lg font-medium text-gray-700">Perfil Requerido</h3>
      <ul class="list-disc list-inside space-y-1">
        <li><strong>Edad:</strong> ${datos.datos_generales.edad}</li>
        <li><strong>Género:</strong> ${datos.datos_generales.genero}</li>
        <li><strong>Escolaridad:</strong> ${datos.datos_generales.escolaridad}</li>
        <li><strong>Idiomas:</strong> ${datos.datos_generales.idiomas}</li>
        <li><strong>Experiencia:</strong> ${datos.datos_generales.experiencia} año(s)</li>
        <li><strong>Conocimientos:</strong> ${datos.datos_generales.conocimientos}</li>
        <li><strong>Competencias:</strong> ${datos.datos_generales.competencias}</li>
        <li><strong>Habilidades:</strong> ${datos.datos_generales.habilidades}</li>
        <li><strong>Turno:</strong> ${datos.datos_generales.turno}</li>
        <li><strong>Horario:</strong> ${datos.datos_generales.horario}</li>
        <li><strong>Día de descanso:</strong> ${datos.datos_generales.descanso}</li>
        <li><strong>Evaluación inicial:</strong> ${datos.datos_generales.evaluacion}</li>
        <li><strong>Observaciones:</strong> ${datos.datos_generales.observaciones}</li>
        <li><strong>Equipo requerido:</strong> ${Array.isArray(datos.datos_generales.equipo)
          ? datos.datos_generales.equipo.join(", ")
          : "No especificado"}</li>
      </ul>
    </div>
  `;

    default:
      return `<p style="color:gray">Sin detalles específicos para este tipo de movimiento.</p>`;
  }
}

export function datosSolicitanteHtml(Nombre, num_empleado, Puesto, Departamento, FechaIngreso, Email) {
  return `
    <div style="margin-top: 20px; font-size: 15px; color: #333;">
      <h3 style="margin-bottom: 10px; color: #444;">📌 Datos del Solicitante:</h3>
      <ul style="list-style: none; padding: 0;">
        <li><strong>Nombre:</strong> ${Nombre}</li>
        <li><strong>Número de empleado:</strong> ${num_empleado}</li>
        <li><strong>Puesto:</strong> ${Puesto}</li>
        <li><strong>Departamento:</strong> ${Departamento}</li>
      </ul>
    </div>
  `;
}

export function generarCorreoRechazo(datosSolicitante, aprobacion) {
  return `
    <div style="font-family: 'Segoe UI', sans-serif; background-color: #f4f4f7; padding: 40px;">
      <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <div style="text-align: center;">
                                    <img src="https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit,fl_lossy,h_300,w_300,f_auto,q_auto/6088316/314367_858588.png" />
                                  </div>
        <h2 style="color: #dc3545; text-align: center;">❌ Movimiento rechazado</h2>
        <p>Hola <strong>${datosSolicitante.name}</strong>,</p>
        <p>Lamentamos informarte que tu solicitud de <strong>${datosSolicitante.tipo_movimiento || "movimiento"}</strong> fue <strong>rechazada</strong> por <strong>${aprobacion.nombre_aprobador}</strong>.</p>
        <p><strong>Motivo del rechazo:</strong></p>
        <blockquote style="background: #fbeaea; padding: 12px; border-left: 4px solid #dc3545; border-radius: 8px; font-style: italic; color: #a94442;">
          ${datosSolicitante.nota || "No se especificó un motivo"}
        </blockquote>
        <p style="margin-top: 16px;">Por favor, contacta a tu supervisor o recursos humanos si tienes dudas o deseas más información.</p>
        <p style="font-size: 13px; color: #999;">Este mensaje fue generado automáticamente por el sistema de recursos humanos de Grupo Tarahumara.</p>
      </div>
    </div>
  `;
}

export function generarCorreoAprobacion(solicitante, datos) {
  const detallesMovimiento = renderDatosHtml(solicitante.tipo_movimiento, datos || {});
  return `
    <div style="font-family: 'Segoe UI', sans-serif; background-color: #f4f4f7; padding: 40px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <div style="text-align: center;">
                                    <img src="https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit,fl_lossy,h_300,w_300,f_auto,q_auto/6088316/314367_858588.png" />
                                  </div>
        <h2 style="color: #28a745; text-align: center;">✅ ¡Tu movimiento fue aprobado!</h2>
        <p>Hola <strong>${solicitante.name}</strong>,</p>
        <p>Nos complace informarte que tu solicitud de <strong>${solicitante.tipo_movimiento}</strong> ha sido <strong>aprobada por todos los involucrados</strong> y se ha registrado exitosamente.</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />

        ${solicitante.nota ? `
          <div style="margin-top: 20px;">
            <p><strong>Comentarios del aprobador:</strong></p>
            <p style="background: #fffbea; padding: 12px; border-left: 4px solid #ffec99; border-radius: 6px; font-style: italic;">
              ${solicitante.nota}
            </p>
          </div>
        ` : ""}
        ${detallesMovimiento ? `
          <div style="margin-top: 24px;">
            <h3 style="color: #444;">📋 Detalles del movimiento:</h3>
            ${detallesMovimiento}
          </div>
        ` : ""}

        <p style="color: #555;">Gracias por utilizar el sistema de recursos humanos de Grupo Tarahumara.</p>
        <p style="font-size: 13px; color: #999;">Este mensaje es automático. No respondas directamente.</p>
      </div>
    </div>
  `;
}

export function generarCorreoAprobador(name, tipo_movimiento, htmlExtra, datosHtml, comentarios, enlace, fecha_incidencia) {
  return `
                              <div style="font-family: 'Segoe UI', sans-serif; background-color: #f4f4f7; padding: 40px;">
                                <style>
                                  .btn-container {
                                    display: flex;
                                    flex-wrap: wrap;
                                    justify-content: center;
                                    gap: 12px;
                                  }
                                  .btn-container a {
                                    display: inline-block;
                                    min-width: 160px;
                                    margin: 8px;
                                    text-align: center;
                                  }

                                  /* Fuerza columna vertical cuando el contenedor es estrecho o se corta el botón */
                                  @media only screen and (max-width: 768px) {
                                    .btn-container {
                                      flex-direction: column !important;
                                      align-items: center !important;
                                    }
                                    .btn-container a {
                                      width: 80% !important;
                                      margin: 12px 0 !important;
                                    }
                                  }
                                </style>

                                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                                  <div style="text-align: center;">
                                    <img src="https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit,fl_lossy,h_300,w_300,f_auto,q_auto/6088316/314367_858588.png" />
                                    <h2 style="color: #333333;">¡Hola, ${name}!</h2>
                                  </div>

                                  <p style="color: #555555; font-size: 16px; line-height: 1.6;">
                                    Se ha generado una nueva <strong>solicitud de movimiento de personal</strong> tipo <strong>${tipo_movimiento}</strong> que requiere tu revisión.
                                  </p>

                                  <p style="color: #555555; font-size: 16px; line-height: 1.6;">
                                    Fecha de incidencia: ${fecha_incidencia || "No especificada"}<br>
                                  </p>
                                  <p style="color: #555555; font-size: 16px; line-height: 1.6;">
                                    
                                    ${datosHtml}
                                  </p>

                                  <div style="margin-top: 16px; font-size: 15px; color: #333;">
                                    <h3 style="margin-bottom: 10px; color: #444;">Detalles del movimiento:</h3>
                                    ${htmlExtra}
                                  </div>

                                  <p style="color: #555555; font-size: 16px; line-height: 1.6;">
                                    <strong>Comentarios:</strong> ${comentarios || "Ninguno"}
                                  </p>

                                  <div class="btn-container" style="margin: 30px 0;">
                                    <a href="${enlace}&accion=aprobado"
                                      style="background-color: #28a745; color: white; padding: 10px 16px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                                      ✅ Aprobar
                                    </a>
                                    <a href="${enlace}&accion=rechazado"
                                      style="background-color: #dc3545; color: white; padding: 10px 16px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                                      ❌ Rechazar
                                    </a>
                                  </div>
                                  <p style="color: #777777; font-size: 14px; line-height: 1.5;">
                                    Este mensaje ha sido enviado automáticamente por el sistema de recursos humanos de <strong>Grupo Tarahumara</strong>.
                                  </p>
                                </div>
                              </div>
  `;
}