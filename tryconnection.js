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
  getJerarquiaPersonal,
  getSubordinadosPorAprobador,
  getAsistenciaPorCodigo
} from './dbMSSQL.js';
import { renderDatosHtml } from './renders.js';
import { updateVacaciones } from './dbMSSQL.js';
import { datosSolicitanteHtml } from './renders.js';
dotenv.config();

// 👇 Forma correcta de obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.SERVER_PORT || 3041;

app.use(cors());
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


app.get('/confirmar-cuenta', (req, res) => {
  const { token } = req.query;
  if (!token) return res.send(ConfirmarCuentaPage("Token no proporcionado", false));

  const query = `SELECT * FROM users WHERE token_confirmacion = ? AND confirmado = 0`;
  db.query(query, [token], (err, [user]) => {
    if (err || !user)
      return res.send(ConfirmarCuentaPage("Token inválido o cuenta ya confirmada", false));

    const ahora = new Date();
    if (user.token_expira && new Date(user.token_expira) < ahora)
      return res.send(ConfirmarCuentaPage("El token ha expirado. Solicita un nuevo enlace.", false));

    const updateQuery = `
      UPDATE users 
      SET confirmado = 1, status = 'Activo', fecha_confirmacion = NOW(), token_confirmacion = NULL 
      WHERE id = ?`;

    db.query(updateQuery, [user.id], (err2) => {
      if (err2)
        return res.send(ConfirmarCuentaPage("Error al confirmar la cuenta. Intenta más tarde.", false));

      return res.send(ConfirmarCuentaPage("¡Tu cuenta ha sido confirmada con éxito! Ya puedes iniciar sesión.", true));
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
  const { id, name, email, password } = req.body;

  let query;
  let params;

  if (password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    query = `UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?`;
    params = [name, email, hashedPassword, id];
  } else {
    query = `UPDATE users SET name = ?, email = ? WHERE id = ?`;
    params = [name, email, id];
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


app.post('/login', async (req, res) => {
  const { email, num_empleado, password } = req.body;

  if ((!email && !num_empleado) || !password) {
    return res.status(400).json({
      success: false,
      message: 'Correo o número de empleado y contraseña son requeridos'
    });
  }

  const query = email
    ? `SELECT * FROM users WHERE email = ? AND status = 'Activo'`
    : `SELECT * FROM users WHERE num_empleado = ? AND status = 'Activo'`;

  const identifier = email || num_empleado;

  db.query(query, [identifier], async (err, result) => {
    if (err) {
      console.error("[LOG] Error al buscar el usuario:", err);
      return res.status(500).json({ success: false, message: 'Error en la base de datos' });
    }

    if (result.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    }

    const user = result[0];

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }

    return res.json({ success: true, message: 'Inicio de sesión exitoso', data: user });
  });
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

// Vacaciones
app.post('/vacaciones', async (req, res) => {
  const { num_empleado, fechas, comentarios, datos_json, tipo_movimiento, nivel_aprobacion } = req.body;

  console.log("🟢 [REQ] Solicitud de vacaciones recibida");
  console.log("📨 num_empleado:", num_empleado);
  console.log("📆 fechas:", fechas);
  console.log("📝 comentarios:", comentarios);
  console.log("📦 datos_json:", datos_json);
  console.log("🔢 tipo_movimiento:", tipo_movimiento);
  console.log("🔢 nivel_aprobacion:", nivel_aprobacion);

  if (
    !num_empleado ||
    !Array.isArray(fechas) || fechas.length === 0 ||
    typeof datos_json !== 'object' ||
    typeof tipo_movimiento !== 'string' || tipo_movimiento.trim() === ''
  ) {
    console.warn("❌ [WARN] Datos incompletos o malformados");
    return res.status(400).json({ success: false, message: 'Datos incompletos o incorrectos' });
  }

  try {
    const fechaInicio = fechas[0];
    console.log(`📍 [INFO] Fecha de inicio: ${fechaInicio}`);

    // Paso 1: Insertar movimiento
    const [movimientoResult] = await db.promise().query(
      `INSERT INTO movimientos_personal 
       (num_empleado, tipo_movimiento, fecha_incidencia, datos_json, comentarios)
       VALUES (?, ?, ?, ?, ?)`,
      [
        num_empleado,
        'Vacaciones',
        fechaInicio,
        JSON.stringify(datos_json),
        comentarios
      ]
    );

    const idMovimiento = movimientoResult.insertId;
    console.log(`✅ [LOG] Movimiento creado con ID: ${idMovimiento}`);

    // Paso 2: Obtener empleado
    const empleado = empleadosDb.find(e => e.Personal === num_empleado.toString());

    if (!empleado) {
      console.warn(`⚠️ [WARN] Empleado ${num_empleado} no encontrado en la lista`);
      return res.status(404).json({ success: false, message: 'Empleado no encontrado' });
    }

    // Paso 3: Insertar aprobadores dinámicamente evita el id 64
    let orden = 1;

    for (let i = 1; i <= nivel_aprobacion; i++) {
      const aprobadorKey = `AprobadorNivel${i}`;
      const aprobador = empleado[aprobadorKey];

      if (aprobador) {
        if (parseInt(aprobador) === 64) {
          console.warn(`⛔ Aprobador con ID 64 omitido en el nivel ${i}`);
          continue;
        }

        const token = crypto.randomBytes(24).toString('hex');

        await db.promise().query(
          `INSERT INTO aprobaciones_movimientos (idMovimiento, orden, id_aprobador, token_aprobacion)
       VALUES (?, ?, ?, ?)`,
          [idMovimiento, orden, aprobador, token]
        );

        console.log(`✅ [LOG] Aprobador nivel ${i} (${aprobador}) registrado con token ${token}`);
        orden++;
      } else {
        console.warn(`⚠️ [WARN] Aprobador nivel ${i} no encontrado para el empleado ${num_empleado}`);
      }
    }

    // Paso 4: Enviar notificación al primer aprobador
    const [[primerAprobador]] = await db.promise().query(
      `SELECT a.id_aprobador, a.token_aprobacion, u.email, u.name
       FROM aprobaciones_movimientos a
       JOIN users u ON a.id_aprobador = u.num_empleado
       WHERE a.idMovimiento = ? AND a.orden = 1`,
      [idMovimiento]
    );

    if (primerAprobador && primerAprobador.email) {
      console.log("📧 Enviando correo al primer aprobador:", primerAprobador.email);

      const enlace = `${process.env.API_BASE_URL}/api/aprobaciones/responder?token=${primerAprobador.token_aprobacion}`; // cambia por tu URL real
      const { Nombre, Puesto, Departamento, FechaIngreso, Email } = empleado;
      const htmlDatosSolicitante = datosSolicitanteHtml(Nombre, num_empleado, Puesto, Departamento, FechaIngreso, Email);
      await enviarCorreo(
        primerAprobador.email,
        "Nueva solicitud de vacaciones",
        `
        <div style="font-family: 'Segoe UI', sans-serif; background-color: #f4f4f7; padding: 40px;">
          <style>
            @media only screen and (max-width: 768px) {
              .btn-container {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
              }
              .btn-container a {
                display: block !important;
                width: 80% !important;
                margin: 12px 0 !important;
                text-align: center !important;
              }
            }
          </style>

          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            
            <!-- Encabezado con logo y saludo -->
            <div style="text-align: center;">
              <img src="https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit,fl_lossy,h_300,w_300,f_auto,q_auto/6088316/314367_858588.png" />
              <h2 style="color: #333333;">¡Hola, ${primerAprobador.name}!</h2>
            </div>

            <!-- Mensaje principal -->
            <p style="color: #555555; font-size: 16px; line-height: 1.6;">
              Se ha generado una nueva <strong>solicitud de Vacaciones</strong> que requiere tu revisión y aprobación.
            </p>
            

            ${htmlDatosSolicitante}
            
            <p style="color: #555555; font-size: 16px; line-height: 1.6;">
              <strong>Comentarios:</strong> ${comentarios || "Ninguno"}
            </p>
            <p style="color: #555555; font-size: 16px;">
              Por favor, elige una de las siguientes opciones para proceder:
            </p>
            <!-- Botones de acción -->
            <div class="btn-container" style="text-align: center; margin: 30px 0;">
              <a href="${enlace}&accion=aprobado"
                style="background-color: #28a745; color: white; padding: 10px 16px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 8px;">
                ✅ Aprobar
              </a>
              <a href="${enlace}&accion=rechazado"
                style="background-color: #dc3545; color: white; padding: 10px 16px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 8px;">
                ❌ Rechazar
              </a>
            </div>

            <!-- Nota informativa -->
            <p style="color: #777777; font-size: 14px; line-height: 1.5;">
              Este mensaje ha sido enviado automáticamente por el sistema de recursos humanos de <strong>Grupo Tarahumara</strong>.
              Si no estás involucrado en esta solicitud, puedes ignorar este correo.
            </p>

            <!-- Línea divisoria -->
            <hr style="margin: 40px 0; border: none; border-top: 1px solid #eeeeee;" />

            <!-- Pie de página -->
            <p style="color: #999999; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} Grupo Tarahumara · Sistema de Recursos Humanos<br />
              Este mensaje es confidencial y para uso exclusivo del destinatario.
            </p>
          </div>
        </div>

        `
      );
    } else {
      console.warn("⚠️ Primer aprobador no tiene correo asociado.");
    }

    res.status(201).json({
      success: true,
      message: 'Solicitud de vacaciones registrada',
      idMovimiento,
    });
  } catch (error) {
    console.error('🔥 [ERROR] Al registrar vacaciones:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

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

let datosSolicitante = null;
function procesarAprobacion(idAprobacion, estatus, nota) {

  return new Promise((resolve, reject) => {
    db.beginTransaction((err) => {
      if (err) {
        console.error('❌ Error iniciando transacción:', err);
        return reject(err);
      }

      console.log(`🔄 Procesando aprobación ID ${idAprobacion} con estatus ${estatus} y nota ${nota} `);

      db.query(
        `UPDATE aprobaciones_movimientos
         SET estatus = ?, nota = ?, fecha_aprobacion = NOW()
         WHERE idAprobacion = ?`,
        [estatus, nota, idAprobacion],
        (err) => {
          if (err) {
            console.error('❌ Error actualizando aprobación:', err);
            return db.rollback(() => reject(err));
          }

          db.query(
            `SELECT idMovimiento, orden, id_aprobador
             FROM aprobaciones_movimientos
             WHERE idAprobacion = ?`,
            [idAprobacion],
            (err, result) => {
              if (err) {
                console.error('❌ Error obteniendo aprobación:', err);
                return db.rollback(() => reject(err));
              }

              const aprobacion = result[0];
              const movimientoId = aprobacion.idMovimiento;
              if (estatus === "rechazado") {
                console.log("🚫 Rechazando movimiento...");

                // Obtener datos del solicitante ANTES del commit
                db.query(
                  `SELECT m.num_empleado, u.email, u.name, datos_json, tipo_movimiento, nota
                   FROM movimientos_personal m
                   JOIN users u ON m.num_empleado = u.num_empleado
                   WHERE m.idMovimiento = ?`,
                  [movimientoId],
                  (err, [solicitante]) => {
                    if (!err && solicitante) datosSolicitante = solicitante; // guardamos para después

                    db.query(
                      `UPDATE movimientos_personal
                       SET estatus = 'rechazado', rechazado_por = ?, nota = ?
                       WHERE idMovimiento = ?`,
                      [aprobacion.id_aprobador, nota, movimientoId],
                      (err) => {
                        if (err) return db.rollback(() => reject(err));
                        // NUEVO: Cancelar otras aprobaciones pendientes
                        db.query(
                          `UPDATE aprobaciones_movimientos
                          SET estatus = 'cancelado'
                          WHERE idMovimiento = ? AND estatus = 'pendiente' AND idAprobacion != ?`,
                          [movimientoId, idAprobacion],
                          (err) => {
                            if (err) return db.rollback(() => reject(err));
                            db.commit(async (err) => {
                              if (err) return db.rollback(() => reject(err));
                              console.log('✅ Movimiento rechazado y transacción finalizada');

                              // Enviamos el correo después del commit
                              if (datosSolicitante) {
                                try {
                                  await enviarCorreo(
                                    datosSolicitante.email,
                                    "❌ Movimiento de personal rechazado",
                                    `
                                    <div style="font-family: 'Segoe UI', sans-serif; background-color: #f4f4f7; padding: 40px;">
                                      <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                                        <h2 style="color: #dc3545; text-align: center;">❌ Movimiento rechazado</h2>
                                        <p>Hola <strong>${datosSolicitante.name}</strong>,</p>
                                        <p>Lamentamos informarte que tu solicitud de <strong>${solicitante?.tipo_movimiento || "movimiento"}</strong> fue <strong>rechazada</strong> por el aprobador <strong>${aprobacion.id_aprobador}</strong>.</p>
                                        <p><strong>Motivo del rechazo:</strong></p>
                                        <blockquote style="background: #fbeaea; padding: 12px; border-left: 4px solid #dc3545; border-radius: 8px; font-style: italic; color: #a94442;">
                                          ${datosSolicitante.nota || "No se especificó un motivo"}
                                        </blockquote>
                                        <p style="margin-top: 16px;">Por favor, contacta a tu supervisor o recursos humanos si tienes dudas o deseas más información.</p>
                                        <p style="font-size: 13px; color: #999;">Este mensaje fue generado automáticamente por el sistema de recursos humanos de Grupo Tarahumara.</p>
                                      </div>
                                    </div>
                                    `
                                  );
                                  console.log("📧 Notificación enviada al solicitante por rechazo.");
                                } catch (error) {
                                  console.error("❌ Error enviando notificación de rechazo:", error);
                                }
                              }

                              resolve();
                            });
                          }
                        );
                      }
                    );
                  }
                );
              }
              else {
                console.log("✅ Aprobación parcial, buscando siguientes aprobadores...");

                db.query(
                  `SELECT COUNT(*) AS total
                   FROM aprobaciones_movimientos
                   WHERE idMovimiento = ? AND estatus = 'pendiente'`,
                  [movimientoId],
                  (err, result) => {
                    if (err) {
                      console.error('❌ Error contando pendientes:', err);
                      return db.rollback(() => reject(err));
                    }

                    const pendientes = result[0].total;

                    if (pendientes === 0) {
                      console.log("🎉 Todos aprobaron. Finalizando movimiento para ID:", movimientoId);

                      db.query(
                        `UPDATE movimientos_personal SET estatus = 'aprobado', nota = ? WHERE idMovimiento = ?`,
                        [nota, movimientoId],
                        (err) => {
                          if (err) {
                            console.error("❌ Error actualizando estatus de movimiento:", err);
                            return db.rollback(() => reject(err));
                          }

                          console.log("✅ Estatus actualizado a 'aprobado' en movimientos_personal");

                          db.query(
                            `SELECT m.num_empleado, u.email, u.name, datos_json, tipo_movimiento, nota
         FROM movimientos_personal m
         JOIN users u ON m.num_empleado = u.num_empleado
         WHERE m.idMovimiento = ?`,
                            [movimientoId],
                            (err, [solicitante]) => {
                              if (err || !solicitante) {
                                console.warn("⚠️ No se pudo obtener info del solicitante. Error:", err, "Resultado:", solicitante);
                                return db.commit((err) => {
                                  if (err) return db.rollback(() => reject(err));
                                  resolve(); // terminamos aunque no haya correo
                                });
                              }

                              console.log("📥 Solicitante encontrado:", solicitante);

                              let datos;
                              try {
                                datos = typeof solicitante.datos_json === "string" ? JSON.parse(solicitante.datos_json) : solicitante.datos_json;
                              } catch (parseErr) {
                                console.error("❌ Error parseando datos_json:", parseErr, "Valor original:", solicitante.datos_json);
                                return db.commit((err) => {
                                  if (err) return db.rollback(() => reject(err));
                                  resolve(); // continuamos aunque no se pueda parsear
                                });
                              }

                              console.log("📊 Datos del movimiento:", datos);
                              console.log("📌 Tipo de movimiento:", solicitante.tipo_movimiento);

                              if (solicitante.tipo_movimiento?.toLowerCase() === "vacaciones") {
                                console.log("🔄 Tipo de movimiento es vacaciones, iniciando actualización...");

                                const acumuladas = datos.vacaciones_acumuladas_restantes;
                                const ley = datos.vacaciones_ley_restantes;

                                if (typeof acumuladas !== "number" || typeof ley !== "number") {
                                  console.warn("⚠️ Los datos de vacaciones no son válidos:", { acumuladas, ley });
                                } else {
                                  console.log(`📤 Llamando a updateVacaciones con numEmpleado=${solicitante.num_empleado}, acumuladas=${acumuladas}, ley=${ley}`);

                                  updateVacaciones(solicitante.num_empleado, acumuladas, ley)
                                    .then((exito) => {
                                      if (exito) {
                                        console.log("✅ Vacaciones actualizadas correctamente en SQL Server");
                                      } else {
                                        console.warn("⚠️ La actualización de vacaciones no afectó filas o falló silenciosamente");
                                      }
                                    })
                                    .catch((updateErr) => {
                                      console.error("❌ Error ejecutando updateVacaciones:", updateErr);
                                    });
                                }
                              } else {
                                console.log("ℹ️ Tipo de movimiento no es vacaciones. No se actualizan días.");
                              }

                              db.commit(async (err) => {
                                if (err) {
                                  console.error("❌ Error en commit final:", err);
                                  return db.rollback(() => reject(err));
                                }
                                console.log('✅ Movimiento aprobado y transacción finalizada');
                                const datosFiltrados = Object.fromEntries(
                                  Object.entries(datos).filter(([_, valor]) => valor && valor.trim() !== "")
                                );
                                try {

                                  await enviarCorreo(
                                    solicitante.email,
                                    "✅ Movimiento de personal aprobado",
                                    `
  <div style="font-family: 'Segoe UI', sans-serif; background-color: #f4f4f7; padding: 40px;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
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
      <p style="color: #555;">Gracias por utilizar el sistema de recursos humanos de Grupo Tarahumara.</p>
      <p style="font-size: 13px; color: #999;">Este mensaje es automático. No respondas directamente.</p>
    </div>
  </div>
  `
                                  );
                                  console.log("📧 Correo enviado al solicitante.");
                                } catch (err) {
                                  console.error("❌ Error enviando correo de aprobación:", err);
                                }

                                resolve();
                              });
                            }
                          );
                        }
                      );
                    } else {
                      console.log("🔎 Hay pendientes, notificando siguiente aprobador...");

                      db.query(
                        `SELECT a.id_aprobador, u.email, a.token_aprobacion, u.name
                          FROM aprobaciones_movimientos a
                          JOIN users u ON a.id_aprobador = u.num_empleado
                          WHERE a.idMovimiento = ? AND a.estatus = 'pendiente' AND a.id_aprobador != 64
                            AND NOT EXISTS (
                              SELECT 1 FROM aprobaciones_movimientos ap
                              WHERE ap.idMovimiento = a.idMovimiento
                                AND ap.orden < a.orden
                                AND ap.estatus != 'aprobado'
                            )
                          ORDER BY a.orden
                          LIMIT 1`,
                        [movimientoId],
                        async (err, result) => {
                          if (err) {
                            console.error('❌ Error buscando siguiente aprobador:', err);
                            return db.rollback(() => reject(err));
                          }

                          if (result.length > 0) {
                            const { email, token_aprobacion, name } = result[0];
                            console.log("📧 Enviando correo a siguiente aprobador:", email);

                            // Obtener datos adicionales del movimiento
                            db.query(
                              `SELECT tipo_movimiento, datos_json, comentarios
                               FROM movimientos_personal
                               WHERE idMovimiento = ?`,
                              [movimientoId],
                              async (err, [mov]) => {
                                if (err) {
                                  console.error("❌ Error obteniendo datos del movimiento:", err);
                                  return db.rollback(() => reject(err));
                                }

                                const { tipo_movimiento, datos_json, comentarios } = mov;
                                const datos = typeof datos_json === "string" ? JSON.parse(datos_json) : datos_json;
                                const htmlExtra = renderDatosHtml(tipo_movimiento, datos);
                                const { Nombre, Puesto, Departamento, FechaIngreso, Email } = empleado;
                                const htmlDatosSolicitante = datosSolicitanteHtml(Nombre, num_empleado, Puesto, Departamento, FechaIngreso, Email);

                                const enlace = `${process.env.API_BASE_URL}/api/aprobaciones/responder?token=${token_aprobacion}`;

                                try {
                                  await enviarCorreo(
                                    email,
                                    "Nueva solicitud de movimiento de personal",
                                    `
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
                                    
                                    ${htmlDatosSolicitante}
                                  </p>

                                  <div style="margin-top: 16px; font-size: 15px; color: #333;">
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
                                    `
                                  );
                                } catch (correoError) {
                                  console.error("❌ Error enviando correo:", correoError);
                                  return db.rollback(() => reject(correoError));
                                }

                                db.commit((err) => {
                                  if (err) {
                                    console.error('❌ Error en commit final:', err);
                                    return db.rollback(() => reject(err));
                                  }
                                  console.log('✅ Movimiento parcialmente aprobado, correo enviado, transacción finalizada');
                                  resolve();
                                });
                              }
                            );
                          }
                        }
                      );
                    }
                  }
                );
              }
            }
          );
        }
      );
    });
  });
}

// Crear movimiento
app.post("/api/movimientos", (req, res) => {
  console.log("📥 Solicitud recibida en /api/movimientos");
  console.log("📄 Body recibido:", req.body);

  const { num_empleado, tipo_movimiento, fecha_incidencia, datos_json, comentarios, nivel_aprobacion } = req.body;
  function iniciarTransaccion() {
    db.beginTransaction((err) => {
      if (err) {
        console.error("❌ Error iniciando transacción:", err);
        return res.status(500).json({ success: false, message: "Error iniciando transacción" });
      }

      console.log("🔄 Transacción iniciada");

      // 1. Insertar movimiento
      const insertMovimientoQuery = `
      INSERT INTO movimientos_personal (num_empleado, tipo_movimiento, fecha_incidencia, datos_json, comentarios, estatus, nivel_aprobacion)
      VALUES (?, ?, ?, ?, ?, 'pendiente', ?)
    `;

      db.query(
        insertMovimientoQuery,
        [num_empleado, tipo_movimiento, fecha_incidencia, JSON.stringify(datos_json), comentarios, nivel_aprobacion],
        (err, result) => {
          if (err) {
            console.error("❌ Error insertando movimiento:", err);
            return db.rollback(() => {
              res.status(500).json({ success: false, message: "Error insertando movimiento" });
            });
          }

          const idMovimiento = result.insertId;
          console.log("✅ Movimiento insertado con ID:", idMovimiento);

          // 2. Buscar información del empleado
          const empleado = empleadosDb.find(emp => emp.Personal === num_empleado.toString().padStart(4, '0'));

          if (!empleado) {
            console.error(`❌ Empleado ${num_empleado} no encontrado en empleadosDb`);
            return db.rollback(() => {
              res.status(404).json({ success: false, message: "Empleado no encontrado en base externa" });
            });
          }

          console.log("👤 Empleado encontrado:", empleado);

          // 3. Insertar aprobadores
          const aprobadores = [];
          let orden = 1;

          for (let nivel = 1; nivel <= nivel_aprobacion; nivel++) {
            const aprobadorId = empleado[`AprobadorNivel${nivel}`];

            if (!aprobadorId) {
              console.warn(`⚠️ No se encontró aprobador para nivel ${nivel}`);
              continue;
            }

            if (parseInt(aprobadorId) === 64) {
              console.warn(`⛔ Aprobador con ID 64 omitido del nivel ${nivel}`);
              continue;
            }

            const token = crypto.randomBytes(32).toString('hex');
            aprobadores.push([idMovimiento, orden++, aprobadorId, 'pendiente', token]);
            console.log(`➕ Aprobador nivel ${nivel} agregado:`, aprobadorId);
          }

          if (aprobadores.length > 0) {
            const insertAprobadoresQuery = `
            INSERT INTO aprobaciones_movimientos (idMovimiento, orden, id_aprobador, estatus, token_aprobacion)
            VALUES ?
          `;

            db.query(insertAprobadoresQuery, [aprobadores], (err) => {
              if (err) {
                console.error("❌ Error insertando aprobadores:", err);
                return db.rollback(() => {
                  res.status(500).json({ success: false, message: "Error insertando aprobadores" });
                });
              }

              // Finalizar la transacción exitosamente
              db.commit((err) => {
                if (err) {
                  console.error("❌ Error en commit:", err);
                  return db.rollback(() => {
                    res.status(500).json({ success: false, message: "Error al guardar movimiento" });
                  });
                }

                console.log("✅ Transacción completada correctamente");
                res.json({ success: true, idMovimiento });

                // Aquí es donde DEBES enviar el correo al primer aprobador
                db.query(
                  `SELECT a.id_aprobador, u.email, a.token_aprobacion, u.name
FROM aprobaciones_movimientos a
JOIN users u ON a.id_aprobador = u.num_empleado
WHERE a.idMovimiento = ? AND a.orden = 1 AND a.id_aprobador != 64`,
                  [idMovimiento],
                  async (err, result) => {
                    if (err) {
                      console.error('❌ Error obteniendo primer aprobador:', err);
                      return;
                    }

                    if (result.length > 0) {
                      const { email, token_aprobacion, name } = result[0];
                      const enlace = `${process.env.API_BASE_URL}/api/aprobaciones/responder?token=${token_aprobacion}`;

                      db.query(
                        `SELECT tipo_movimiento, datos_json, comentarios
                       FROM movimientos_personal
                       WHERE idMovimiento = ?`,
                        [idMovimiento],
                        async (err, [mov]) => {
                          if (err) {
                            console.error("❌ Error obteniendo datos del movimiento:", err);
                            return;
                          }

                          const { tipo_movimiento, datos_json, comentarios } = mov;
                          const datos = typeof datos_json === "string" ? JSON.parse(datos_json) : datos_json;
                          const htmlExtra = renderDatosHtml(tipo_movimiento, datos);
                          const { Nombre, Puesto, Departamento, FechaIngreso, Email } = empleado;
                          const htmlDatosSolicitante = datosSolicitanteHtml(Nombre, num_empleado, Puesto, Departamento, FechaIngreso, Email);

                          try {
                            await enviarCorreo(
                              email,
                              "Nueva solicitud de movimiento de personal",
                              `
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

                                  Fecha de incidencia: <strong>${fecha_incidencia}</strong>

                                 ${htmlDatosSolicitante}

                                  <div style="margin-top: 16px; font-size: 15px; color: #333;">
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
                            `
                            );
                            console.log("📧 Correo enviado al primer aprobador:", email);
                          } catch (correoError) {
                            console.error("❌ Error enviando correo al primer aprobador:", correoError);
                          }
                        }
                      );
                    }
                  }
                );
              });
            });
          } else {
            console.warn("⚠️ No se encontraron aprobadores para insertar.");
            db.commit((err) => {
              if (err) {
                console.error("❌ Error en commit:", err);
                return db.rollback(() => {
                  res.status(500).json({ success: false, message: "Error al guardar movimiento" });
                });
              }
              res.json({ success: true, idMovimiento });
            });
          }
        },
      );
    });
  };
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

  const query = `
    SELECT * FROM movimientos_personal mp
    WHERE mp.num_empleado = ?
      AND (
        mp.tipo_movimiento = 'Sustitución'
        OR mp.tipo_movimiento = 'Nueva Posición'
        OR mp.tipo_movimiento = 'Aumento Plantilla'
      )
    ORDER BY mp.fecha_solicitud DESC
  `;

  db.query(query, [num_empleado], (err, rows) => {
    if (err) {
      console.error('Error al obtener movimientos:', err);
      return res.status(500).json({ error: 'Error al obtener movimientos' });
    }

    res.json({ data: rows });
  });
});

app.get('/api/movimientos', (req, res) => {
  const query = `
    SELECT 
      mp.idMovimiento,
      mp.num_empleado,
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
        await procesarAprobacion(aprobacion.idAprobacion, accion, "[Respuesta vía correo]");

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
        <div class="footer">Tarahumara GPT • ${new Date().getFullYear()}</div>
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

      if (tipo.toLowerCase() !== "vacaciones") {
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
app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
