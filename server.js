const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || "mysql-db",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "rootpassword",
  database: process.env.DB_NAME || "todoapp",
  port: process.env.DB_PORT || 3306,
};

let db;

// Función para conectar a la base de datos con reintentos
function connectDB() {
  db = mysql.createConnection(dbConfig);

  db.connect((err) => {
    if (err) {
      console.error("Error conectando a MySQL:", err.message);
      console.log("Reintentando conexión en 5 segundos...");
      setTimeout(connectDB, 5000);
      return;
    }
    console.log("Conectado a MySQL");

    // Crear tabla si no existe
    const createTable = `
      CREATE TABLE IF NOT EXISTS todos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;

    db.query(createTable, (err) => {
      if (err) {
        console.error("Error creando tabla:", err);
      } else {
        console.log("Tabla todos verificada/creada");
      }
    });
  });

  // Manejar desconexiones
  db.on("error", (err) => {
    console.error("Error de base de datos:", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      console.log("Reconectando...");
      connectDB();
    }
  });
}

// Iniciar conexión
connectDB();

// Rutas de la API

// Obtener todos los todos
app.get("/api/todos", (req, res) => {
  const query = "SELECT * FROM todos ORDER BY created_at DESC";

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error obteniendo todos:", err);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
    res.json(results);
  });
});

// Obtener un todo específico
app.get("/api/todos/:id", (req, res) => {
  const { id } = req.params;
  const query = "SELECT * FROM todos WHERE id = ?";

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error("Error obteniendo todo:", err);
      return res.status(500).json({ error: "Error interno del servidor" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Todo no encontrado" });
    }

    res.json(results[0]);
  });
});

// Crear un nuevo todo
app.post("/api/todos", (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: "El título es requerido" });
  }

  const query = "INSERT INTO todos (title, description) VALUES (?, ?)";

  db.query(query, [title, description || ""], (err, result) => {
    if (err) {
      console.error("Error creando todo:", err);
      return res.status(500).json({ error: "Error interno del servidor" });
    }

    // Obtener el todo recién creado
    const selectQuery = "SELECT * FROM todos WHERE id = ?";
    db.query(selectQuery, [result.insertId], (err, results) => {
      if (err) {
        console.error("Error obteniendo todo creado:", err);
        return res.status(500).json({ error: "Error interno del servidor" });
      }

      res.status(201).json(results[0]);
    });
  });
});

// Actualizar un todo
app.put("/api/todos/:id", (req, res) => {
  const { id } = req.params;
  const { title, description, completed } = req.body;

  if (!title) {
    return res.status(400).json({ error: "El título es requerido" });
  }

  const query =
    "UPDATE todos SET title = ?, description = ?, completed = ? WHERE id = ?";

  db.query(
    query,
    [title, description || "", completed || false, id],
    (err, result) => {
      if (err) {
        console.error("Error actualizando todo:", err);
        return res.status(500).json({ error: "Error interno del servidor" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Todo no encontrado" });
      }

      // Obtener el todo actualizado
      const selectQuery = "SELECT * FROM todos WHERE id = ?";
      db.query(selectQuery, [id], (err, results) => {
        if (err) {
          console.error("Error obteniendo todo actualizado:", err);
          return res.status(500).json({ error: "Error interno del servidor" });
        }

        res.json(results[0]);
      });
    }
  );
});

// Marcar como completado/no completado
app.patch("/api/todos/:id/toggle", (req, res) => {
  const { id } = req.params;

  const query = "UPDATE todos SET completed = NOT completed WHERE id = ?";

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error actualizando estado:", err);
      return res.status(500).json({ error: "Error interno del servidor" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Todo no encontrado" });
    }

    // Obtener el todo actualizado
    const selectQuery = "SELECT * FROM todos WHERE id = ?";
    db.query(selectQuery, [id], (err, results) => {
      if (err) {
        console.error("Error obteniendo todo actualizado:", err);
        return res.status(500).json({ error: "Error interno del servidor" });
      }

      res.json(results[0]);
    });
  });
});

// Eliminar un todo
app.delete("/api/todos/:id", (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM todos WHERE id = ?";

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error eliminando todo:", err);
      return res.status(500).json({ error: "Error interno del servidor" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Todo no encontrado" });
    }

    res.json({ message: "Todo eliminado exitosamente" });
  });
});

// Ruta para servir el frontend
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Endpoint de salud
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Manejo de errores 404
app.use("*", (req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
