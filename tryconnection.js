const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const app = express();
const port = 3307;

//dates to do a connection

const db = mysql.createConnection({
  host: '192.168.32.6',
  user: 'rauf',
  password: '',
  database: 'moodle',
  port: '3307'
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
  const sql = `SELECT DISTINCT
  c.id AS course_id,
  c.fullname AS course_name,
  c.shortname AS course_shortname,
  CONCAT(u.firstname, ' ', u.lastname) AS user_name,
  r.shortname AS role_name,
  CASE 
      WHEN ue.id IS NOT NULL THEN 
          CASE 
              WHEN r.shortname = 'student' THEN 'Completed'
              ELSE 'Enrolled'
          END
      ELSE 'Assigned Only'
  END AS enrollment_status,
  FROM_UNIXTIME(c.startdate, '%Y-%m-%d') AS start_date,
  FROM_UNIXTIME(c.enddate, '%Y-%m-%d') AS end_date
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
  mdl_enrol e ON e.courseid = c.id
LEFT JOIN 
  mdl_user_enrolments ue ON ue.enrolid = e.id AND ue.userid = u.id
WHERE 
  u.id = 2 -- Reemplaza "2" con tu ID de usuario
GROUP BY 
  c.id, u.id, r.shortname
ORDER BY 
  course_name;`;

  db.query(sql, (err, results) => {
    if (err) {
      res.status(500).send('Error fetching data');
      return;
    }
    res.json(results);

    // console.log(results)
  });
});


app.get('/allCourses',(req,res)=>{

  const query=`SELECT * FROM mdl_course`

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

//course api users 


//open port 
app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
