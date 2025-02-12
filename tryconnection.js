const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const port = 3001;
const bcrypt = require('bcrypt');
app.use(express.json())

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
  
  var { name, email, password } = req.body;
  password = bcrypt.hashSync(password, 10);

 
  // Verifica si los datos se están recibiendo correctamente
  console.log("Datos recibidos:", req.body);
 
  const query = `INSERT INTO users (name, email, password)
                 VALUES ('${name}', '${email}', '${password}')`;
 
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
  var { id, name, email, password } = req.body;
  password = bcrypt.hashSync(password, 10);
 
  const query = `UPDATE users
                 SET name = '${name}', email = '${email}', password = '${password}'
                 WHERE id = ${id}`;
 
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

app.post('/actualizarCurso', (req, res) => {
  const { id_course,title, description, tutor, start_date, end_date, progress} = req.body;

  console.log(req.body)
  const query = `UPDATE cursos_presenciales SET title= '${title}', description = '${description}',tutor= '${tutor}',start_date= '${start_date}',end_date= '${end_date}' WHERE id_course= ${id_course}`;

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

app.post('/agregarCurso', (req, res) => {
  
  const { title, description, tutor,start_date ,end_date, progress} = req.body;
 
  // Verifica si los datos se están recibiendo correctamente
  console.log("Datos recibidos:", req.body);
 
  const query = `INSERT INTO cursos_presenciales (title, description, tutor,start_date,end_date,status)
                 VALUES ('${title}', '${description}', '${tutor}','${start_date} ','${end_date} ',"true")`;
 
  try {
    db.query(query, (err, result) => {
      if (err) {
        console.error("Error al insertar el curso:", err);
        res.status(500).send('Error en la base de datos');
      } else {
        res.json(result); // Devuelve el resultado si la inserción fue exitosa
      }
    });
  } catch (e) {
    console.error("Error en el servidor:", e);
    res.status(500).send('Error en el servidor');
  }
});

app.post('/agregarCursoTomado',(req,res)=>{

  const { id_usuario,id_course } = req.body;
 

  console.log("Datos recibidos:", req.body);
 
  const query = `INSERT INTO usuario_curso (id_usuario, id_course) VALUES ('${id_usuario} ','${id_course} ')`;
  try{
  db.query(query, (err, result) => {
    if (err) {
      console.error("Error al insertar el curso:", err);
      res.status(500).send('Error en la base de datos');
    } else {
      console.log("Curso agregado con éxito:", result);
      res.json(result);
    }
  });
  }catch(e){

    console.log(e)
  }
})

app.post('/updateCargaMasiva', async (req, res) => {
  const datosExcel = req.body; // Aquí recibimos el objeto JSON con los datos
  console.log("Datos recibidos:", datosExcel);

  // Verificar que los datos existan y sean válidos
  if (!Array.isArray(datosExcel) || datosExcel.length === 0) {
    return res.status(400).json({ success: false, message: 'Datos inválidos o vacíos' });
  }

  // Desestructuración del primer curso para insertar en la tabla `cursos_presenciales`
  const { id_usuario, curso, tutor, fecha, end_date, departamento, progress } = datosExcel[0];
  const queryInsertCourse = `
    INSERT INTO cursos_presenciales (title, description, tutor, start_date, end_date, status)
    VALUES (?, '', '', ?, ?, ?, 'true')
  `;
  const querySelectCourse = `
    SELECT id_course FROM cursos_presenciales
    WHERE title = ? AND tutor = ? AND start_date = ?
  `;
  const queryInsertUserCourse = `
    INSERT INTO usuario_curso (id_usuario, id_course, progress) VALUES ?
    ON DUPLICATE KEY UPDATE id_course = VALUES(id_course), progress = VALUES(progress)
  `;

  try {
    // Paso 1: Verificar si el curso ya existe
    const [existingCourse] = await db.promise().query(querySelectCourse, [curso, tutor, fecha]);
    let id_course;

    if (existingCourse.length > 0) {
      // Si el curso ya existe, usar su ID
      id_course = existingCourse[0].id_course;
      console.log("El curso ya existe. Usando ID existente:", id_course);
    } else {
      // Si el curso no existe, insertarlo y obtener su ID
      const [insertResult] = await db.promise().query(queryInsertCourse, [curso, tutor, fecha , end_date]);
      console.log("Curso agregado con éxito:", insertResult);

      const [courseResult] = await db.promise().query(querySelectCourse, [curso, tutor, fecha]);
      if (courseResult.length === 0) {
        return res.status(404).json({ success: false, message: 'No se encontró el curso recién creado' });
      }
      id_course = courseResult[0].id_course;
      console.log("Nuevo curso creado con ID:", id_course);
    }

    // Paso 2: Insertar en `usuario_curso` para todos los usuarios
    const values2 = datosExcel.map(curso => [curso.id_usuario, id_course, curso.progress]);
    const [userCourseResult] = await db.promise().query(queryInsertUserCourse, [values2]);
    console.log("Usuarios asignados al curso con éxito:", userCourseResult);

    // Respuesta exitosa
    res.status(200).json({ success: true, message: "Proceso completado con éxito" });
  } catch (error) {
    console.error("Error en el proceso:", error);

    // Manejar otros errores
    res.status(500).json({ success: false, message: error.message || 'Error en el servidor' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Log: Datos recibidos en la solicitud
  console.log(`[LOG] Solicitud de inicio de sesión recibida. Email: ${email}, Contraseña: ${password}`);

  if (!email || !password) {
    console.log('[LOG] Error: Email o contraseña no proporcionados.');
    return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });
  }

  try {
    const query = `SELECT * FROM users WHERE email = ?`;
    console.log(`[LOG] Buscando usuario en la base de datos con email: ${email}`);

    db.query(query, [email], async (err, result) => {
      if (err) {
        console.error("[LOG] Error al buscar el usuario en la base de datos:", err);
        return res.status(500).json({ success: false, message: 'Error en la base de datos' });
      }

      if (result.length === 0) {
        console.log(`[LOG] Usuario no encontrado para el email: ${email}`);
        return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
      }

      const user = result[0];
      console.log(`[LOG] Usuario encontrado:`, {
        id: user.id,
        email: user.email,
        contraseñaAlmacenada: user.password, // ¡Cuidado! No exponer esto en producción.
      });

      // Log: Comparación de contraseñas
      console.log(`[LOG] Comparando contraseñas. Contraseña recibida: ${password}, Contraseña almacenada (hash): ${user.password}`);

      const validPassword = await bcrypt.compare(password, user.password);
      console.log(`[LOG] Resultado de la comparación de contraseñas: ${validPassword}`);

      if (!validPassword) {
        console.log('[LOG] Error: Contraseña incorrecta.');
        return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
      }

      console.log(`[LOG] Inicio de sesión exitoso para el usuario: ${user.email}`);
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
  const { img, title, desc, date, img_author, name_author, num_empleado, tag } = req.body;
  
  const images = Array.isArray(img) ? img : [img]; 
  const imgList = JSON.stringify(images);
  // Consulta con placeholders para los valores
  const query = `INSERT INTO Blog (img, title, \`desc\`, date, img_author, name_author, num_empleado, tag) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [imgList, title, desc, date, img_author, name_author, num_empleado, tag];

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
  const { idBlog, img, title, desc, date, img_author, name_author, num_empleado, tag } = req.body;
 
  const query = `UPDATE Blog
                 SET img = ?, title = ?, \`desc\` = ?, date = ?, img_author = ?, name_author = ?, num_empleado = ?, tag = ?
                 WHERE idBlog = ?`;
 
  const values = [img, title, desc, date, img_author, name_author, num_empleado, tag, idBlog];
 
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

//open port 
app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
