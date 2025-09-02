const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { waitForDbReady, dbQuery, closePool } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Esperar DB y preparar tabla al arrancar
(async () => {
  try {
    // await waitForDbReady();

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
    // await dbQuery(createTable);
    console.log("Tabla 'todos' verificada/creada");

    // Iniciar servidor
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  } catch (e) {
    console.error("La BD no estuvo lista a tiempo:", e.message);
    // ACA puede reiniciar/reintentar; no hacemos process.exit aquí a propósito
  }
})();

// Rutas
app.get("/api/todos", async (req, res) => {
  try {
    const rows = await dbQuery("SELECT * FROM todos ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    console.error("Error obteniendo todos:", err);
    res
      .status(500)
      .json({ error: "Error interno del servidor", message: err.message });
  }
});

app.get("/api/todos/:id", async (req, res) => {
  try {
    const rows = await dbQuery("SELECT * FROM todos WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows.length)
      return res.status(404).json({ error: "Todo no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Error obteniendo todo:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.post("/api/todos", async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title)
      return res.status(400).json({ error: "El título es requerido" });

    const result = await dbQuery(
      "INSERT INTO todos (title, description) VALUES (?, ?)",
      [title, description || ""]
    );
    const rows = await dbQuery("SELECT * FROM todos WHERE id = ?", [
      result.insertId,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creando todo:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.put("/api/todos/:id", async (req, res) => {
  try {
    const { title, description, completed } = req.body;
    if (!title)
      return res.status(400).json({ error: "El título es requerido" });

    const result = await dbQuery(
      "UPDATE todos SET title = ?, description = ?, completed = ? WHERE id = ?",
      [title, description || "", !!completed, req.params.id]
    );
    if (!result.affectedRows)
      return res.status(404).json({ error: "Todo no encontrado" });

    const rows = await dbQuery("SELECT * FROM todos WHERE id = ?", [
      req.params.id,
    ]);
    res.json(rows[0]);
  } catch (err) {
    console.error("Error actualizando todo:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.patch("/api/todos/:id/toggle", async (req, res) => {
  try {
    const result = await dbQuery(
      "UPDATE todos SET completed = NOT completed WHERE id = ?",
      [req.params.id]
    );
    if (!result.affectedRows)
      return res.status(404).json({ error: "Todo no encontrado" });
    const rows = await dbQuery("SELECT * FROM todos WHERE id = ?", [
      req.params.id,
    ]);
    res.json(rows[0]);
  } catch (err) {
    console.error("Error actualizando estado:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.delete("/api/todos/:id", async (req, res) => {
  try {
    const result = await dbQuery("DELETE FROM todos WHERE id = ?", [
      req.params.id,
    ]);
    if (!result.affectedRows)
      return res.status(404).json({ error: "Todo no encontrado" });
    res.json({ message: "Todo eliminado exitosamente" });
  } catch (err) {
    console.error("Error eliminando todo:", err);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: err.message });
  }
});

app.get("/health", async (_req, res) => {
  try {
    await dbQuery("SELECT 1");
    res.json({ status: "OK", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "DB DOWN" });
  }
});

app.use("*", (_req, res) =>
  res.status(404).json({ error: "Ruta no encontrada" })
);

// Cierre ordenado (no cierres en cada request nunca)
process.on("SIGTERM", async () => {
  await closePool();
  process.exit(0);
});
process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});
