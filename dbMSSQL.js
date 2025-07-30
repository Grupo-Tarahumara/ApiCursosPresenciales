import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config(); // Carga variables del .env

const config = {
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  server: process.env.MSSQL_SERVER,
  port: parseInt(process.env.MSSQL_PORT || '1433'),
  database: process.env.MSSQL_DB,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000 // 30 segundos
  },
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('✅ MSSQL conectado correctamente');
    return pool;
  })
  .catch(err => {
    console.error('❌ Error conectando a MSSQL:', err);
    throw err;
  });

export { poolPromise, sql };

// Empleado individual con rol y correo final
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
            WHEN p.Puesto LIKE '%Dirección%' OR p.Puesto = 'Direccion General' THEN 'Direccion'
            WHEN p.Puesto LIKE '%Director%' THEN 'Director'
            ELSE 'Usuario común'
          END AS Rol
        FROM personal p
        LEFT JOIN usuario u ON REPLACE(u.Usuario, 'E-', '') = p.Personal
        WHERE p.Estatus = 'ALTA' AND p.Personal = @numEmpleado
      `);
    return result.recordset[0] || null;
  } catch (error) {
    console.error('❌ Error getEmpleadoInfo:', error.message || error);
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
        UPDATE personal
        SET vacaciones_acumuladas = @vacacionesAcumuladas,
            vacaciones_ley = @vacacionesLey
        WHERE Personal = @numEmpleado AND Estatus = 'ALTA'
      `);
    const filas = result.rowsAffected[0];
    console.log(`✅ Vacaciones actualizadas para ${filas} empleado(s) con Personal: ${paddedNumEmpleado}`);
    console.log("Filas afectadas:", filas);

    return filas > 0;
  }
  catch (error) {
    console.error("❌ Error Actualizando Vacaciones:", error.message || error);
    return false;
  }
};
// Todos los usuarios activos
export const getAllUsuariosActivos = async () => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT 
        Personal, ApellidoPaterno, ApellidoMaterno, Nombre, Estatus,
        Puesto, Jornada, Permiso, Departamento, PeriodoTipo,
        vacaciones_acumuladas, vacaciones_ley,
        Registro2 AS RFC, Registro3 AS NSS,
        FORMAT(FechaAntiguedad, 'dd/MM/yyyy') AS FechaAlta
      FROM personal 
      WHERE Estatus = 'ALTA'
    `);
    return result.recordset;
  } catch (error) {
    console.error("❌ Error getAllUsuariosActivos:", error.message);
    return [];
  }
};

export const getAsistenciaPorCodigo = async (codigo) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('codigo', sql.VarChar, codigo)
      .query(`
        WITH checadas_agrupadas AS (
          SELECT
              CAST(CODIGO AS INT) AS CODIGO,
              FECHA,
              MIN(HORA) AS HORA_ENTRADA,
              MAX(HORA) AS HORA_SALIDA
          FROM checadas
          GROUP BY CAST(CODIGO AS INT), FECHA
      )
      SELECT
          id.CODIGO,
          id.NOMBRE,
          id.FECHA,
          id.DIA_SEM,
          id.E1 AS ENTRADA_PROGRAMADA,
          id.S1 AS SALIDA_PROGRAMADA,
          ic.INC,
          ic.NOMINC AS NOMBRE_INCIDENCIA,
          ic.VALOR AS VALOR_INCIDENCIA,
          id.CVEINC,
          id.NOMINC AS TIPO_ASISTENCIA
      FROM inc_dia id
      LEFT JOIN checadas_agrupadas ca
          ON CAST(id.CODIGO AS INT) = ca.CODIGO AND id.FECHA = ca.FECHA
      LEFT JOIN inc_checadas ic
          ON CAST(id.CODIGO AS INT) = CAST(ic.CODIGO AS INT) AND id.FECHA = ic.FECHA
      WHERE CAST(id.CODIGO AS INT) = CAST(@codigo AS INT)
          AND id.FECHA >= DATEADD(DAY, -30, GETDATE())
      ORDER BY id.FECHA, id.CODIGO
      `);
    return result.recordset;
  } catch (error) {
    console.error("❌ Error getAsistenciaPorCodigo:", error.message);
    return [];
  }
};

export const getAllPuestos = async () => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT DISTINCT Puesto
      FROM personal
      WHERE Puesto IS NOT NULL AND Puesto <> ''
      ORDER BY Puesto
    `);
    return result.recordset.map(row => row.Puesto);
  } catch (error) {
    console.error("❌ Error getAllPuestos:", error.message);
    return [];
  }
};

// Todos los registros sin filtro
export const getAllUsuarios = async () => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT 
        Personal, ApellidoPaterno, ApellidoMaterno, Nombre, Estatus,
        Puesto, Departamento, PeriodoTipo,
        Registro2 AS RFC, Registro3 AS NSS,
        FORMAT(FechaAntiguedad, 'dd/MM/yyyy') AS FechaAlta
      FROM personal
    `);
    return result.recordset;
  } catch (error) {
    console.error("❌ Error getAllUsuarios:", error.message);
    return [];
  }
};

export const getAllPersonal = async () => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT 
        Personal,
        ApellidoPaterno,
        ApellidoMaterno,
        Nombre,
        Sexo,
        Estatus,
        Puesto,
        Departamento,
        PeriodoTipo,
        TipoContrato,
        Jornada,
        TipoSueldo,
        FORMAT(FechaAntiguedad, 'dd/MM/yyyy'),
        Situacion,
        Registro AS CURP,
        EstadoCivil,
        Registro2 AS RFC,
        Registro3 AS NSS,
        Tipo,
        Direccion,
        DireccionNumero,
        DireccionNumeroInt,
        Colonia,
        Delegacion,
        Poblacion,
        Estado,
        Pais,
        CodigoPostal,
        Telefono,
        eMail,
        ZonaEconomica,
        FormaPago,
        CtaDinero,
        PersonalSucursal,
        PersonalCuenta,
        FORMAT(FechaNacimiento, 'dd/MM/yyyy') AS FechaNacimiento,
        LugarNacimiento,
        Nacionalidad,
        Beneficiario,
        Parentesco,
        Porcentaje,
        Beneficiario2,
        Parentesco2,
        Madre,
        Padre,
        ReportaA
      FROM personal
    `);
    return result.recordset;
  } catch (error) {
    console.error("❌ Error getAllUsuarios:", error.message);
    return [];
  }
};


export const updatePersonal = async (id, data) => {
  try {
    const pool = await sql.connect(config);
    const request = pool.request();

    // ID obligatorio
    request.input("id", sql.VarChar, id);

    const setClauses = [];
    const keys = Object.keys(data);

    for (const key of keys) {
      if (key === "Personal") continue;

      const value = data[key];

      // Determinar tipo SQL (usa Date para campos que lo necesitan)
      const sqlType =
        ["FechaNacimiento", "FechaAntiguedad"].includes(key) && value
          ? sql.Date
          : sql.VarChar;

      // Agregar al SET solo si viene definido
      if (value !== undefined) {
        request.input(key, sqlType, value || null);
        setClauses.push(`${key} = @${key}`);
      }
    }

    if (setClauses.length === 0) {
      throw new Error("No hay campos válidos para actualizar.");
    }

    const query = `
      UPDATE personal
      SET ${setClauses.join(", ")}
      WHERE Personal = @id
    `;

    const result = await request.query(query);
    return result;
  } catch (error) {
    console.error("❌ Error en updatePersonal:", error.message);
    throw error;
  }
};


export const createPersonal = async (data) => {
  try {
    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("Personal", sql.VarChar, data.Personal)
      .input("ApellidoPaterno", sql.VarChar, data.ApellidoPaterno)
      .input("ApellidoMaterno", sql.VarChar, data.ApellidoMaterno)
      .input("Nombre", sql.VarChar, data.Nombre)
      .input("Sexo", sql.VarChar, data.Sexo)
      .input("Estatus", sql.VarChar, data.Estatus)
      .input("Puesto", sql.VarChar, data.Puesto)
      .input("Departamento", sql.VarChar, data.Departamento)
      .input("PeriodoTipo", sql.VarChar, data.PeriodoTipo)
      .input("TipoContrato", sql.VarChar, data.TipoContrato)
      .input("Jornada", sql.VarChar, data.Jornada)
      .input("TipoSueldo", sql.VarChar, data.TipoSueldo)
      .input("FechaAntiguedad", sql.Date, data.FechaAntiguedad)
      .input("Situacion", sql.VarChar, data.Situacion)
      .input("CURP", sql.VarChar, data.CURP)
      .input("EstadoCivil", sql.VarChar, data.EstadoCivil)
      .input("RFC", sql.VarChar, data.RFC)
      .input("NSS", sql.VarChar, data.NSS)
      .input("Tipo", sql.VarChar, data.Tipo)
      .input("Direccion", sql.VarChar, data.Direccion)
      .input("DireccionNumero", sql.VarChar, data.DireccionNumero)
      .input("DireccionNumeroInt", sql.VarChar, data.DireccionNumeroInt)
      .input("Colonia", sql.VarChar, data.Colonia)
      .input("Delegacion", sql.VarChar, data.Delegacion)
      .input("Poblacion", sql.VarChar, data.Poblacion)
      .input("Estado", sql.VarChar, data.Estado)
      .input("Pais", sql.VarChar, data.Pais)
      .input("CodigoPostal", sql.VarChar, data.CodigoPostal)
      .input("Telefono", sql.VarChar, data.Telefono)
      .input("eMail", sql.VarChar, data.eMail)
      .input("ZonaEconomica", sql.VarChar, data.ZonaEconomica)
      .input("FormaPago", sql.VarChar, data.FormaPago)
      .input("CtaDinero", sql.VarChar, data.CtaDinero)
      .input("PersonalSucursal", sql.VarChar, data.PersonalSucursal)
      .input("PersonalCuenta", sql.VarChar, data.PersonalCuenta)
      .input("FechaNacimiento", sql.Date, data.FechaNacimiento)
      .input("LugarNacimiento", sql.VarChar, data.LugarNacimiento)
      .input("Nacionalidad", sql.VarChar, data.Nacionalidad)
      .input("Beneficiario", sql.VarChar, data.Beneficiario)
      .input("BeneficiarioParentesco", sql.VarChar, data.BeneficiarioParentesco)
      .input("PorcentajeBeneficiario", sql.VarChar, data.PorcentajeBeneficiario)
      .input("Beneficiario2", sql.VarChar, data.Beneficiario2)
      .input("Parentesco2", sql.VarChar, data.Parentesco2)
      .input("Madre", sql.VarChar, data.Madre)
      .input("Padre", sql.VarChar, data.Padre)
      .input("ReportaA", sql.VarChar, data.ReportaA)
      .query(`
        INSERT INTO personal (
          Personal, ApellidoPaterno, ApellidoMaterno, Nombre, Sexo, Estatus,
          Puesto, Departamento, PeriodoTipo, TipoContrato, Jornada, TipoSueldo, FechaAntiguedad, Situacion,
          Registro, EstadoCivil, Registro2, Registro3, Tipo,
          Direccion, DireccionNumero, DireccionNumeroInt, Colonia, Delegacion, Poblacion, Estado, Pais, CodigoPostal, Telefono, eMail,
          ZonaEconomica, FormaPago, CtaDinero, PersonalSucursal, PersonalCuenta, FechaNacimiento, LugarNacimiento, Nacionalidad,
          Beneficiario, Parentesco, Porcentaje, Beneficiario2, Parentesco2, Madre, Padre, ReportaA
        )
        VALUES (
          @Personal, @ApellidoPaterno, @ApellidoMaterno, @Nombre, @Sexo, @Estatus,
          @Puesto, @Departamento, @PeriodoTipo, @TipoContrato, @Jornada, @TipoSueldo, @FechaAntiguedad, @Situacion,
          @CURP, @EstadoCivil, @RFC, @NSS, @Tipo,
          @Direccion, @DireccionNumero, @DireccionNumeroInt, @Colonia, @Delegacion, @Poblacion, @Estado, @Pais, @CodigoPostal, @Telefono, @eMail,
          @ZonaEconomica, @FormaPago, @CtaDinero, @PersonalSucursal, @PersonalCuenta, @FechaNacimiento, @LugarNacimiento, @Nacionalidad,
          @Beneficiario, @BeneficiarioParentesco, @PorcentajeBeneficiario, @Beneficiario2, @Parentesco2, @Madre, @Padre, @ReportaA
        )
      `);

    return true;
  } catch (err) {
    console.error("❌ Error en createPersonal:", err.message);
    throw err;
  }
};

// Usuarios por departamento
export const getUsuariosPorDepartamento = async (departamento) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input("Departamento", sql.VarChar, departamento)
      .query(`
        SELECT 
          Personal, Nombre, ApellidoPaterno, ApellidoMaterno, Puesto,
          FORMAT(FechaAntiguedad, 'dd/MM/yyyy') AS FechaAlta
        FROM personal 
        WHERE Departamento = @Departamento AND Estatus = 'ALTA'
      `);
    return result.recordset;
  } catch (error) {
    console.error("❌ Error getUsuariosPorDepartamento:", error.message);
    return [];
  }
};

//verificar si el usario existe y sigue activo
export const verificarUsuarioActivo = async (numEmpleado) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('numEmpleado', sql.VarChar, String(numEmpleado).trim())
      .query(`
        SELECT COUNT(*) AS Existe
        FROM personal 
        WHERE Personal = @numEmpleado AND Estatus = 'ALTA'
      `);
    return result.recordset[0].Existe > 0;
  } catch (error) {
    console.error("❌ Error verificarUsuarioActivo:", error.message);
    return false;
  }
}

// Lista de departamentos únicos
export const getDepartamentos = async () => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT DISTINCT Departamento 
      FROM personal 
      WHERE Departamento IS NOT NULL AND Estatus = 'ALTA'
    `);
    return result.recordset.map(row => row.Departamento);
  } catch (error) {
    console.error("❌ Error getDepartamentos:", error.message);
    return [];
  }
};

export const getSubordinadosPorAprobador = async (numEmpleado) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('numEmpleado', sql.VarChar, String(numEmpleado).trim())
      .query(`
        WITH Jerarquia AS (
            SELECT 
                p.Personal AS EmpleadoID,
                p.Personal,
                p.reportaA,
                p.ApellidoPaterno,
                p.ApellidoMaterno,
                p.Nombre,
                p.Estatus,
                p.Puesto,
                p.Departamento,
                CAST(p.reportaA AS VARCHAR(100)) AS AprobadorNivel1,
                CAST(NULL AS VARCHAR(100)) AS AprobadorNivel2,
                CAST(NULL AS VARCHAR(100)) AS AprobadorNivel3,
                CAST(NULL AS VARCHAR(100)) AS AprobadorNivel4,
                CAST(NULL AS VARCHAR(100)) AS AprobadorNivel5,
                1 AS Nivel
            FROM personal p
            WHERE p.Estatus = 'ALTA'

            UNION ALL

            SELECT 
                j.EmpleadoID,
                j.Personal,
                p.reportaA,
                j.ApellidoPaterno,
                j.ApellidoMaterno,
                j.Nombre,
                j.Estatus,
                j.Puesto,
                j.Departamento,
                j.AprobadorNivel1,
                CASE WHEN j.Nivel = 1 THEN CAST(p.reportaA AS VARCHAR(100)) ELSE j.AprobadorNivel2 END,
                CASE WHEN j.Nivel = 2 THEN CAST(p.reportaA AS VARCHAR(100)) ELSE j.AprobadorNivel3 END,
                CASE WHEN j.Nivel = 3 THEN CAST(p.reportaA AS VARCHAR(100)) ELSE j.AprobadorNivel4 END,
                CASE WHEN j.Nivel = 4 THEN CAST(p.reportaA AS VARCHAR(100)) ELSE j.AprobadorNivel5 END,
                j.Nivel + 1
            FROM Jerarquia j
            JOIN personal p ON j.reportaA = p.Personal
            WHERE j.Nivel < 5
        )

        SELECT
            EmpleadoID AS Personal,
            ApellidoPaterno,
            ApellidoMaterno,
            Nombre,
            Estatus,
            Puesto,
            Departamento,
            MAX(AprobadorNivel1) AS AprobadorNivel1
        FROM Jerarquia
        WHERE 
            @numEmpleado IN (
                AprobadorNivel1, 
                AprobadorNivel2, 
                AprobadorNivel3, 
                AprobadorNivel4, 
                AprobadorNivel5
            )
        GROUP BY
            EmpleadoID,
            ApellidoPaterno,
            ApellidoMaterno,
            Nombre,
            Estatus,
            Puesto,
            Departamento
      `);
    return result.recordset;
  } catch (error) {
    console.error("❌ Error getSubordinadosPorAprobador:", error.message || error);
    return [];
  }
};

  export const getSubordinadosKardex = async (numEmpleado) => {
    try {
      const pool = await sql.connect(config);
      const result = await pool.request()
        .input('numEmpleado', sql.VarChar, String(numEmpleado).trim())
        .query(`
          WITH Jerarquia AS (
              SELECT 
                  p.Personal AS EmpleadoID,
                  p.Personal,
                  p.reportaA,
                  p.ApellidoPaterno,
                  p.ApellidoMaterno,
                  p.Nombre,
                  p.Estatus,
                  p.Puesto,
                  p.Departamento,
                  CAST(p.reportaA AS VARCHAR(100)) AS AprobadorNivel1,
                  CAST(NULL AS VARCHAR(100)) AS AprobadorNivel2,
                  CAST(NULL AS VARCHAR(100)) AS AprobadorNivel3,
                  CAST(NULL AS VARCHAR(100)) AS AprobadorNivel4,
                  CAST(NULL AS VARCHAR(100)) AS AprobadorNivel5,
                  1 AS Nivel
              FROM personal p
              WHERE p.Estatus = 'ALTA'

              UNION ALL

              SELECT 
                  j.EmpleadoID,
                  j.Personal,
                  p.reportaA,
                  j.ApellidoPaterno,
                  j.ApellidoMaterno,
                  j.Nombre,
                  j.Estatus,
                  j.Puesto,
                  j.Departamento,
                  j.AprobadorNivel1,
                  CASE WHEN j.Nivel = 1 THEN CAST(p.reportaA AS VARCHAR(100)) ELSE j.AprobadorNivel2 END,
                  CASE WHEN j.Nivel = 2 THEN CAST(p.reportaA AS VARCHAR(100)) ELSE j.AprobadorNivel3 END,
                  CASE WHEN j.Nivel = 3 THEN CAST(p.reportaA AS VARCHAR(100)) ELSE j.AprobadorNivel4 END,
                  CASE WHEN j.Nivel = 4 THEN CAST(p.reportaA AS VARCHAR(100)) ELSE j.AprobadorNivel5 END,
                  j.Nivel + 1
              FROM Jerarquia j
              JOIN personal p ON j.reportaA = p.Personal
              WHERE j.Nivel < 5
          )

          SELECT
              EmpleadoID AS Personal,
              ApellidoPaterno,
              ApellidoMaterno,
              Nombre,
              Estatus,
              Puesto,
              Departamento,
              MAX(AprobadorNivel1) AS AprobadorNivel1
          FROM Jerarquia
          WHERE 
              CAST(@numEmpleado AS VARCHAR(100)) IN (
                  AprobadorNivel1, 
                  AprobadorNivel2, 
                  AprobadorNivel3, 
                  AprobadorNivel4, 
                  AprobadorNivel5
              )
          GROUP BY
              EmpleadoID,
              ApellidoPaterno,
              ApellidoMaterno,
              Nombre,
              Estatus,
              Puesto,
              Departamento
        `);
      return result.recordset;
    } catch (error) {
      console.error("❌ Error getSubordinadosKardex:", error.message || error);
      return [];
    }
  };


// Jerarquía de aprobadores (movpersonal)
export const getJerarquiaPersonal = async () => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      WITH Jerarquia AS (
        SELECT 
            p.Personal AS EmpleadoID,
            p.Personal,
            p.reportaA,
            p.ApellidoPaterno,
            p.ApellidoMaterno,
            p.Nombre,
            p.Estatus,
            p.Puesto,
            p.Departamento,
            p.PeriodoTipo,
            p.Registro2 AS RFC,
            p.Registro3 AS NSS,
            FORMAT(p.FechaAntiguedad, 'dd/MM/yyyy') AS FechaAlta,
            CAST(p.reportaA AS VARCHAR(100)) AS AprobadorNivel1,
            CAST(NULL AS VARCHAR(100)) AS AprobadorNivel2,
            CAST(NULL AS VARCHAR(100)) AS AprobadorNivel3,
            CAST(NULL AS VARCHAR(100)) AS AprobadorNivel4,
            CAST(NULL AS VARCHAR(100)) AS AprobadorNivel5,
            1 AS Nivel
        FROM personal p
        WHERE p.Estatus = 'ALTA'

        UNION ALL

        SELECT 
            j.EmpleadoID,
            j.Personal,
            p.reportaA,
            j.ApellidoPaterno,
            j.ApellidoMaterno,
            j.Nombre,
            j.Estatus,
            j.Puesto,
            j.Departamento,
            j.PeriodoTipo,
            j.RFC,
            j.NSS,
            j.FechaAlta,
            j.AprobadorNivel1,
            CASE WHEN j.Nivel = 1 THEN CAST(p.reportaA AS VARCHAR(100)) ELSE j.AprobadorNivel2 END,
            CASE WHEN j.Nivel = 2 THEN CAST(p.reportaA AS VARCHAR(100)) ELSE j.AprobadorNivel3 END,
            CASE WHEN j.Nivel = 3 THEN CAST(p.reportaA AS VARCHAR(100)) ELSE j.AprobadorNivel4 END,
            CASE WHEN j.Nivel = 4 THEN CAST(p.reportaA AS VARCHAR(100)) ELSE j.AprobadorNivel5 END,
            j.Nivel + 1
        FROM Jerarquia j
        JOIN personal p ON j.reportaA = p.Personal
        WHERE j.Nivel < 5
      )

      SELECT
          EmpleadoID AS Personal,
          ApellidoPaterno,
          ApellidoMaterno,
          Nombre,
          Estatus,
          Puesto,
          Departamento,
          PeriodoTipo,
          RFC,
          NSS,
          FechaAlta,
          MAX(AprobadorNivel1) AS AprobadorNivel1,
          MAX(AprobadorNivel2) AS AprobadorNivel2,
          MAX(AprobadorNivel3) AS AprobadorNivel3,
          MAX(AprobadorNivel4) AS AprobadorNivel4,
          MAX(AprobadorNivel5) AS AprobadorNivel5
      FROM Jerarquia
      GROUP BY
          EmpleadoID,
          ApellidoPaterno,
          ApellidoMaterno,
          Nombre,
          Estatus,
          Puesto,
          Departamento,
          PeriodoTipo,
          RFC,
          NSS,
          FechaAlta
    `);
    return result.recordset;
  } catch (error) {
    console.error("❌ Error getJerarquiaPersonal:", error.message);
    return [];
  }
};
