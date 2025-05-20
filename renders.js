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
