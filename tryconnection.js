import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { enviarCorreo } from './emailService.js'; 
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

// 👇 Forma correcta de obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// 🖼️ Servir archivos estáticos desde la carpeta /public
app.use(express.static(path.join(__dirname, 'public')));
//dates to do a connection

const returnConnection=() =>{

   return mysql.createConnection({
      host: '192.168.29.40',
      user: 'root',
      password: 'C0L1s3um.t4r4',
      database: 'site',
      port: '3010'  
});
}

var db =returnConnection()

db.on('error', (err) => {
  console.error('Error con la base de datos:', err);
 
  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNREFUSED') {
    console.log('Conexión perdida, intentando reconectar...');
    db =returnConnection(); // Reconectar
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

// course assigned , completed  
app.use(cors());

app.get('/cursospresenciales', (req, res) => {
  const query=`SELECT * FROM cursos_presenciales where status="true";`;
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send('Error fetching data');
      return;
    }
    res.json(results);
  });
});


app.get('/cursostomados', (req, res) => {
  const query=`SELECT * FROM cursos_presenciales inner join usuario_curso on usuario_curso.id_course= cursos_presenciales.id_course;`;
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send('Error fetching data');
      return;
    }
    res.json(results);
  });
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

app.post('/agregarUsuario', (req, res) => {
  
  var { name, email, password, num_empleado } = req.body;
  password = bcrypt.hashSync(password, 10);

  // Verifica si los datos se están recibiendo correctamente
  console.log("Datos recibidos:", req.body);
 
  const query = `INSERT INTO users (name, email, password, status, num_empleado)
                 VALUES ('${name}', '${email}', '${password}', 'Activo', '${num_empleado}')`;
 
  try {
    db.query(query, (err, result) => {
      if (err) {
        console.error("Error al insertar el usuario:", err);
        res.status(500).send('Error en la base de datos');
      } else {
        res.json(result); // Devuelve el resultado si la inserción fue exitosa
      }
    });
  } catch (e) {
    console.error("Error en el servidor:", e);
    res.status(500).send('Error en el servidor');
  }
} );

app.get('/usuarios', (req, res) => {
  const query = `SELECT * FROM users`;
 
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send('Error fetching data');
      return;
    }
    res.json(results);
  });
});

app.put('/actualizarUsuario', (req, res) => {
  var { id, name, email, password, num_empleado } = req.body;
  let query; // Declarar la variable antes de los bloques if

  if (password) {
    password = bcrypt.hashSync(password, 10);
    query = `UPDATE users SET name = '${name}', email = '${email}', password = '${password}', num_empleado = '${num_empleado}' WHERE id = ${id}`;
  } else {
    query = `UPDATE users SET name = '${name}', email = '${email}', num_empleado = '${num_empleado}' WHERE id = ${id}`;
  }
  
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

app.post('/eliminarUsuario', (req, res) => {
  const { id } = req.body;
 
  const query = `UPDATE users
                 SET status = 'Inactivo'
                 WHERE id = ${id}`;

  db.query(query, (err, result) => {
    if (err) {
      console.error("Error al eliminar el usuario:", err);
      res.status(500).send('Error en la base de datos');
    } else {
      res.json(result);
    }
  }
  );
}
);

app.post('/actualizarCurso', (req, res) => {
  const { id_course,title, description, tutor, progress} = req.body;

  console.log(req.body)
  const query = `UPDATE cursos_presenciales SET title= '${title}', description = '${description}',tutor= '${tutor}' WHERE id_course= ${id_course}`;

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
    const { title, description, tutor } = req.body;

    if (!title || !tutor) {
      return res.status(400).json({ error: 'Datos incompletos' });
     }

    console.log("Datos recibidos:", req.body);

    const query = `INSERT INTO cursos_presenciales (title, description, tutor, status) VALUES (?, ?, ?, 'true')`;

    const [result] = await db.promise().query(query, [title, description, tutor]);

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
  const identifier = email || num_empleado;

  console.log(`[LOG] Solicitud de inicio de sesión recibida: ${identifier}`);

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Correo o número de empleado y contraseña son requeridos' });
  }

  try {
    const query = `SELECT * FROM users WHERE email = ? OR num_empleado = ?`;

    db.query(query, [identifier, identifier], async (err, result) => {
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
  } catch (e) {
    console.error('[LOG] Error en el servidor:', e);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
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

app.post("/eliminarCurso", (req,res)=>{


  const {id_course}=req.body;

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
    console.log(results);       
  });
});

app.post('/agregarConvenio', (req, res) => {
  const { titulo, descripcion, img, link } = req.body;

  console.log("Datos recibidos:", req.body);

  const query = `INSERT INTO convenios (titulo, descripcion, img, link)
                 VALUES (?, ?, ?, ?)`;

  const values = [titulo, descripcion, img, link];

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
  const { idConvenio, titulo, descripcion, img, link} = req.body;

  const query = `UPDATE convenios
                 SET titulo = ?, descripcion = ?, img = ?, link = ?
                 WHERE idConvenio = ?`;
  
  const values = [titulo, descripcion, img, link, idConvenio];

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

// Vacaciones
app.post('/vacaciones', async (req, res) => {
  const { num_empleado, fechas, comentarios, datos_json, tipo_movimiento } = req.body;

  console.log("🟢 [REQ] Solicitud de vacaciones recibida");
  console.log("📨 num_empleado:", num_empleado);
  console.log("📆 fechas:", fechas);
  console.log("📝 comentarios:", comentarios);
  console.log("📦 datos_json:", datos_json);
  console.log("🔢 tipo_movimiento (niveles aprobación):", tipo_movimiento);

  if (
    !num_empleado ||
    !Array.isArray(fechas) || fechas.length === 0 ||
    typeof datos_json !== 'object' ||
    typeof tipo_movimiento !== 'number' ||
    tipo_movimiento < 1 || tipo_movimiento > 5
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

    // Paso 3: Insertar aprobadores dinámicamente
    for (let i = 1; i <= tipo_movimiento; i++) {
      const aprobadorKey = `AprobadorNivel${i}`;
      const aprobador = empleado[aprobadorKey];
    
      if (aprobador) {
        const token = crypto.randomBytes(24).toString('hex');
    
        await db.promise().query(
          `INSERT INTO aprobaciones_movimientos (idMovimiento, orden, id_aprobador, token_aprobacion)
           VALUES (?, ?, ?, ?)`,
          [idMovimiento, i, aprobador, token]
        );
    
        console.log(`✅ [LOG] Aprobador nivel ${i} (${aprobador}) registrado con token ${token}`);
      }
      else {
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
    
      const enlace = `http://api-cursos.192.168.29.40.sslip.io/api/aprobaciones/responder?token=${primerAprobador.token_aprobacion}`; // cambia por tu URL real
    
      await enviarCorreo(
        primerAprobador.email,
        "Nueva solicitud de vacaciones",
        `
         <div style="font-family: 'Segoe UI', sans-serif; background-color: #f4f4f7; padding: 40px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            
            <!-- Encabezado con logo y saludo -->
            <div style="text-align: center;">
              <img src="https://drive.google.com/uc?export=view&id=1V-r6CDerFoilWIRxwWcwTmjV6BJOexvS" />
              <h2 style="color: #333333;">¡Hola, ${primerAprobador.name}!</h2>
            </div>

            <!-- Mensaje principal -->
            <p style="color: #555555; font-size: 16px; line-height: 1.6;">
              Se ha generado una nueva <strong>solicitud de movimiento de personal</strong> que requiere tu revisión y aprobación.
            </p>
            <p style="color: #555555; font-size: 16px;">
              Por favor, elige una de las siguientes opciones para proceder:
            </p>

            <!-- Botones de acción -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${enlace}&accion=aprobado"
                style="background-color: #28a745; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin-right: 12px;">
                ✅ Aprobar
              </a>
              <a href="${enlace}&accion=rechazado"
                style="background-color: #dc3545; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
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

const empleadosDb = await fetch('http://api-site-intelisis.192.168.29.40.sslip.io/api/movpersonal', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
}).then(response => response.json()).catch(err => {
  console.error('Error al obtener empleados:', err);
  return null;
}
);

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


function procesarAprobacion(idAprobacion, estatus, nota = null) {
  return new Promise((resolve, reject) => {
    db.beginTransaction((err) => {
      if (err) {
        console.error('❌ Error iniciando transacción:', err);
        return reject(err);
      }

      console.log(`🔄 Procesando aprobación ID ${idAprobacion} con estatus ${estatus}`);

      // 1. Actualizar la aprobación
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

          // 2. Obtener datos del movimiento
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

                db.query(
                  `UPDATE movimientos_personal
                   SET estatus = 'rechazado', rechazado_por = ?, nota_rechazo = ?
                   WHERE idMovimiento = ?`,
                  [aprobacion.id_aprobador, nota, movimientoId],
                  (err) => {
                    if (err) {
                      console.error('❌ Error rechazando movimiento:', err);
                      return db.rollback(() => reject(err));
                    }

                    db.commit((err) => {
                      if (err) {
                        console.error('❌ Error en commit:', err);
                        return db.rollback(() => reject(err));
                      }
                      console.log('✅ Movimiento rechazado y transacción finalizada');
                      resolve();
                    });
                  }
                );

              } else {
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
                      console.log("🎉 Todos aprobaron. Finalizando movimiento.");

                      db.query(
                        `UPDATE movimientos_personal
                         SET estatus = 'aprobado'
                         WHERE idMovimiento = ?`,
                        [movimientoId],
                        (err) => {
                          if (err) {
                            console.error('❌ Error actualizando movimiento aprobado:', err);
                            return db.rollback(() => reject(err));
                          }

                          db.commit((err) => {
                            if (err) {
                              console.error('❌ Error en commit:', err);
                              return db.rollback(() => reject(err));
                            }
                            console.log('✅ Movimiento aprobado y transacción finalizada');
                            resolve();
                          });
                        }
                      );

                    } else {
                      console.log("🔎 Hay pendientes, notificando siguiente aprobador...");

                      db.query(
                        `SELECT a.id_aprobador, u.email, a.token_aprobacion, u.name
                         FROM aprobaciones_movimientos a
                         JOIN users u ON a.id_aprobador = u.num_empleado
                         WHERE a.idMovimiento = ? AND a.estatus = 'pendiente'
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

                            const enlace = `http://api-cursos.192.168.29.40.sslip.io/api/aprobaciones/responder?token=${token_aprobacion}`;

                            try {
                              await enviarCorreo(
                                email,
                                "Nueva solicitud de movimiento de personal",
                                `
                                 <div style="font-family: 'Segoe UI', sans-serif; background-color: #f4f4f7; padding: 40px;">
                                  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                                    <div style="text-align: center;">
                                      <img src="https://drive.google.com/uc?export=view&id=1V-r6CDerFoilWIRxwWcwTmjV6BJOexvS" />
                                      <h2 style="color: #333333;">¡Hola, ${name}!</h2>
                                    </div>
                                    <p style="color: #555555; font-size: 16px; line-height: 1.6;">
                                      Se ha generado una nueva <strong>solicitud de movimiento de personal</strong> que requiere tu revisión y aprobación.
                                    </p>
                                    <div style="text-align: center; margin: 30px 0;">
                                      <a href="${enlace}&accion=aprobado"
                                        style="background-color: #28a745; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin-right: 12px;">
                                        ✅ Aprobar
                                      </a>
                                      <a href="${enlace}&accion=rechazado"
                                        style="background-color: #dc3545; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
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
      );
    });
  });
}

// Crear movimiento
app.post("/api/movimientos", (req, res) => {
  console.log("📥 Solicitud recibida en /api/movimientos");
  console.log("📄 Body recibido:", req.body);

  const { num_empleado, tipo_movimiento, fecha_incidencia, datos_json, comentarios, nivel_aprobacion } = req.body;

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
        for (let nivel = 1; nivel <= nivel_aprobacion; nivel++) {
          const aprobadorId = empleado[`AprobadorNivel${nivel}`];
          if (aprobadorId) {
            const token = crypto.randomBytes(32).toString('hex');
            aprobadores.push([idMovimiento, nivel, aprobadorId, 'pendiente', token]);
            console.log(`➕ Aprobador nivel ${nivel} agregado:`, aprobadorId);
          } else {
            console.warn(`⚠️ No se encontró aprobador para nivel ${nivel}`);
          }
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
            });
          });

        } else {
          console.warn("⚠️ No se insertaron aprobadores porque no había");
          // Si no hay aprobadores, finalizar la transacción igual
          db.commit((err) => {
            if (err) {
              console.error("❌ Error en commit:", err);
              return db.rollback(() => {
                res.status(500).json({ success: false, message: "Error al guardar movimiento" });
              });
            }

            console.log("✅ Transacción completada correctamente (sin aprobadores)");
            res.json({ success: true, idMovimiento });
          });
        }
      }
    );
  });
});

// Express
app.get('/api/movimientos/mios/:num_empleado', (req, res) => {
  const { num_empleado } = req.params;

  const query = `
    SELECT 
      mp.idMovimiento,
      mp.tipo_movimiento,
      mp.fecha_incidencia,
      mp.estatus AS estatus_movimiento,
      mp.fecha_solicitud,
      mp.nivel_aprobacion,
      (
        SELECT GROUP_CONCAT(CONCAT_WS(' - ', am.orden, am.estatus) ORDER BY am.orden ASC)
        FROM aprobaciones_movimientos am
        WHERE am.idMovimiento = mp.idMovimiento
      ) AS historial_aprobaciones
    FROM movimientos_personal mp
    WHERE mp.num_empleado = ?
    ORDER BY mp.fecha_solicitud DESC
  `;

  db.query(query, [num_empleado], (err, rows) => {
    if (err) {
      console.error('Error al obtener movimientos:', err);
      return res.status(500).json({ error: 'Error al obtener movimientos' });
    }

    res.json({ data: rows }); // 👈 Te lo regreso limpio
  });
});

// Obtener movimientos pendientes por aprobador
app.get("/api/aprobaciones/pendientes/:idAprobador", (req, res) => {
  const { idAprobador } = req.params;

  const query = `SELECT am.idAprobacion, mp.idMovimiento, mp.tipo_movimiento, mp.fecha_incidencia, mp.datos_json, mp.comentarios
                 FROM aprobaciones_movimientos am
                 JOIN movimientos_personal mp ON am.idMovimiento = mp.idMovimiento
                 WHERE am.id_aprobador = ? AND am.estatus = 'pendiente'`;

  db.query(query, [idAprobador], (err, rows) => {
    if (err) {
      console.error("❌ Error obteniendo movimientos pendientes:", err);
      return res.status(500).json({ success: false, message: "Error al obtener movimientos" });
    }

    res.json({ success: true, movimientos: rows });
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

  db.query(`SELECT idAprobacion FROM aprobaciones_movimientos WHERE token_aprobacion = ?`, [token], async (err, rows) => {
    if (err) {
      console.error("❌ Error al buscar token:", err);
      return res.status(500).send("Error interno del servidor.");
    }

    if (!rows || rows.length === 0) {
      return res.status(404).send("Token inválido o expirado.");
    }

    const aprobacion = rows[0];

    try {
      await procesarAprobacion(aprobacion.idAprobacion, accion, "[Respuesta vía correo]");
      res.send("✅ Tu respuesta ha sido registrada correctamente. ¡Gracias!");
    } catch (error) {
      console.error("❌ Error al procesar respuesta por token:", error);
      res.status(500).send("Error interno del servidor.");
    }
  });
});

//open port 
app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
