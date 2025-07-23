import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { enviarCorreo } from './emailService.js';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  getEmpleadoInfo,
  getAllUsuariosActivos,
  getAllUsuarios,
  getUsuariosPorDepartamento,
  getDepartamentos,
  getAllPersonal,
  getJerarquiaPersonal,
  getSubordinadosPorAprobador,
  getSubordinadosKardex,
  getAsistenciaPorCodigo,
  verificarUsuarioActivo
} from './dbMSSQL.js';
import { generarCorreoAprobador, renderDatosHtml } from './renders.js';
import { updateVacaciones } from './dbMSSQL.js';
import { datosSolicitanteHtml } from './renders.js';
dotenv.config();

import { procesarAprobacion } from './aprobacion.js';

// 👇 Forma correcta de obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.SERVER_PORT || 3041;

const allowedOrigins = [
  'http://localhost:3000', // para desarrollo
  'http://localhost:5173',
  'https://site.grupotarahumara.com.mx',
  'https://site-dev.in.grupotarahumara.com.mx',
  'https://capacitacion.in.grupotarahumara.com.mx',
  'http://app-img.172.16.15.30.sslip.io'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`[CORS] Rechazado origen: ${origin}`);
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true,
}));

app.use('/public', express.static('public'));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));


//dates to do a connection

const returnConnection = () => {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT
  });
};

var db = returnConnection()

db.on('error', (err) => {
  console.error('Error con la base de datos:', err);

  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNREFUSED') {
    console.log('Conexión perdida, intentando reconectar...');
    db = returnConnection(); // Reconectar
  } else {
    throw err; // Si es otro tipo de error, lanzar el error
  }
});

//connection database
db.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
});

let empleadosDb = [];

(async () => {
  empleadosDb = await getJerarquiaPersonal();
})();

app.get('/api/asistencia', async (req, res) => {
  const { codigo } = req.query;

  if (!codigo) {
    return res.status(400).json({ success: false, message: 'Falta el parámetro "codigo"' });
  }

  const data = await getAsistenciaPorCodigo(codigo);

  if (!data || data.length === 0) {
    return res.status(404).json({ success: false, message: 'No se encontró asistencia para este código' });
  }

  res.json({ success: true, data });
});

app.get('/api/movpersonal', async (req, res) => {
  const data = await getJerarquiaPersonal();
  if (!data) return res.status(500).json({ success: false, message: "Error al obtener jerarquía" });
  res.json(data);
});

app.get('/api/users', async (req, res) => {
  const data = await getAllUsuariosActivos();
  res.json(data);
});

app.get('/api/users/all', async (req, res) => {
  const data = await getAllUsuarios();
  res.json(data);
});

app.get('/api/personal', async (req, res) => {
  const data = await getAllPersonal();
  res.json(data);
});

app.get('/api/users/by-department', async (req, res) => {
  const { department } = req.query;
  if (!department) return res.status(400).json({ error: "Falta el parámetro 'department'" });

  const data = await getUsuariosPorDepartamento(department);
  res.json(data);
});

app.get('/api/departments', async (req, res) => {
  const data = await getDepartamentos();
  res.json(data);
});

app.get('/api/subordinados', async (req, res) => {
  const { num_empleado } = req.body;

  if (!num_empleado) {
    return res.status(400).json({ success: false, message: 'Número de empleado requerido' });
  }

  const data = await getSubordinadosPorAprobador(num_empleado);

  if (!data || data.length === 0) {
    return res.status(404).json({ success: false, message: 'No se encontraron subordinados para este aprobador' });
  }

  res.json({ success: true, data });
});

app.get('/api/subordinados_kardex', async (req, res) => {
  const { num_empleado } = req.query;
  console.log("📌 API recibió num_empleado:", num_empleado);

  const data = await getSubordinadosPorAprobador(num_empleado);

  console.log("📌 Resultados obtenidos:", data);

  if (!data || data.length === 0) {
    return res.status(404).json({ success: false, message: 'No se encontraron subordinados para este aprobador' });
  }

  res.json({ success: true, data });
});

app.get('/api/monitoreo-subordinados', async (req, res) => {
  const { num_empleado } = req.query;

  if (!num_empleado) {
    return res.status(400).json({ success: false, message: 'Número de empleado requerido' });
  }

  try {
    // Paso 1: Obtener los subordinados del aprobador
    const subordinados = await getSubordinadosPorAprobador(num_empleado);

    if (!subordinados || subordinados.length === 0) {
      return res.status(404).json({ success: false, message: 'No se encontraron subordinados para este aprobador' });
    }

    // Paso 2: Para cada subordinado, obtener sus checadas/incidencias
    const resultados = await Promise.all(subordinados.map(async (sub) => {
      const asistencia = await getAsistenciaPorCodigo(sub.Personal);

      return {
        ...sub,
        asistencia: asistencia || []
      };
    }));

    // Paso 3: Responder con la estructura completa
    res.json({ success: true, data: resultados });

  } catch (error) {
    console.error("❌ Error en monitoreo subordinados:", error.message || error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});


app.get('/cursospresenciales', (req, res) => {
  const query = `SELECT * FROM cursos_presenciales where status="true";`;
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send('Error fetching data');
      return;
    }
    res.json(results);
  });
});


app.get('/cursostomados', (req, res) => {
  const query = `SELECT * FROM cursos_presenciales inner join usuario_curso on usuario_curso.id_course= cursos_presenciales.id_course;`;
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send('Error fetching data');
      return;
    }
    res.json(results);
  });
});

app.post('/api/validarEmpleado', async (req, res) => {
  const { num_empleado } = req.body;

  if (!num_empleado) {
    return res.status(400).json({ success: false, message: 'Número de empleado requerido' });
  }

  const empleado = await getEmpleadoInfo(num_empleado);
  if (empleado) {
    return res.json({ success: true, data: empleado });
  } else {
    return res.status(404).json({ success: false, message: 'Empleado no encontrado o inactivo' });
  }
});

app.post('/updateProgress', (req, res) => {
  const { id_usuario, id_course, progress } = req.body;
  console.log(req.body)

  const query = `UPDATE usuario_curso
                 SET progress = '${progress}'
                 WHERE id_usuario = ${id_usuario} AND id_course = ${id_course}`;

  try {
    db.query(query, (err, result) => {
      if (err) {
        console.error("Error al actualizar el progreso:", err);
        res.status(500).send('Error en la base de datos');
      } else {
        res.json(result);
      }
    });
  } catch (e) {
    console.error("Error en el servidor:", e);
    res.status(500).send('Error en el servidor');
  }
});

app.get('/', (req, res) => {
  console.log("hola"); // Logs "hola" to the server console
  res.send("hola"); // Sends "hola" to the browser
});

app.post('/agregarUsuario', async (req, res) => {
  const { password, num_empleado } = req.body;

  if (!password || !num_empleado) {
    return res.status(400).json({ message: 'Contraseña y número de empleado requeridos' });
  }

  // 1. Buscar datos del empleado desde MSSQL
  const empleado = await getEmpleadoInfo(num_empleado);
  if (!empleado) {
    return res.status(404).json({ message: 'Empleado no encontrado en base de RH' });
  }

  // 2. Generar contraseña encriptada y token
  const hashedPassword = bcrypt.hashSync(password, 10);
  const token = crypto.randomBytes(32).toString("hex");
  const expiracion = new Date();
  expiracion.setHours(expiracion.getHours() + 24); // expira en 24 horas

  // 3. Insertar en MySQL
  const query = `
    INSERT INTO users 
    (name, email, password, status, num_empleado, rol, token_confirmacion, token_expira, confirmado)
    VALUES (?, ?, ?, 'Inactivo', ?, ?, ?, ?, 0)
  `;

  const params = [
    empleado.NombreCompleto,
    empleado.CorreoFinal,
    hashedPassword,
    empleado.Personal,
    empleado.Rol,
    token,
    expiracion,
  ];

  db.query(query, params, async (err, result) => {
    if (err) {

      console.error("❌ Error en la inserción:", err);

      if (err.code === "ER_DUP_ENTRY") {
        console.log("👉 Error MySQL:", err.code, err.sqlMessage);

        return res.status(409).json({
          success: false,
          message: "Ya existe una cuenta para este número de empleado",
        });
      }
      return res.status(500).json({
        success: false,
        message: "Error al registrar usuario en base de datos",
      });
    }



    // 4. Enviar correo con el token de activación
    const enlace = `${process.env.BASE_URL}/confirmar-cuenta?token=${token}`;
    const html = `
      <div style="font-family: sans-serif; padding: 24px;">
        <h2>Confirmación de cuenta</h2>
        <p>Hola <strong>${empleado.NombreCompleto}</strong>,</p>
        <p>Haz clic en el siguiente enlace para activar tu cuenta:</p>
        <a href="${enlace}" style="display:inline-block; background:#007bff; color:white; padding:10px 20px; border-radius:6px; text-decoration:none;">Activar cuenta</a>
        <p>Este enlace expirará en 24 horas.</p>
      </div>
    `;

    try {
      await enviarCorreo(empleado.CorreoFinal + ", becario2.sis@grupotarahumara.com.mx", "Confirma tu cuenta", html);
      console.log("📨 Correo de confirmación enviado a:", empleado.CorreoFinal);
      await enviarCorreo('becario2.sis@grupotarahumara.com.mx', "Nuevo usuario registrado", html);
      console.log("📨 Correo de confirmación enviado a becario2.sis@grupotarahumara.com.mx");
      return res.json({ success: true, message: 'Usuario registrado. Revisa tu correo para confirmar.' });
    } catch (correoError) {
      console.error("❌ Error al enviar correo:", correoError);
      return res.status(500).json({ message: 'Usuario creado, pero falló el envío del correo de confirmación' });
    }
  });
});

app.get('/api/verificar-token', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ success: false, message: "Token no proporcionado" });
  }

  const query = `SELECT * FROM users WHERE token_confirmacion = ? AND confirmado = 0`;

  db.query(query, [token], (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ success: false, message: "Token inválido o ya confirmado" });
    }

    const user = results[0];
    const ahora = new Date();

    if (new Date(user.token_expira) < ahora) {
      return res.status(400).json({ success: false, message: "Token expirado" });
    }

    res.json({ success: true, message: "Token válido" });
  });
});

app.post('/api/confirmar-cuenta', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, message: "Token no proporcionado" });

  const query = `SELECT * FROM users WHERE token_confirmacion = ? AND confirmado = 0`;
  db.query(query, [token], (err, [user]) => {
    if (err || !user)
      return res.status(400).json({ success: false, message: "Token inválido o ya confirmado" });

    const ahora = new Date();
    if (new Date(user.token_expira) < ahora)
      return res.status(400).json({ success: false, message: "Token expirado" });

    const updateQuery = `
      UPDATE users 
      SET confirmado = 1, status = 'Activo', fecha_confirmacion = NOW(), token_confirmacion = NULL 
      WHERE id = ?`;

    db.query(updateQuery, [user.id], (err2) => {
      if (err2)
        return res.status(500).json({ success: false, message: "Error al confirmar la cuenta. Intenta más tarde." });

      return res.json({ success: true, message: "Cuenta activada correctamente" });
    });
  });
});

app.get('/usuarios', (req, res) => {
  const query = `SELECT * FROM users WHERE status != 'Inactivo'`;

  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ Error al obtener usuarios:", err);
      return res.status(500).send('Error al obtener los datos');
    }
    res.json(results);
  });
});

app.put('/actualizarUsuario', (req, res) => {
  const { id, name, email, password, rol } = req.body;

  let query;
  let params;

  if (password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    query = `UPDATE users SET name = ?, email = ?, password = ?, rol = ? WHERE id = ?`;
    params = [name, email, hashedPassword, rol, id];
  } else {
    query = `UPDATE users SET name = ?, email = ?, rol = ? WHERE id = ?`;
    params = [name, email, rol, id];
  }

  db.query(query, params, (err, result) => {
    if (err) {
      console.error("❌ Error al actualizar el usuario:", err);
      res.status(500).send('Error en la base de datos');
    } else {
      res.json(result);
    }
  });
});

app.post('/eliminarUsuario', (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID del usuario requerido' });
  }

  const query = `UPDATE users SET status = 'Inactivo' WHERE id = ?`;

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("❌ Error al eliminar (desactivar) el usuario:", err);
      res.status(500).send('Error en la base de datos');
    } else {
      res.json(result);
    }
  });
});

app.post('/login', async (req, res) => {
  const { email, num_empleado, password } = req.body;

  if ((!email && !num_empleado) || !password) {
    return res.status(400).json({
      success: false,
      code: 'FIELDS_REQUIRED',
      message: 'Correo o número de empleado y contraseña son requeridos',
    });
  }

  try {
    let empleadoID = num_empleado;

    // --- CASO: Login por correo ---
    if (email) {
      const [userByEmail] = await new Promise((resolve, reject) => {
        db.query(
          `SELECT * FROM users WHERE email = ?`,
          [email],
          (err, results) => {
            if (err) return reject(err);
            resolve(results);
          }
        );
      });

      if (!userByEmail) {
        return res.status(404).json({
          success: false,
          code: 'NOT_FOUND',
          message: 'Usuario con este correo no existe',
        });
      }

      if (userByEmail.confirmado === 0) {
        return res.status(401).json({
          success: false,
          code: 'ACCOUNT_NOT_CONFIRMED',
          message: 'Tu cuenta no ha sido confirmada. Revisa tu correo electrónico.',
        });
      }

      empleadoID = userByEmail.num_empleado;

      const validPassword = await bcrypt.compare(password, userByEmail.password);
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_PASSWORD',
          message: 'Contraseña incorrecta',
        });
      }

      const activo = await verificarUsuarioActivo(empleadoID);
      if (!activo) {
        return res.status(403).json({
          success: false,
          code: 'INACTIVE_EXTERNAL',
          message: 'El usuario está dado de baja en el sistema',
        });
      }

      delete userByEmail.password;
      return res.json({
        success: true,
        message: 'Inicio de sesión exitoso',
        data: userByEmail,
      });

    } else {
      // --- CASO: Login por número de empleado ---
      const [userByNum] = await new Promise((resolve, reject) => {
        db.query(
          `SELECT * FROM users WHERE num_empleado = ?`,
          [num_empleado],
          (err, results) => {
            if (err) return reject(err);
            resolve(results);
          }
        );
      });

      if (!userByNum) {
        return res.status(404).json({
          success: false,
          code: 'NOT_FOUND',
          message: 'Número de empleado no registrado',
        });
      }

      if (userByNum.confirmado === 0) {
        return res.status(401).json({
          success: false,
          code: 'ACCOUNT_NOT_CONFIRMED',
          message: 'Tu cuenta no ha sido confirmada. Revisa tu correo electrónico.',
        });
      }

      const validPassword = await bcrypt.compare(password, userByNum.password);
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_PASSWORD',
          message: 'Contraseña incorrecta',
        });
      }

      const activo = await verificarUsuarioActivo(num_empleado);
      if (!activo) {
        return res.status(403).json({
          success: false,
          code: 'INACTIVE_EXTERNAL',
          message: 'El usuario está dado de baja en el sistema',
        });
      }

      delete userByNum.password;
      return res.json({
        success: true,
        message: 'Inicio de sesión exitoso',
        data: userByNum,
      });
    }

  } catch (error) {
    console.error("❌ Error en el proceso de login:", error);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Error inesperado en el servidor',
    });
  }
});

app.post('/api/solicitar-recuperacion', async (req, res) => {
  const { email, num_empleado } = req.body;

  if (!email && !num_empleado) {
    return res.status(400).json({ message: 'Proporcione correo o número de empleado' });
  }

  try {
    const [usuario] = await new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM users WHERE ${email ? 'email = ?' : 'num_empleado = ?'}`,
        [email || num_empleado],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiracion = new Date();
    expiracion.setHours(expiracion.getHours() + 2); // válido 2 horas

    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE users SET token_recuperacion = ?, recuperacion_expira = ? WHERE id = ?`,
        [token, expiracion, usuario.id],
        (err) => (err ? reject(err) : resolve())
      );
    });

    const enlace = `${process.env.BASE_URL}/restablecer?token=${token}`;
    const html = `
      <div style="font-family: sans-serif; padding: 24px;">
        <h2>Recuperación de contraseña</h2>
        <p>Hola <strong>${usuario.name}</strong>,</p>
        <p>Haz clic en el siguiente botón para restablecer tu contraseña:</p>
        <a href="${enlace}" style="display:inline-block; background:#9A3324; color:white; padding:10px 20px; border-radius:6px; text-decoration:none;">Restablecer contraseña</a>
        <p>Este enlace es válido por 2 horas.</p>
      </div>
    `;

    await enviarCorreo(usuario.email, 'Restablece tu contraseña', html);

    // 🔁 Retorna también el enlace
    res.json({
      success: true,
      message: 'Se envió un enlace de recuperación al correo registrado',
      enlace,
    });

  } catch (error) {
    console.error("❌ Error al solicitar recuperación:", error);
    res.status(500).json({ message: 'Error al procesar la solicitud' });
  }
});

app.post('/api/restablecer-password', async (req, res) => {
  const { token, nuevaPassword } = req.body;

  if (!token || !nuevaPassword) {
    return res.status(400).json({ message: 'Token y nueva contraseña requeridos' });
  }

  try {
    const [usuario] = await new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM users WHERE token_recuperacion = ?`,
        [token],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });

    if (!usuario) {
      return res.status(404).json({ message: 'Token inválido o caducado' });
    }

    const ahora = new Date();
    const expira = new Date(usuario.recuperacion_expira);

    if (ahora > expira) {
      return res.status(410).json({ message: 'El enlace de recuperación ha expirado' });
    }

    const hashed = bcrypt.hashSync(nuevaPassword, 10);
    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE users SET password = ?, token_recuperacion = NULL, recuperacion_expira = NULL WHERE id = ?`,
        [hashed, usuario.id],
        (err) => (err ? reject(err) : resolve())
      );
    });

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });

  } catch (error) {
    console.error("❌ Error al restablecer contraseña:", error);
    res.status(500).json({ message: 'Error al actualizar contraseña' });
  }
});

//Blog part
app.get('/posts', (req, res) => {
  const query = `SELECT * FROM Blog`;

  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send('Error fetching data');
      console.log(err);
      return;
    }

    // Asegúrate de que las imágenes se devuelvan como un array
    const posts = results.map(post => {
      if (post.img && typeof post.img === 'string') {
        try {
          post.img = JSON.parse(post.img); // Convierte la cadena JSON a un array
        } catch (error) {
          console.error('Error al parsear las imágenes:', error);
          post.img = [];
        }
      }
      return post;
    });

    res.json(posts);
    console.log(posts);
  });
});

//cursos

app.post('/actualizarCurso', (req, res) => {
  const { id_course, title, description, tutor, progress, category } = req.body;

  console.log(req.body)
  const query = `UPDATE cursos_presenciales SET title= '${title}', description = '${description}',tutor= '${tutor}', category ='${category}' WHERE id_course= ${id_course}`;

  try {
    db.query(query, (err, result) => {
      if (err) {
        console.error("Error al actualizar el usuario:", err);
        res.status(500).send('Error en la base de datos');
      } else {
        res.json(result);
      }
    });
  } catch (e) {
    console.error("Error en el servidor:", e);
    res.status(500).send('Error en el servidor');
  }
});

app.delete('/eliminarCursoTomado', (req, res) => {
  const { id_usuario, id_course, start_date } = req.body;

  // Validar entrada
  if (!id_usuario || !id_course) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  console.log("Eliminando curso:", req.body);

  const query = `DELETE FROM usuario_curso WHERE id_usuario = ? AND id_course = ? AND start_date = ?`;

  db.query(query, [id_usuario, id_course, start_date], (err, result) => {
    if (err) {
      console.error("Error al eliminar el curso tomado:", err);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Curso no encontrado o ya eliminado' });
    }

    res.json({ success: true, message: 'Curso eliminado correctamente' });
  });
});

app.post('/agregarCurso', async (req, res) => {
  try {
    const { title, description, tutor, category } = req.body;

    if (!title || !tutor) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    console.log("Datos recibidos:", req.body);

    const query = `INSERT INTO cursos_presenciales (title, description, tutor, status, category) VALUES (?, ?, ?, 'true', ?)`;

    const [result] = await db.promise().query(query, [title, description, tutor, category]);

    res.json({ success: true, message: 'Curso agregado correctamente', result });

  } catch (error) {
    console.error("Error al insertar el curso:", error);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
});

app.post('/agregarCursoTomado', (req, res) => {
  const { id_usuario, id_course, start_date, end_date, progress } = req.body;

  // Validación de entrada
  if (!id_usuario || !id_course || !start_date) {
    return res.status(400).json({ error: 'Datos incompletos o inválidos' });
  }

  console.log("Datos recibidos:", req.body);

  const finalProgress = progress !== undefined ? progress : null;

  // Consulta SQL
  const query = `INSERT INTO usuario_curso (id_usuario, id_course, progress, start_date, end_date) VALUES (?, ?, ?, ?, ?)`;
  const values = [id_usuario, id_course, finalProgress, start_date, end_date || null];

  // Ejecutar la consulta
  db.query(query, values, (err, result) => {
    if (err) {
      console.error("Error al insertar el curso:", err);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }
    console.log("Curso agregado con éxito:", result);
    res.json({ success: true, message: 'Curso agregado con éxito', result });
  });
});

app.post('/api/asignarCurso', async (req, res) => {
  try {
    const { courseId, employees } = req.body;

    if (!courseId || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos o inválidos' });
    }

    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    const formattedEndDate = endDate.toISOString().split('T')[0];

    const query = `
      INSERT INTO usuario_curso (id_usuario, id_course, progress, start_date, end_date) 
      VALUES ? 
      ON DUPLICATE KEY UPDATE 
        progress = VALUES(progress), 
        end_date = VALUES(end_date)
    `;

    const values = employees.map(emp => [emp, courseId, 0, startDate, formattedEndDate]);

    const [results] = await db.promise().query(query, [values]);

    console.log("Curso asignado con éxito:", results);
    res.json({ message: 'Curso asignado correctamente', results });

  } catch (err) {
    console.error("Error asignando curso:", err);
    res.status(500).json({ error: 'Error asignando curso' });
  }
});

app.post('/updateCargaMasiva', async (req, res) => {
  const datosExcel = req.body; // Recibimos el objeto JSON con los datos
  console.log("Datos recibidos:", datosExcel);

  // Verificar que los datos existan y sean válidos
  if (!Array.isArray(datosExcel) || datosExcel.length === 0) {
    return res.status(400).json({ success: false, message: 'Datos inválidos o vacíos' });
  }

  // Extraer datos del primer curso para insertar en `cursos_presenciales`
  const { id_usuario, curso, tutor, start_date, end_date, progress } = datosExcel[0];

  const queryInsertCourse = `
    INSERT INTO cursos_presenciales (title, description, tutor, status)
    VALUES (?, '', ?, 'true')
  `;

  const querySelectCourse = `
    SELECT id_course FROM cursos_presenciales WHERE title = ? AND tutor = ? AND status = 'true'
  `;

  const queryInsertUserCourse = `
    INSERT INTO usuario_curso (id_usuario, id_course, progress, start_date, end_date) 
    VALUES ? 
    ON DUPLICATE KEY UPDATE 
      progress = VALUES(progress), 
      end_date = VALUES(end_date)
  `;

  try {
    // Paso 1: Verificar si el curso ya existe
    const [existingCourse] = await db.promise().query(querySelectCourse, [curso, tutor]);
    let id_course;

    if (existingCourse.length > 0) {
      id_course = existingCourse[0].id_course;
      console.log("El curso ya existe. Usando ID existente:", id_course);
    } else {
      // Insertar el curso y obtener su ID
      const [insertResult] = await db.promise().query(queryInsertCourse, [curso, tutor]);
      console.log("Curso agregado con éxito:", insertResult);

      const [courseResult] = await db.promise().query(querySelectCourse, [curso, tutor]);
      if (courseResult.length === 0) {
        return res.status(404).json({ success: false, message: 'No se encontró el curso recién creado' });
      }
      id_course = courseResult[0].id_course;
      console.log("Nuevo curso creado con ID:", id_course);
    }

    // Paso 2: Insertar usuarios en `usuario_curso`
    const values2 = datosExcel.map(curso => [curso.id_usuario, id_course, curso.progress, curso.start_date, curso.end_date]);
    await db.promise().query(queryInsertUserCourse, [values2]);

    console.log("Usuarios asignados al curso con éxito");

    // Respuesta exitosa
    res.status(200).json({ success: true, message: "Proceso completado con éxito" });
  } catch (error) {
    console.error("Error en el proceso:", error);
    res.status(500).json({ success: false, message: error.message || 'Error en el servidor' });
  }
});

app.post('/AgregarPost', (req, res) => {
  const { img, title, desc, date, img_author, name_author, num_empleado, tag, videoUrl } = req.body;

  const images = Array.isArray(img) ? img : [img];
  const imgList = JSON.stringify(images);
  // Consulta con placeholders para los valores
  const query = `INSERT INTO Blog (img, title, \`desc\`, date, img_author, name_author, num_empleado, tag, videoUrl) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [imgList, title, desc, date, img_author, name_author, num_empleado, tag, videoUrl];

  try {
    db.query(query, values, (err, result) => {
      if (err) {
        console.error("Error al insertar el post:", err);
        res.status(500).send('Error en la base de datos');
      } else {
        res.json(result);
      }
    });
  } catch (e) {
    console.error("Error en el servidor:", e);
    res.status(500).send('Error en el servidor');
  }
});

app.put('/ActualizarPost', (req, res) => {
  const { idBlog, img, title, desc, date, img_author, name_author, num_empleado, tag, videoUrl } = req.body;
  const images = Array.isArray(img) ? img : [img];
  const imgList = JSON.stringify(images);
  const query = `UPDATE Blog
                 SET img = ?, title = ?, \`desc\` = ?, date = ?, img_author = ?, name_author = ?, num_empleado = ?, tag = ?, videoUrl = ?
                 WHERE idBlog = ?`;

  const values = [imgList, title, desc, date, img_author, name_author, num_empleado, tag, videoUrl, idBlog];

  try {
    db.query(query, values, (err, result) => {
      if (err) {
        console.error("Error al actualizar el post:", err);
        res.status(500).send('Error en la base de datos');
      } else {
        res.json(result);
      }
    });
  } catch (e) {
    console.error("Error en el servidor:", e);
    res.status(500).send('Error en el servidor');
  }
});

app.delete('/EliminarPost', (req, res) => {
  const { idBlog } = req.body;

  const query = `DELETE FROM Blog WHERE idBlog = ?`;

  db.query(query, [idBlog], (err, result) => {
    if (err) {
      console.error("Error al eliminar el post:", err);
      res.status(500).send('Error en la base de datos');
    } else {
      res.json(result);
    }
  });
});

app.put('/like/:id', (req, res) => {
  const { id } = req.params;
  const query = `UPDATE Blog SET likes = likes + 1 WHERE idBlog = ?`;
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error al actualizar los likes:", err);
      res.status(500).send('Error en la base de datos');
    } else {
      res.json(result);
    }
  });
});

app.put('/dislike/:id', (req, res) => {
  const { id } = req.params;
  const query = `UPDATE Blog SET likes = likes - 1 WHERE idBlog = ?`;
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error al actualizar los dislikes:", err);
      res.status(500).send('Error en la base de datos');
    } else {
      res.json(result);
    }
  });
});

app.post("/eliminarCurso", (req, res) => {


  const { id_course } = req.body;

  const query = `UPDATE cursos_presenciales
  SET status= 'false'  WHERE id_course= ${id_course}`;
  try {
    db.query(query, (err, result) => {
      if (err) {
        console.error("Error al actualizar el usuario:", err);
        res.status(500).send('Error en la base de datos');
      } else {
        res.json(result);
      }
    });
  } catch (e) {
    console.error("Error en el servidor:", e);
    res.status(500).send('Error en el servidor');
  }



})

app.post('/api/cursoDepartamento', async (req, res) => {
  const { courseId, end_date, start_date, progress, employees } = req.body;
  console.log(req.body)
  if (!courseId || !Array.isArray(employees) || employees.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos o inválidos' });
  }

  const query = `
    INSERT INTO usuario_curso (id_usuario, id_course, progress, start_date, end_date)
    VALUES ?
    ON DUPLICATE KEY UPDATE progress = VALUES(progress), end_date = VALUES(end_date)
  `;
  const values = employees.map(emp => [emp, courseId, progress, start_date, end_date]);

  try {
    const [results] = await db.promise().query(query, [values]);
    console.log("Curso asignado con éxito:", results);
    res.json({ message: 'Curso asignado correctamente', results });
  } catch (err) {
    console.error("Error asignando curso:", err);
    res.status(500).json({ error: 'Error asignando curso' });
  }
});

app.get('/convenios', (req, res) => {
  const query = `SELECT * FROM convenios`;

  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send('Error fetching data');
      console.log(err);
      return;
    }

    res.json(results);

  });
});

app.post('/agregarConvenio', (req, res) => {
  const { titulo, descripcion, img, link, tipo } = req.body;

  console.log("Datos recibidos:", req.body);

  const query = `INSERT INTO convenios (titulo, descripcion, img, link, tipo)
                 VALUES (?, ?, ?, ?, ?)`;

  const values = [titulo, descripcion, img, link, tipo];

  try {
    db.query(query, values, (err, result) => {
      if (err) {
        console.error("Error al insertar el convenio:", err);
        res.status(500).send('Error en la base de datos');
      } else {
        res.json(result);
      }
    });
  } catch (e) {
    console.error("Error en el servidor:", e);
    res.status(500).send('Error en el servidor');
  }
});

app.put('/actualizarConvenio', (req, res) => {
  const { idConvenio, titulo, descripcion, img, link, tipo } = req.body;

  const query = `UPDATE convenios
                 SET titulo = ?, descripcion = ?, img = ?, link = ?, tipo = ?
                 WHERE idConvenio = ?`;

  const values = [titulo, descripcion, img, link, tipo, idConvenio];

  try {
    db.query(query, values, (err, result) => {
      if (err) {
        console.error("Error al actualizar el convenio:", err);
        res.status(500).send('Error en la base de datos');
      }
      else {
        res.json(result);
      }
    }
    );
  } catch (e) {
    console.error("Error en el servidor:", e);
    res.status(500).send('Error en el servidor');
  }
}
);

app.delete('/eliminarConvenio', (req, res) => {
  const { idConvenio } = req.body;

  const query = `DELETE FROM convenios WHERE idConvenio = ?`;

  db.query(query, [idConvenio], (err, result) => {
    if (err) {
      console.error("Error al eliminar el convenio:", err);
      res.status(500).send('Error en la base de datos');
    } else {
      res.json(result);
    }
  }
  );
});

//comentarios

app.get('/comentarios', (req, res) => {
  const { post } = req.query;

  const query = `SELECT * FROM Comentarios WHERE idBlog = ? ORDER BY fecha DESC`;
  db.query(query, [post], (err, results) => {
    if (err) {
      console.error('Error al obtener comentarios:', err);
      res.status(500).send('Error al obtener comentarios');
    } else {
      res.json(results);
    }
  });
});

app.post('/comentarios', (req, res) => {
  const { idBlog, num_empleado, contenido } = req.body;

  console.log("Nuevo comentario recibido:", req.body); // 👈 Esto te dirá qué llega

  const query = `INSERT INTO Comentarios (idBlog, num_empleado, contenido) VALUES (?, ?, ?)`;
  db.query(query, [idBlog, num_empleado, contenido], (err, result) => {
    if (err) {
      console.error('Error al agregar comentario:', err);
      return res.status(500).send('Error al agregar comentario');
    }

    res.json({ message: 'Comentario agregado', idComentario: result.insertId });
  });
});

app.put('/comentarios/:id', (req, res) => {
  const { id } = req.params;
  const { contenido } = req.body;

  const query = `UPDATE Comentarios SET contenido = ?, editado = 1 WHERE idComentario = ?`;
  db.query(query, [contenido, id], (err) => {
    if (err) {
      console.error('Error al actualizar comentario:', err);
      res.status(500).send('Error al actualizar comentario');
    } else {
      res.json({ message: 'Comentario actualizado' });
    }
  });
});

app.delete('/comentarios/:id', (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM Comentarios WHERE idComentario = ?`;
  db.query(query, [id], (err) => {
    if (err) {
      console.error('Error al eliminar comentario:', err);
      res.status(500).send('Error al eliminar comentario');
    } else {
      res.json({ message: 'Comentario eliminado' });
    }
  });
});


//Movimientos de Personal

app.get("/api/aprobaciones", (req, res) => {
  const { aprobador } = req.query;

  if (!aprobador) {
    return res.status(400).json({ success: false, message: "Aprobador no especificado" });
  }

  const query = `SELECT a.idAprobacion, a.idMovimiento, a.orden, a.estatus, a.id_aprobador,
                        m.num_empleado, m.tipo_movimiento, m.fecha_incidencia, m.datos_json
                 FROM aprobaciones_movimientos a
                 JOIN movimientos_personal m ON a.idMovimiento = m.idMovimiento
                 WHERE a.id_aprobador = ?
                   AND a.estatus = 'pendiente'
                   AND NOT EXISTS (
                       SELECT 1 FROM aprobaciones_movimientos ap
                       WHERE ap.idMovimiento = a.idMovimiento
                         AND ap.orden < a.orden
                         AND ap.estatus != 'aprobado'
                   )
                 ORDER BY a.orden`;

  db.query(query, [aprobador], (err, rows) => {
    if (err) {
      console.error("❌ Error al obtener aprobaciones:", err);
      return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }

    // Procesar datos enriquecidos
    const empleadosMap = {};
    empleadosDb.forEach(emp => {
      empleadosMap[emp.Personal] = emp;
    });

    const parsed = rows.map((row) => {
      const empleadoInfo = empleadosMap[row.num_empleado?.toString().padStart(4, '0')];
      return {
        ...row,
        datos_json: typeof row.datos_json === "string" ? JSON.parse(row.datos_json) : row.datos_json,
        nombre_completo: empleadoInfo ? `${empleadoInfo.Nombre} ${empleadoInfo.ApellidoPaterno} ${empleadoInfo.ApellidoMaterno}` : "Desconocido",
        puesto: empleadoInfo ? empleadoInfo.Puesto : "Desconocido",
        departamento: empleadoInfo ? empleadoInfo.Departamento : "Desconocido",
      };
    });

    res.json({ success: true, data: parsed });
  });
});

const usersDb = await getAllUsuarios();

// Crear movimiento
app.post("/api/movimientos", (req, res) => {
  console.log("📥 Solicitud recibida en /api/movimientos");
  console.log("📄 Body recibido:", req.body);

  const { num_empleado, tipo_movimiento, fecha_incidencia, datos_json, comentarios, nivel_aprobacion } = req.body;

  const fechas = datos_json.fechas;
  function iniciarTransaccion() {
    if (tipo_movimiento === 'Vacaciones') {
      if (
        !num_empleado ||
        !Array.isArray(fechas) || fechas.length === 0 ||
        typeof datos_json !== 'object' ||
        typeof tipo_movimiento !== 'string' || tipo_movimiento.trim() === ''
      ) {
        console.warn("❌ [WARN] Datos incompletos o malformados");
        return res.status(400).json({ success: false, message: 'Datos incompletos o incorrectos' });
      }
    }

    db.beginTransaction((err) => {
      if (err) {
        console.error("❌ Error iniciando transacción:", err);
        return res.status(500).json({ success: false, message: "Error iniciando transacción" });
      }

      console.log("🔄 Transacción iniciada");

      const insertMovimientoQuery = `
      INSERT INTO movimientos_personal (num_empleado, tipo_movimiento, fecha_incidencia, datos_json, comentarios, estatus, nivel_aprobacion)
      VALUES (?, ?, ?, ?, ?, 'pendiente', ?)
    `;

      db.query(insertMovimientoQuery, [num_empleado, tipo_movimiento, fecha_incidencia, JSON.stringify(datos_json), comentarios, nivel_aprobacion], (err, result) => {
        if (err) {
          console.error("❌ Error insertando movimiento:", err);
          return db.rollback(() => {
            res.status(500).json({ success: false, message: "Error insertando movimiento" });
          });
        }

        const idMovimiento = result.insertId;
        console.log("✅ Movimiento insertado con ID:", idMovimiento);

      const empleado = empleadosDb.find(emp => emp.Personal === num_empleado.toString());

        if (!empleado) {
          console.error(`❌ Empleado ${num_empleado} no encontrado en empleadosDb`);
          return db.rollback(() => {
            res.status(404).json({ success: false, message: "Empleado no encontrado en base externa" });
          });
        }

        const aprobadores = [];
        let orden = 1;

        const excepcion64 = ["Nueva Posición", "Aumento Plantilla"].includes(tipo_movimiento);

        for (let nivel = 1; nivel <= nivel_aprobacion; nivel++) {
          const aprobadorId = empleado[`AprobadorNivel${nivel}`];
          if (!aprobadorId) continue;
          if (parseInt(aprobadorId) === 64 && !excepcion64) continue;

          const token = crypto.randomBytes(32).toString('hex');
          aprobadores.push([idMovimiento, orden++, aprobadorId, 'pendiente', token]);
        }

        // 🧠 Si el primer aprobador sería 64 omitido, aprobar directamente
        if (aprobadores.length === 0) {
          console.warn("⚠️ No se encontraron aprobadores válidos. Aprobando automáticamente...");

          db.query(`
    UPDATE movimientos_personal
    SET estatus = 'aprobado', nota = ?
    WHERE idMovimiento = ?
  `, [comentarios || '', idMovimiento], async (err) => {
            if (err) {
              console.error("❌ Error al aprobar automáticamente:", err);
              return db.rollback(() => {
                res.status(500).json({ success: false, message: "Error al aprobar automáticamente" });
              });
            }

            db.commit(async (err) => {
              if (err) {
                console.error("❌ Error en commit:", err);
                return db.rollback(() => {
                  res.status(500).json({ success: false, message: "Error en commit final" });
                });
              }

              console.log("✅ Movimiento aprobado automáticamente");

              // 🔔 Enviar correo al solicitante y auditores

              const destinatarios =
                ["Nueva Posición", "Sustitución", "Aumento Plantilla"].includes(tipo_movimiento)
                  ? process.env.EMAIL_REQUISICIONES
                  : process.env.EMAIL_MOVIMIENTOS;

              const auditores = process.env.EMAIL_AUDITORES;
              const destinatariosCompletos = [empleado.Email, destinatarios, auditores]
                .filter(Boolean)
                .join(",");

              try {
                await enviarCorreo(
                  destinatariosCompletos,
                  "✅ Movimiento de personal aprobado automáticamente",
                  generarCorreoAprobacion(
                    {
                      num_empleado,
                      email: empleado.Email,
                      name: empleado.Nombre,
                      tipo_movimiento,
                      nota: comentarios || '',
                      datos_json: datos_json
                    },
                    datos_json
                  )
                );
                console.log("📧 Correo de aprobación automática enviado a:", destinatariosCompletos);
              } catch (e) {
                console.error("❌ Error al enviar correo automático:", e.message);
              }

              return res.json({ success: true, idMovimiento, aprobado: true });
            });
          });

          return;
        }

        // Insertar aprobadores y enviar correo
        db.query(`
        INSERT INTO aprobaciones_movimientos (idMovimiento, orden, id_aprobador, estatus, token_aprobacion)
        VALUES ?
      `, [aprobadores], (err) => {
          if (err) {
            console.error("❌ Error insertando aprobadores:", err);
            return db.rollback(() => {
              res.status(500).json({ success: false, message: "Error insertando aprobadores" });
            });
          }

          db.commit((err) => {
            if (err) {
              console.error("❌ Error en commit:", err);
              return db.rollback(() => {
                res.status(500).json({ success: false, message: "Error en commit final" });
              });
            }

            console.log("✅ Movimiento guardado con aprobadores");
            res.json({ success: true, idMovimiento });

            // Obtener el primer aprobador para enviar correo
            const [primerAprobador] = aprobadores;
            if (!primerAprobador) return;

            const aprobadorId = primerAprobador[2];
            const token = primerAprobador[4];

            db.query(
              `SELECT email, name FROM users WHERE num_empleado = ?`,
              [aprobadorId],
              (err, results) => {
                if (err) {
                  console.error("❌ Error obteniendo datos del aprobador:", err);
                  return;
                }

                if (results.length === 0 || !results[0].email) {
                  console.warn("⚠️ No se encontró email del aprobador. Abortando envío.");
                  return;
                }

                const { email, name } = results[0];
                const enlace = `${process.env.API_BASE_URL}/api/aprobaciones/responder?token=${token}`;
                const datosHtml = datosSolicitanteHtml(
                  empleado.Nombre,
                  num_empleado,
                  empleado.Puesto,
                  empleado.Departamento,
                  empleado.FechaIngreso,
                  empleado.Email
                );
                const htmlExtra = renderDatosHtml(tipo_movimiento, datos_json);

                console.log("📨 Preparando envío de correo...");
                console.log("📩 Destinatario:", email);

                enviarCorreo(
                  email,
                  "Nueva solicitud de movimiento de personal",
                  generarCorreoAprobador(name, tipo_movimiento, htmlExtra, datosHtml, comentarios, enlace, fecha_incidencia)
                )
                  .then(() => {
                    console.log("📧 Correo enviado al primer aprobador:", email);
                  })
                  .catch((e) => {
                    console.error("❌ Error al enviar correo:", e.message);
                  });
              }
            );

          });
        });
      });
    });
  }

  if (tipo_movimiento === "Retardo justificado") {
    const countQuery = `
    SELECT COUNT(*) AS total
    FROM movimientos_personal
    WHERE num_empleado = ? AND tipo_movimiento = 'Retardo justificado'
      AND MONTH(fecha_incidencia) = MONTH(CURDATE())
      AND YEAR(fecha_incidencia) = YEAR(CURDATE())
  `;

    db.query(countQuery, [num_empleado], (err, results) => {
      if (err) {
        console.error("❌ Error contando retardos:", err);
        return res.status(500).json({ success: false, message: "Error verificando límite de retardos" });
      }

      const total = results[0].total;
      if (total >= 3) {
        return res.status(400).json({
          success: false,
          limite: true,
          message: "Ya alcanzaste el límite de 3 retardos justificados este mes.",
        });
      }

      // Si no ha alcanzado el límite, continúa con la transacción como siempre
      iniciarTransaccion(); // Mueve aquí tu lógica actual de db.beginTransaction(...)
    });
  } else {
    iniciarTransaccion(); // Mueve aquí la lógica completa existente para otros movimientos
  }

});

// Express
app.get('/api/movimientos/mios/:num_empleado', async (req, res) => {
  const { num_empleado } = req.params;

  const query = `
    SELECT 
      mp.idMovimiento,
      mp.tipo_movimiento,
      mp.fecha_incidencia,
      mp.estatus AS estatus_movimiento,
      mp.fecha_solicitud,
      mp.nivel_aprobacion,
      mp.datos_json,
      mp.comentarios,
      (
        SELECT GROUP_CONCAT(CONCAT_WS(' - ', am.id_aprobador, am.estatus) ORDER BY am.orden ASC)
        FROM aprobaciones_movimientos am
        WHERE am.idMovimiento = mp.idMovimiento
      ) AS historial_aprobaciones
    FROM movimientos_personal mp
    WHERE mp.num_empleado = ?
    ORDER BY mp.fecha_solicitud DESC
  `;

  db.query(query, [num_empleado], async (err, rows) => {
    if (err) {
      console.error('Error al obtener movimientos:', err);
      return res.status(500).json({ error: 'Error al obtener movimientos' });
    }

    // 🔁 Enriquecer historial_aprobaciones con nombres
    const movimientosConNombres = rows.map((mov) => {
      const historial = mov.historial_aprobaciones?.split(',') ?? [];
      const historialDetallado = historial.map((item) => {
        const [id_aprobador, estatus] = item.trim().split(' - ');
        const emp = empleadosDb.find((e) => e.Personal === id_aprobador);
        const nombreCompleto = emp
          ? `${emp.Nombre} ${emp.ApellidoPaterno} ${emp.ApellidoMaterno}`
          : `Empleado ${id_aprobador}`;
        return {
          id_aprobador,
          estatus,
          nombre: nombreCompleto,
        };
      });

      return {
        ...mov,
        historial_aprobaciones_detallado: historialDetallado,
      };
    });

    res.json({ data: movimientosConNombres });
  });
});

app.get('/api/movimientos/requisiciones/:num_empleado', (req, res) => {
  const { num_empleado } = req.params;

  const getRoleQuery = 'SELECT rol FROM users WHERE num_empleado = ?';

  db.query(getRoleQuery, [num_empleado], (err, roleResults) => {
    if (err) {
      console.error('Error al obtener el rol del usuario:', err);
      return res.status(500).json({ error: 'Error al validar usuario' });
    }

    if (roleResults.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const rol = roleResults[0].rol;

    let movimientosQuery = `
      SELECT 
        mp.*, 
        u.name AS nombre
      FROM movimientos_personal mp
      JOIN users u ON u.num_empleado = mp.num_empleado
      WHERE (
        mp.tipo_movimiento = 'Sustitución'
        OR mp.tipo_movimiento = 'Nueva Posición'
        OR mp.tipo_movimiento = 'Aumento Plantilla'
      )
    `;

    const params = [];

    if (rol !== 'Reclutamiento' && rol !== 'admin') {
      movimientosQuery += ' AND mp.num_empleado = ?';
      params.push(num_empleado);
    }

    movimientosQuery += ' ORDER BY mp.fecha_solicitud DESC';

    db.query(movimientosQuery, params, (err, movimientos) => {
      if (err) {
        console.error('Error al obtener movimientos:', err);
        return res.status(500).json({ error: 'Error al obtener movimientos' });
      }

      // Si no hay movimientos, regresamos vacío
      if (movimientos.length === 0) {
        return res.json({ data: [] });
      }

      // Consultamos historial de aprobadores por cada movimiento
      const movimientosConAprobaciones = movimientos.map(mov => {
        return new Promise((resolve, reject) => {
          const aprobacionesQuery = `
            SELECT 
              am.*, 
              u.name AS nombre_aprobador,
              u.num_empleado AS num_empleado_aprobador
            FROM aprobaciones_movimientos am
            JOIN users u ON u.num_empleado = am.id_aprobador
            WHERE am.idMovimiento = ?
            ORDER BY am.orden ASC
          `;

          db.query(aprobacionesQuery, [mov.idMovimiento], (err, aprobaciones) => {
            if (err) {
              console.error('Error al obtener aprobaciones:', err);
              return reject(err);
            }

            resolve({
              ...mov,
              historial_aprobaciones: aprobaciones
            });
          });
        });
      });

      Promise.all(movimientosConAprobaciones)
        .then(resultados => {
          res.json({ data: resultados });
        })
        .catch(err => {
          console.error('Error al unir aprobaciones:', err);
          res.status(500).json({ error: 'Error al obtener historial de aprobaciones' });
        });
    });
  });
});

app.get('/api/movimientos', (req, res) => {
  const query = `
  SELECT 
    mp.idMovimiento,
    mp.num_empleado,
    u.name AS nombre,
    
    mp.tipo_movimiento,
    mp.fecha_incidencia,
    mp.estatus AS estatus_movimiento,
    mp.fecha_solicitud,
    mp.nivel_aprobacion,
    mp.datos_json,
    mp.comentarios,
    (
      SELECT GROUP_CONCAT(CONCAT_WS(' - ', am.id_aprobador, am.estatus) ORDER BY am.orden ASC)
      FROM aprobaciones_movimientos am
      WHERE am.idMovimiento = mp.idMovimiento
    ) AS historial_aprobaciones
  FROM movimientos_personal mp
  LEFT JOIN users u ON u.num_empleado = mp.num_empleado
  ORDER BY mp.fecha_solicitud DESC
`;

  db.query(query, (err, rows) => {
    if (err) {
      console.error('Error al obtener movimientos:', err);
      return res.status(500).json({ error: 'Error al obtener movimientos' });
    }

    res.json({ data: rows });
  });
});

app.get('/api/movimientos/aprobados-rechazados/:id_aprobador', (req, res) => {
  const { id_aprobador } = req.params;

  const query = `
    SELECT 
      mp.*, 
      am.estatus AS estatus_aprobacion,
      am.nota AS nota_aprobacion,
      am.fecha_aprobacion,
      u.name AS nombre_empleado,
      ua.name AS nombre_aprobador
    FROM aprobaciones_movimientos am
    JOIN movimientos_personal mp ON mp.idMovimiento = am.idMovimiento
    JOIN users u ON u.num_empleado = mp.num_empleado
    JOIN users ua ON ua.num_empleado = am.id_aprobador
    WHERE am.id_aprobador = ?
      AND am.estatus IN ('aprobado', 'rechazado')
    ORDER BY am.fecha_aprobacion DESC
  `;

  db.query(query, [id_aprobador], (err, results) => {
    if (err) {
      console.error('Error al obtener movimientos aprobados o rechazados:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    res.json({ data: results });
  });
});


// Obtener movimientos pendientes por aprobador
app.get("/api/aprobaciones/pendientes/:idAprobador", async (req, res) => {
  const { idAprobador } = req.params;

  const query = `SELECT 
    am.idAprobacion,
    mp.idMovimiento,
    mp.tipo_movimiento,
    mp.fecha_incidencia,
    mp.num_empleado,
    mp.datos_json,
    mp.comentarios,
    am.orden AS orden_actual,

    (
      SELECT GROUP_CONCAT(CONCAT_WS(' ', am2.orden, am2.estatus, am2.id_aprobador) ORDER BY am2.orden)
      FROM aprobaciones_movimientos am2
      WHERE am2.idMovimiento = mp.idMovimiento
        AND am2.estatus = 'aprobado'
    ) AS historial_aprobaciones,

    (
      SELECT GROUP_CONCAT(CONCAT_WS(' ', am3.orden, am3.estatus, am3.id_aprobador) ORDER BY am3.orden)
      FROM aprobaciones_movimientos am3
      WHERE am3.idMovimiento = mp.idMovimiento
        AND am3.estatus = 'pendiente'
        AND am3.orden < am.orden
    ) AS pendientes_previos

  FROM aprobaciones_movimientos am
  JOIN movimientos_personal mp ON am.idMovimiento = mp.idMovimiento
  WHERE am.id_aprobador = ? AND am.estatus = 'pendiente'`;

  // Ejecutar query SQL
  db.query(query, [idAprobador], (err, rows) => {
    if (err) {
      console.error("❌ Error obteniendo movimientos pendientes:", err);
      return res.status(500).json({ success: false, message: "Error al obtener movimientos" });
    }

    const parseCampo = (campo) => {
      if (!campo) return [];
      return campo.split(',').map((linea) => {
        const [orden, estatus, id_aprobador] = linea.trim().split(' ');
        const emp = empleadosDb.find((e) => e.Personal === id_aprobador);
        const nombre = emp
          ? `${emp.Nombre} ${emp.ApellidoPaterno} ${emp.ApellidoMaterno}`
          : `Empleado ${id_aprobador}`;
        return { orden, estatus, id_aprobador, nombre };
      });
    };

    // Enriquecer cada movimiento
    const enriquecidos = rows.map((mov) => {
      const solicitante = empleadosDb.find((e) => e.Personal === mov.num_empleado?.toString());
      const nombreSolicitante = solicitante
        ? `${solicitante.Nombre} ${solicitante.ApellidoPaterno} ${solicitante.ApellidoMaterno}`
        : `Empleado ${mov.num_empleado}`;

      return {
        ...mov,
        nombre_solicitante: nombreSolicitante,
        historial_aprobaciones_detallado: parseCampo(mov.historial_aprobaciones),
        pendientes_previos_detallado: parseCampo(mov.pendientes_previos),
      };
    });

    res.json({ success: true, movimientos: enriquecidos });
  });
});

// Aprobar o rechazar movimiento
app.post("/api/aprobaciones/:idAprobacion/responder", async (req, res) => {
  const { idAprobacion } = req.params;
  const { estatus, nota } = req.body;

  if (!["aprobado", "rechazado"].includes(estatus)) {
    return res.status(400).json({ success: false, message: "Estatus inválido" });
  }

  try {
    await procesarAprobacion(idAprobacion, estatus, nota);
    res.json({ success: true, message: `Movimiento ${estatus}` });
  } catch (error) {
    console.error("❌ Error en aprobación:", error);
    res.status(500).json({ success: false, message: "Error al actualizar estado" });
  }
});

// Aprobar/rechazar desde correo
app.get("/api/aprobaciones/responder", (req, res) => {
  const { token, accion } = req.query;

  if (!["aprobado", "rechazado"].includes(accion)) {
    return res.status(400).send("Acción inválida.");
  }

  db.query(
    `SELECT idAprobacion, estatus
     FROM aprobaciones_movimientos
     WHERE token_aprobacion = ?`,
    [token],
    async (err, rows) => {
      if (err) {
        console.error("❌ Error al buscar token:", err);
        return res.status(500).send("Error interno del servidor.");
      }

      if (!rows || rows.length === 0) {
        return res.status(404).send("❌ Token inválido o ya utilizado.");
      }

      const aprobacion = rows[0];

      // Validar que la aprobación esté pendiente
      if (aprobacion.estatus !== "pendiente") {
        return res.send("⚠️ Esta solicitud ya fue respondida anteriormente.");
      }

      try {
        // Procesar la aprobación (también actualiza el estatus y guarda nota)
        await procesarAprobacion(aprobacion.idAprobacion, accion, "");

        // Inhabilitar el token para que no pueda usarse de nuevo
        db.query(
          `UPDATE aprobaciones_movimientos
           SET token_aprobacion = NULL
           WHERE idAprobacion = ?`,
          [aprobacion.idAprobacion],
          (err) => {
            if (err) {
              console.error("⚠️ Error anulando token tras aprobar:", err);
              // No detenemos la respuesta al usuario, solo lo logueamos
            }
          }
        );

        res.send(`<html>
    <head>
      <title>Confirmación de Respuesta</title>
      <style>
        body {
          background-color: #f6f9fc;
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #333;
          text-align: center;
        }
        .container {
          background: #fff;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          display: inline-block;
        }
        .icon {
          font-size: 64px;
          color: #2ecc71;
        }
        .warning {
          color: #f39c12;
        }
        .error {
          color: #e74c3c;
        }
        h1 {
          font-size: 24px;
          margin-top: 10px;
        }
        p {
          font-size: 18px;
        }
        .footer {
          margin-top: 20px;
          font-size: 14px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">✅</div>
        <h1>¡Respuesta registrada correctamente!</h1>
        <p>Gracias por tu colaboración. Tu decisión ha sido enviada al sistema.</p>
        <div class="footer">Grupo Tarahumara • ${new Date().getFullYear()}</div>
      </div>
    </body>
  </html>`);
      } catch (error) {
        console.error("❌ Error al procesar respuesta por token:", error);
        res.status(500).send("Error interno del servidor.");
      }
    }
  );
});

//Editar movimiento de personal Vacaciones

app.put("/api/movimientos/:idMovimiento", (req, res) => {
  const { idMovimiento } = req.params;
  const { datos_json, comentarios } = req.body;

  db.query(
    "SELECT tipo_movimiento, num_empleado FROM movimientos_personal WHERE idMovimiento = ?",
    [idMovimiento],
    async (err, results) => {
      if (err) {
        console.error("❌ Error al obtener movimiento:", err);
        return res.status(500).json({ success: false, message: "Error en la base de datos" });
      }

      if (results.length === 0) {
        return res.status(404).json({ success: false, message: "Movimiento no encontrado" });
      }

      const tipo = results[0].tipo_movimiento;
      const numEmpleado = results[0].num_empleado;

      if (tipo !== "Vacaciones") {
        return res.status(403).json({ success: false, message: "Solo se pueden editar movimientos de tipo Vacaciones" });
      }

      // Paso 1: Actualizar movimiento
      db.query(
        `UPDATE movimientos_personal
         SET datos_json = ?, comentarios = ?
         WHERE idMovimiento = ?`,
        [JSON.stringify(datos_json), comentarios || "", idMovimiento],
        async (updateErr, result) => {
          if (updateErr) {
            console.error("❌ Error actualizando movimiento:", updateErr);
            return res.status(500).json({ success: false, message: "Error actualizando movimiento" });
          }

          // Paso 2: Intentar actualizar el saldo en tabla Personal si hay datos suficientes
          const leyRestante = parseInt(datos_json.vacaciones_ley_restantes);
          const acumuladasRestantes = parseInt(datos_json.vacaciones_acumuladas_restantes);

          if (!isNaN(leyRestante) && !isNaN(acumuladasRestantes)) {
            const success = await updateVacaciones(numEmpleado, acumuladasRestantes, leyRestante);

            if (!success) {
              console.warn("⚠️ No se pudo actualizar los datos en tabla Personal");
              return res.status(200).json({
                success: true,
                message: "Movimiento actualizado, pero no se pudo actualizar tabla Personal",
              });
            }

            return res.status(200).json({
              success: true,
              message: "Movimiento y saldo de vacaciones actualizados correctamente",
            });
          }

          res.status(200).json({
            success: true,
            message: "Movimiento actualizado, pero sin datos suficientes para actualizar tabla Personal",
          });
        }
      );
    }
  );
});


//Plan de estudio

app.get("/api/plan-estudios/:num_empleado", (req, res) => {
  const { num_empleado } = req.params;

  db.query("SELECT id FROM users WHERE num_empleado = ?", [num_empleado], (err, result) => {
    if (err) return res.status(500).json({ error: "Error al buscar usuario" });
    if (result.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });

    const user_id = result[0].id;

    const query = `
      SELECT 
        cp.id_course AS modulo_id,
        cp.title AS nombre,
        cp.category AS categoria,
        cp.description AS descripcion,
        IFNULL(pe.estatus, 0) AS estatus,
        pe.fecha_completado
      FROM cursos_presenciales cp
      LEFT JOIN plan_estudios_usuario pe 
        ON pe.modulo_id = cp.id_course AND pe.user_id = ?
      ORDER BY cp.status, cp.id_course
    `;

    db.query(query, [user_id], (err2, modulos) => {
      if (err2) return res.status(500).json({ error: "Error al obtener cursos" });
      res.json(modulos);
    });
  });
});

app.put('/api/plan-estudios', (req, res) => {
  const { num_empleado, modulo_id, estatus } = req.body;

  db.query('SELECT id FROM users WHERE num_empleado = ?', [num_empleado], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al buscar usuario' });
    if (results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const user_id = results[0].id;

    const sql = `
      INSERT INTO plan_estudios_usuario (user_id, modulo_id, estatus, fecha_completado)
      VALUES (?, ?, ?, IF(? = 1, CURDATE(), NULL))
      ON DUPLICATE KEY UPDATE 
        estatus = VALUES(estatus),
        fecha_completado = IF(VALUES(estatus) = 1, CURDATE(), NULL)
    `;

    db.query(sql, [user_id, modulo_id, estatus, estatus], (err2) => {
      if (err2) return res.status(500).json({ error: 'Error al guardar curso' });

      res.json({ message: 'Curso actualizado correctamente' });
    });
  });
});


app.delete('/api/plan-estudios', (req, res) => {
  const { num_empleado, modulo_id } = req.body;

  db.query('SELECT id FROM users WHERE num_empleado = ?', [num_empleado], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al buscar usuario' });
    if (results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const user_id = results[0].id;

    db.query(
      'DELETE FROM plan_estudios_usuario WHERE user_id = ? AND modulo_id = ?',
      [user_id, modulo_id],
      (err2) => {
        if (err2) return res.status(500).json({ error: 'Error al eliminar curso' });

        res.json({ message: 'Curso eliminado del plan de estudios del usuario' });
      }
    );
  });
});


app.get('/api/plan-estudios/:num_empleado/resumen', (req, res) => {
  const { num_empleado } = req.params;

  db.query('SELECT id FROM users WHERE num_empleado = ?', [num_empleado], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al buscar usuario' });
    if (results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const user_id = results[0].id;

    const resumenSql = `
      SELECT 
        COUNT(*) AS total_modulos,
        SUM(IF(pe.estatus = 1, 1, 0)) AS completados
      FROM cursos_presenciales cp
      LEFT JOIN plan_estudios_usuario pe 
        ON pe.modulo_id = cp.id_course AND pe.user_id = ?
    `;

    db.query(resumenSql, [user_id], (err2, resumen) => {
      if (err2) return res.status(500).json({ error: 'Error al obtener resumen' });

      res.json(resumen[0]);
    });
  });
});


//open port 
app.listen(port, '0.0.0.0', () => {
  console.log(`API running at http://localhost:${port}`);
});
