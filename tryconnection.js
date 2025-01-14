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
      database: 'cursosPresenciales',
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
  const query=`SELECT * FROM cursosPresenciales.cursos_presenciales;`;
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send('Error fetching data');
      return;
    }
    res.json(results);
  });
});


app.get('/cursostomados', (req, res) => {
  const query=`SELECT * FROM cursos_presenciales inner join usuario_curso on  usuario_curso.id_course= cursos_presenciales.id_course;`;
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send('Error fetching data');
      return;
    }
    res.json(results);
  });
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
  const { id, name, email, password } = req.body;
 
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


app.post('/agregarCurso', (req, res) => {
  
  const { title, description, area, tutor } = req.body;
 
  // Verifica si los datos se están recibiendo correctamente
  console.log("Datos recibidos:", req.body);
 
  const query = `INSERT INTO cursos_presenciales (title, description, area, tutor)
                 VALUES ('${title}', '${description}', '${area}', '${tutor}')`;
 
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

app.post('/Login',(req,res)=>{
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send('Email y contraseña son requeridos');
  }

  try{
    query = `SELECT * FROM users WHERE email = ? `;
    db.query(query,[email], async (err, result) => {
      if (err) {
        console.error("Error al buscar el usuario:", err);
        return res.status(500).send('Error en la base de datos');
      }
      if (result.length === 0) {
        return res.status(401).send('Usuario no encontrado');
      }
      const user = result[0];
      const validPassword = await bcrypt.compare(password, user.password);
      console.log(password, user.password, validPassword);

      if (!validPassword) {
        console.log("Contraseña incorrecta");
        return res.status(401).send('Contraseña incorrecta');
      }
      return res.json(user);
    }
    );
  }catch(e){
    console.log(e)
    res.status(500).send('Error en el servidor');
  }

})

//open port 
app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
