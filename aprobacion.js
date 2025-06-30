import mysql from 'mysql2/promise';
import { enviarCorreo } from './emailService.js';
import { generarCorreoAprobacion, generarCorreoRechazo, generarCorreoAprobador } from './renders.js';
import { renderDatosHtml, datosSolicitanteHtml } from './renders.js';
import dotenv from 'dotenv';
import {
  getEmpleadoInfo,
  getAllUsuariosActivos,
  getAllUsuarios,
  getUsuariosPorDepartamento,
  getDepartamentos,
  getJerarquiaPersonal,
  getSubordinadosPorAprobador,
  getAsistenciaPorCodigo
} from './dbMSSQL.js';
import { updateVacaciones } from './dbMSSQL.js';
dotenv.config();

// Configuración de conexión a la base de datos MySQL
const returnConnection = () => {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT
  });
};

export async function procesarAprobacion(idAprobacion, estatus, nota) {
  let datosSolicitante = null;
  const db = await returnConnection();
 const movimientosRequisiciones = ["Sustitución", "Nueva Posición", "Aumento Plantilla"];
  try {
    await db.beginTransaction();
    console.log(`🔄 Procesando aprobación ID ${idAprobacion} con estatus ${estatus} y nota ${nota}`);

    await db.query(`
      UPDATE aprobaciones_movimientos
      SET estatus = ?, nota = ?, fecha_aprobacion = NOW()
      WHERE idAprobacion = ?
    `, [estatus, nota, idAprobacion]);

    const [[aprobacion]] = await db.query(`
      SELECT idMovimiento, orden, id_aprobador
      FROM aprobaciones_movimientos
      WHERE idAprobacion = ?
    `, [idAprobacion]);

    if (!aprobacion) throw new Error("Aprobación no encontrada.");

    const movimientoId = aprobacion.idMovimiento;

    if (estatus === "rechazado") {

      const [[aprobadorInfo]] = await db.query(`
        SELECT u.email, u.name
        FROM users u
        JOIN aprobaciones_movimientos a ON a.id_aprobador = u.num_empleado
        WHERE a.idAprobacion = ?
      `, [idAprobacion]);
      aprobacion.nombre_aprobador = aprobadorInfo?.name || `Empleado ${aprobacion.id_aprobador}`;
      console.log("🚫 Rechazando movimiento...");

      const [[solicitante]] = await db.query(`
        SELECT m.num_empleado, u.email, u.name, datos_json, tipo_movimiento, nota
        FROM movimientos_personal m
        JOIN users u ON m.num_empleado = u.num_empleado
        WHERE m.idMovimiento = ?
      `, [movimientoId]);

      if (solicitante) datosSolicitante = solicitante;

      await db.query(`
        UPDATE movimientos_personal
        SET estatus = 'rechazado', rechazado_por = ?, nota = ?
        WHERE idMovimiento = ?
      `, [aprobacion.id_aprobador, nota, movimientoId]);

      await db.query(`
        UPDATE aprobaciones_movimientos
        SET estatus = 'cancelado'
        WHERE idMovimiento = ? AND estatus = 'pendiente' AND idAprobacion != ?
      `, [movimientoId, idAprobacion]);

      await db.commit();
      console.log('✅ Movimiento rechazado y transacción finalizada');

      if (datosSolicitante) {
        await enviarCorreo(
          datosSolicitante.email,
          "❌ Movimiento de personal rechazado",
          generarCorreoRechazo(datosSolicitante, aprobacion)
        );
        console.log("📧 Notificación enviada al solicitante por rechazo.");
      }

      return;
    }

    console.log("✅ Aprobación parcial, buscando siguientes aprobadores...");

    const [[{ total: pendientes }]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM aprobaciones_movimientos
      WHERE idMovimiento = ? AND estatus = 'pendiente'
    `, [movimientoId]);

    if (pendientes === 0) {
      console.log("🎉 Todos aprobaron. Finalizando movimiento para ID:", movimientoId);

      await db.query(`
        UPDATE movimientos_personal
        SET estatus = 'aprobado', nota = ?
        WHERE idMovimiento = ?
      `, [nota, movimientoId]);

      const [[solicitante]] = await db.query(`
        SELECT m.num_empleado, u.email, u.name, datos_json, tipo_movimiento, nota
        FROM movimientos_personal m
        JOIN users u ON m.num_empleado = u.num_empleado
        WHERE m.idMovimiento = ?
      `, [movimientoId]);

      if (solicitante) {
        let datos = {};

        try {
          datos = typeof solicitante.datos_json === 'string'
            ? JSON.parse(solicitante.datos_json)
            : solicitante.datos_json;
        } catch (e) {
          console.error("❌ Error parseando datos_json:", e);
        }

        if (solicitante.tipo_movimiento === "vacaciones") {
          const { vacaciones_acumuladas_restantes: acumuladas, vacaciones_ley_restantes: ley } = datos;
          if (typeof acumuladas === "number" && typeof ley === "number") {
            await updateVacaciones(solicitante.num_empleado, acumuladas, ley);
            console.log("✅ Vacaciones actualizadas en SQL Server");
          }
        }

        const destinatarios = movimientosRequisiciones.includes(solicitante.tipo_movimiento)
        ? process.env.EMAIL_REQUISICIONES
        : process.env.EMAIL_MOVIMIENTOS;

        console.log("📧 Enviando correo de aprobación al solicitante:", solicitante.email);
        console.log("📧 Destinatarios adicionales:", destinatarios);

        await enviarCorreo(
          solicitante.email + "," + destinatarios,
          "✅ Movimiento de personal aprobado",
          generarCorreoAprobacion(solicitante, datos)
        );
        console.log("📧 Correo de aprobación enviado");
      }

      await db.commit();

      console.log('✅ Movimiento aprobado y transacción finalizada');
      return;
    }

    console.log("🔎 Hay pendientes, notificando siguiente aprobador...");

    const [[mov]] = await db.query(`
  SELECT tipo_movimiento, datos_json, comentarios
  FROM movimientos_personal
  WHERE idMovimiento = ?
`, [movimientoId]);

    const tipoMovimiento = mov.tipo_movimiento || "";
    const excepcion64 = ["nueva posición", "aumento plantilla"].includes(tipoMovimiento);

    const [[siguiente]] = await db.query(`
  SELECT a.id_aprobador, u.email, a.token_aprobacion, u.name
  FROM aprobaciones_movimientos a
  JOIN users u ON a.id_aprobador = u.num_empleado
  WHERE a.idMovimiento = ?
    AND a.estatus = 'pendiente'
    ${!excepcion64 ? "AND a.id_aprobador != 64" : ""}
    AND NOT EXISTS (
      SELECT 1 FROM aprobaciones_movimientos ap
      WHERE ap.idMovimiento = a.idMovimiento
        AND ap.orden < a.orden
        AND ap.estatus != 'aprobado'
    )
  ORDER BY a.orden
  LIMIT 1
`, [movimientoId]);

    if (!siguiente && !excepcion64) {
      // Si no hay siguiente porque era 64 y fue omitido, y no es excepción
      console.log("⏭️ Último aprobador omitido (ID 64), aprobando directamente...");

      await db.query(`
    UPDATE movimientos_personal
    SET estatus = 'aprobado', nota = ?
    WHERE idMovimiento = ?
  `, [nota, movimientoId]);

      const [[solicitante]] = await db.query(`
    SELECT m.num_empleado, u.email, u.name, datos_json, tipo_movimiento, nota
    FROM movimientos_personal m
    JOIN users u ON m.num_empleado = u.num_empleado
    WHERE m.idMovimiento = ?
  `, [movimientoId]);

      if (solicitante) {
        let datos = {};
        try {
          datos = typeof solicitante.datos_json === 'string'
            ? JSON.parse(solicitante.datos_json)
            : solicitante.datos_json;
        } catch (e) {
          console.error("❌ Error parseando datos_json:", e);
        }

        if (solicitante.tipo_movimiento === "Vacaciones") {
          const { vacaciones_acumuladas_restantes: acumuladas, vacaciones_ley_restantes: ley } = datos;
          if (typeof acumuladas === "number" && typeof ley === "number") {
            await updateVacaciones(solicitante.num_empleado, acumuladas, ley);
            console.log("✅ Vacaciones actualizadas en SQL Server");
          }
        }

        const destinatarios = movimientosRequisiciones.includes(solicitante.tipo_movimiento)
        ? process.env.EMAIL_REQUISICIONES
        : process.env.EMAIL_MOVIMIENTOS;

        console.log("📧 Enviando correo de aprobación al solicitante:", solicitante.email);
        console.log("📧 Destinatarios adicionales:", destinatarios);

        await enviarCorreo(
          solicitante.email + "," + destinatarios,
          "✅ Movimiento de personal aprobado",
          generarCorreoAprobacion(solicitante, datos)
        );
        console.log("📧 Correo de aprobación enviado");
      }

      await db.commit();
      await db.end();
      console.log("✅ Movimiento aprobado automáticamente por omisión del aprobador 64");
      return;
    }
    if (siguiente) {
      const datos = typeof mov.datos_json === 'string' ? JSON.parse(mov.datos_json) : mov.datos_json;
      const htmlExtra = renderDatosHtml(mov.tipo_movimiento, datos);
      const datosHtml = datosSolicitanteHtml(
        datos.Nombre,
        datos.num_empleado,
        datos.Puesto,
        datos.Departamento,
        datos.FechaIngreso,
        datos.Email
      );

      const enlace = `${process.env.API_BASE_URL}/api/aprobaciones/responder?token=${siguiente.token_aprobacion}`;
      
      await enviarCorreo(
        siguiente.email,
        "Nueva solicitud de movimiento de personal",
        generarCorreoAprobador(siguiente.name, mov.tipo_movimiento, htmlExtra, datosHtml, mov.comentarios, enlace)
      );

      console.log("📧 Correo enviado a siguiente aprobador");
    }

    await db.commit();
    await db.end();
    console.log('✅ Movimiento parcialmente aprobado y transacción finalizada');
  } catch (error) {
    console.error("❌ Error en proceso de aprobación:", error);
    await db.rollback();
    await db.end();
    throw error;
  }
}
