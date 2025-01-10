const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const port = 3001;
app.use(express.json())

//dates to do a connection

const db = mysql.createConnection({
  host: '192.168.29.40',
  user: 'root',
  password: 'C0L1s3um.t4r4',
  database: 'cursosPresenciales',
  port: '3010'  
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
app.get('/courses', (req, res) => {
  const sql = `
  SELECT
    c.id AS course_id,
    c.fullname AS course_name,
    c.summary AS course_description,
    CONCAT(u.firstname, ' ', u.lastname) AS teacher_name,
    FROM_UNIXTIME(c.startdate, '%Y-%m-%d') AS start_date,
    FROM_UNIXTIME(c.enddate, '%Y-%m-%d') AS end_date,
    cat.name AS course_category -- Agregamos la categoría del curso (área/departamento)
FROM
    mdl_course c
LEFT JOIN
    mdl_context ctx ON ctx.instanceid = c.id AND ctx.contextlevel = 50
LEFT JOIN
    mdl_role_assignments ra ON ra.contextid = ctx.id
LEFT JOIN
    mdl_role r ON ra.roleid = r.id
LEFT JOIN
    mdl_user u ON ra.userid = u.id
LEFT JOIN
    mdl_course_categories cat ON cat.id = c.category -- Se une con la tabla de categorías
WHERE
    r.shortname = 'editingteacher' -- Solo se considera a los profesores editores
ORDER BY
    course_name;
`;


  db.query(sql, (err, results) => {
    if (err) {
      res.status(500).send('Error fetching data');
      return;
    }
    res.json(results);

    // console.log(results)
  });
});


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



app.get('/allCourses',(req,res)=>{

  const query=`SELECT * FROM bitnami_moodle.mdl_adminpresets;`

  try{

    db.query(query,(err,result)=>{
      if(err){
        res.status(500).send('error')
      }else{
        res.json(result)
      }

    })

  }catch(e){


    console.log(e)
  }


})

app.get('/', (req, res) => {
  console.log("hola"); // Logs "hola" to the server console
  res.send("hola"); // Sends "hola" to the browser
});


app.post('/agregarCurso', (req, res) => {
  
  const { title, description, area, tutor } = req.body;
 
  // Verifica si los datos se están recibiendo correctamente
  console.log("Datos recibidos:", req.body);
 
  const query = `INSERT INTO bitnami_moodle.cursos_presenciales (title, description, area, tutor)
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

//open port 
app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
