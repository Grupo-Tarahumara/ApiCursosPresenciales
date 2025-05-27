// dbMSSQL.js
import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config(); // Carga variables del .env

// Configuración segura desde .env
const config = {
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  server: process.env.MSSQL_SERVER, // Ej: '192.168.29.40'
  port: parseInt(process.env.MSSQL_PORT || '1433'),
  database: process.env.MSSQL_DB,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

// Función que busca datos de empleado
export const getEmpleadoInfo = async (numEmpleado) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('numEmpleado', sql.VarChar, numEmpleado)
      .query(`
        SELECT 
          p.Personal,
          CONCAT(p.Nombre, ' ', p.ApellidoPaterno, ' ', p.ApellidoMaterno) AS NombreCompleto,
          p.Puesto,
          CASE 
            WHEN u.Email IS NULL OR u.Email IN ('0', '.') THEN p.Email
            ELSE u.Email
          END AS CorreoFinal,
          CASE 
            WHEN p.Puesto LIKE '%Coord%' OR p.Puesto LIKE '%Coordinador%' THEN 'Coordinador'
            WHEN p.Puesto LIKE '%Sub Jefe%' OR p.Puesto LIKE '%Subjefe%' THEN 'Subjefe'
            WHEN p.Puesto LIKE '%Jefe%' THEN 'Jefe'
            WHEN p.Puesto LIKE '%Gerente%' OR p.Puesto LIKE '%Gte%' THEN 'Gerente'
            WHEN p.Puesto LIKE '%Dirección%' OR p.Puesto = 'Direccion General' THEN 'Dirección'
            WHEN p.Puesto LIKE '%Director%' THEN 'Director'
            ELSE 'Usuario común'
          END AS Rol
        FROM personal p
        LEFT JOIN usuario u ON REPLACE(u.Usuario, 'E-', '') = p.Personal
        WHERE p.Estatus = 'ALTA' AND p.Personal = @numEmpleado
      `);

    return result.recordset[0] || null;

  } catch (error) {
    console.error('❌ Error conectando a MSSQL:', error.message || error);
    return null;
  }
};

// UPDATE vacaciones_acumuladas y vacaciones_ley en Personal
export const updateVacaciones = async (numEmpleado, vacacionesAcumuladas, vacacionesLey) => {
  try {
    const paddedNumEmpleado = String(numEmpleado) // 🔁 Ajuste para VARCHAR(10)
    console.log("🔍 Enviando numEmpleado (formateado):", paddedNumEmpleado);
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('numEmpleado', sql.VarChar, paddedNumEmpleado)
      .input('vacacionesAcumuladas', sql.Int, vacacionesAcumuladas)
      .input('vacacionesLey', sql.Int, vacacionesLey)
      .query(`
        UPDATE Personal
        SET vacaciones_acumuladas = @vacacionesAcumuladas,
            vacaciones_ley = @vacacionesLey
        WHERE Personal = @numEmpleado
      `);
      const filas = result.rowsAffected[0];
    console.log(`📘 Filas afectadas en personal: ${filas}`);
    return filas > 0;

  } catch (error) {
    console.error('❌ Error actualizando vacaciones:', error.message || error);
    return false;
  }
};
