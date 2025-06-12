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
          <p><strong>Días de curso:</strong> ${datos.trainingDays}</p>
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

    default:
      return `<p style="color:gray">Sin detalles específicos para este tipo de movimiento.</p>`;
  }
}

export function ConfirmarCuentaPage(message, isSuccess) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Confirmación de cuenta</title>
      <style>
        body {
          font-family: 'Segoe UI', sans-serif;
          background-color: #f4f4f4;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .card {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
        }
        .icon {
          font-size: 64px;
          color: ${isSuccess ? '#28a745' : '#dc3545'};
        }
        .message {
          font-size: 18px;
          margin-top: 20px;
          color: #333;
        }
        .button {
          margin-top: 30px;
          background-color: ${isSuccess ? '#28a745' : '#6c757d'};
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          text-decoration: none;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">${isSuccess ? '✅' : '❌'}</div>
        <div class="message">${message}</div>
        <a class="button" href="${process.env.BASE_URL || '/'}">
          Ir al inicio
        </a>
      </div>
    </body>
    </html>
  `;
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