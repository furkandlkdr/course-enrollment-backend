const express = require("express");
const mssql = require("mssql");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const port = 3000;
const jwt = require("jsonwebtoken");
const secretKey = "supersecretkey";

const config = {
  user: "node_user",
  password: "node_user_1",
  server: "localhost",
  database: "Course_Enrollment",
  options: {
    trustServerCertificate: true,
    truestedConnection: false,
    enableArithAbort: true,
    instenceName: "SQLEXPRESS",
  },
  port: 1433,
};

app.use(cors());
app.use(bodyParser.json());

mssql.connect(config, (err) => {
  if (err) {
    console.error("Veritabanı bağlantı hatası:", err);
    return;
  }
  console.log("Veritabanına bağlandı.");
});

app.listen(port, () => {
  console.log(`Sunucu ${port} portunda çalışıyor.`);
});

// Get Students
app.get("/api/students", async (req, res) => {
  try {
    const request = new mssql.Request();
    const result = await request.query("SELECT * FROM Student");
    res.json(result.recordset);
  } catch (err) {
    console.error("Sorgu hatası:", err);
    res.status(500).json({ error: "Öğrenciler getirilemedi" });
  }
});

// Add Student
app.post("/api/students", async (req, res) => {
  try {
    const { Name, Surname, Date_of_Birth, Faculty_ID } = req.body;
    const request = new mssql.Request();

    const insertQuery = `
              INSERT INTO Student (Name, Surname, Date_of_Birth, Faculty_ID, Enroll_Date)
              VALUES (@Name, @Surname, @DOB, @Faculty_ID, GETDATE());
              SELECT SCOPE_IDENTITY() AS Student_ID;
          `;

    request.input("Name", mssql.VarChar(50), Name);
    request.input("Surname", mssql.VarChar(50), Surname);
    request.input("DOB", mssql.Date, Date_of_Birth);
    request.input("Faculty_ID", mssql.Int, Faculty_ID);

    const result = await request.query(insertQuery);
    const studentId = result.recordset[0].Student_ID;

    const generateNumberRequest = new mssql.Request();
    generateNumberRequest.input("Student_ID", mssql.Int, studentId);
    generateNumberRequest.input("Year", mssql.Int, new Date().getFullYear());
    generateNumberRequest.input("Faculty_ID", mssql.Int, Faculty_ID);

    await generateNumberRequest.execute("GenerateStudentNumber");

    res.json({
      message: "Yeni öğrenci başarıyla eklendi.",
      studentId: studentId,
    });
  } catch (err) {
    console.error("Yeni öğrenci eklenirken hata:", err);
    res.status(500).json({ error: "Öğrenci eklenemedi." + err });
  }
});

// Update Student
app.put("/api/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { Name, Surname, Date_of_Birth, Faculty_ID } = req.body;
    const request = new mssql.Request();

    const query = `
            UPDATE Student
            SET Name = @Name, Surname = @Surname, Date_of_Birth = @DOB, Faculty_ID = @Faculty_ID
            WHERE Student_ID = @id;
        `;

    request.input("id", mssql.Int, id);
    request.input("Name", mssql.VarChar(50), Name);
    request.input("Surname", mssql.VarChar(50), Surname);
    request.input("DOB", mssql.Date, Date_of_Birth);
    request.input("Faculty_ID", mssql.Int, Faculty_ID);

    await request.query(query);
    res.json({ message: "Öğrenci başarıyla güncellendi." });
  } catch (err) {
    console.error("Öğrenci güncellenirken hata:", err);
    res.status(500).json({ error: "Öğrenci güncellenemedi." });
  }
});

// Faculty CRUD
app.get("/api/faculties", async (req, res) => {
  try {
    const request = new mssql.Request();
    const result = await request.query("SELECT * FROM Faculty");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Fakülteler getirilemedi" });
  }
});

app.post("/api/faculties", async (req, res) => {
  try {
    const { Name, Dean_Name } = req.body;
    const request = new mssql.Request();
    request.input("Name", mssql.VarChar(50), Name);
    request.input("Dean_Name", mssql.VarChar(50), Dean_Name);
    await request.query(`
            INSERT INTO Faculty (Name, Dean_Name)
            VALUES (@Name, @Dean_Name)
        `);
    res.json({ message: "Fakülte eklendi" });
  } catch (err) {
    res.status(500).json({ error: "Fakülte eklenemedi" });
  }
});

// Course CRUD
app.get("/api/courses", async (req, res) => {
  try {
    const request = new mssql.Request();
    const result = await request.query(`
            SELECT c.*, f.Name AS FacultyName
            FROM Course c
            JOIN Faculty f ON c.Faculty_ID = f.Faculty_ID
        `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Dersler getirilemedi" });
  }
});

app.post("/api/courses", async (req, res) => {
  try {
    const { Name, Credits, Faculty_ID } = req.body;
    const request = new mssql.Request();
    request.input("Name", mssql.VarChar(50), Name);
    request.input("Credits", mssql.Int, Credits);
    request.input("Faculty_ID", mssql.Int, Faculty_ID);
    await request.query(`
            INSERT INTO Course (Name, Credits, Faculty_ID)
            VALUES (@Name, @Credits, @Faculty_ID)
        `);
    res.json({ message: "Ders eklendi" });
  } catch (err) {
    res.status(500).json({ error: "Ders eklenemedi" });
  }
});

// Enrollment & Grade
app.post("/api/enrollments", async (req, res) => {
  try {
    const { Student_ID, Course_ID, Term } = req.body;
    const request = new mssql.Request();
    request.input("Student_ID", mssql.Int, Student_ID);
    request.input("Course_ID", mssql.Int, Course_ID);
    request.input("Term", mssql.VarChar(50), Term);
    await request.query(`
            INSERT INTO Enrollment (Student_ID, Course_ID, Term) 
            VALUES (@Student_ID, @Course_ID, @Term)
        `);
    res.json({ message: "Ders kaydı yapıldı" });
  } catch (err) {
    res.status(500).json({ error: "Ders kaydı yapılamadı" });
  }
});

app.put("/api/enrollments/:id/grade", async (req, res) => {
  try {
    const { id } = req.params;
    const { Grade } = req.body;
    const request = new mssql.Request();
    request.input("Grade", mssql.Int, Grade);
    request.input("id", mssql.Int, id);
    await request.query(`
            UPDATE Enrollment
            SET Grade = @Grade
            WHERE Enroll_ID = @id
        `);
    res.json({ message: "Not güncellendi" });
  } catch (err) {
    res.status(500).json({ error: "Not güncellenemedi" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { Username, Password } = req.body;
    const request = new mssql.Request();

    request.input("Username", mssql.NVarChar, Username);
    const result = await request.query(
      `SELECT * FROM [User] WHERE Username = @Username`
    );

    const user = result.recordset[0];
    if (!user || user.Password !== Password) {
      return res
        .status(401)
        .json({ error: "Geçersiz kullanıcı adı veya şifre." });
    }

    const token = jwt.sign(
      { id: user.User_ID, role: user.Role_ID },
      secretKey,
      { expiresIn: "1h" }
    );
    res.json({ token });
  } catch (err) {
    console.error("Giriş işlemi sırasında hata:", err);
    res.status(500).json({ error: "Giriş yapılamadı." });
  }
});

const authenticate = (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(403).send("Token gerekli.");
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).send("Geçersiz token.");
    }

    req.user = decoded;
    next();
  });
};

// Logs
app.get("/api/grade-logs", async (req, res) => {
  try {
    const request = new mssql.Request();
    const result = await request.query(`
            SELECT gl.*, e.Student_ID, e.Course_ID 
            FROM Grade_Log gl
            JOIN Enrollment e ON gl.Enroll_ID = e.Enroll_ID
            ORDER BY gl.Update_Time DESC
        `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Not logları getirilemedi" });
  }
});

app.get("/api/operation-logs", async (req, res) => {
  try {
    const request = new mssql.Request();
    const result = await request.query(`
            SELECT * FROM Operation_Log
            ORDER BY Operation_Time DESC
        `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "İşlem logları getirilemedi" });
  }
});

// User Management
// Get all users (Admin only)
app.get("/api/users", authenticate, async (req, res) => {
  try {
    if (req.user.role !== 1) {
      return res.status(403).json({ error: "Yetkiniz yok" });
    }
    const request = new mssql.Request();
    const result = await request.query("SELECT * FROM [User]");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Kullanıcılar getirilemedi" });
  }
});

// Create new user
app.post("/api/users", authenticate, async (req, res) => {
  try {
    if (!(req.user.role === 1 || req.user.role === 3)) {
      return res.status(403).json({ error: "Yetkiniz yok" });
    }
    const { Username, Password, Role_ID, Student_Number } = req.body;
    const request = new mssql.Request();
    request.input("Username", mssql.NVarChar(50), Username);
    request.input("Password", mssql.NVarChar(255), Password);
    request.input("Role_ID", mssql.Int, Role_ID);
    request.input("Student_Number", mssql.NVarChar(20), Student_Number);

    await request.query(`
            INSERT INTO [User] (Username, Password, Role_ID, Created_At, Student_Number)
            VALUES (@Username, @Password, @Role_ID, GETDATE(), @Student_Number)
        `);
    res.json({ message: "Kullanıcı başarıyla eklendi" });
  } catch (err) {
    res.status(500).json({ error: "Kullanıcı eklenemedi" });
  }
});

// Update user
app.put("/api/users/:id", authenticate, async (req, res) => {
  try {
    if (!(req.user.role === 1 || req.user.role === 3)) {
      return res.status(403).json({ error: "Yetkiniz yok" });
    }
    const { id } = req.params;
    const { Username, Password, Role_ID, Student_Number } = req.body;
    const request = new mssql.Request();
    request.input("User_ID", mssql.Int, id);
    request.input("Username", mssql.NVarChar(50), Username);
    request.input("Password", mssql.NVarChar(255), Password);
    request.input("Role_ID", mssql.Int, Role_ID);
    request.input("Student_Number", mssql.NVarChar(20), Student_Number);

    await request.query(`
            UPDATE [User]
            SET Username = @Username,
                Password = @Password,
                Role_ID = @Role_ID,
                Student_Number = @Student_Number
            WHERE User_ID = @User_ID
        `);
    res.json({ message: "Kullanıcı bilgileri güncellendi" });
  } catch (err) {
    res.status(500).json({ error: "Kullanıcı güncellenemedi" });
  }
});

// Delete user
app.delete("/api/users/:id", authenticate, async (req, res) => {
  try {
    if (!(req.user.role === 1 || req.user.role === 3)) {
      return res.status(403).json({ error: "Yetkiniz yok" });
    }
    const { id } = req.params;
    const request = new mssql.Request();
    request.input("User_ID", mssql.Int, id);

    await request.query(`
            DELETE FROM [User]
            WHERE User_ID = @User_ID
        `);
    res.json({ message: "Kullanıcı silindi" });
  } catch (err) {
    res.status(500).json({ error: "Kullanıcı silinemedi" });
  }
});
