-- Script de inicialización de la base de datos
USE todoapp;

-- Crear tabla todos si no existe
CREATE TABLE IF NOT EXISTS todos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertar datos de ejemplo
INSERT INTO todos (title, description, completed) VALUES 
('Configurar aplicación', 'Configurar la aplicación de todo list con Node.js y MySQL', TRUE),
('Crear API REST', 'Implementar endpoints para CRUD de tareas', TRUE),
('Añadir frontend', 'Crear interfaz de usuario para la aplicación', FALSE),
('Documentar proyecto', 'Crear documentación completa del proyecto', FALSE),
('Añadir tests', 'Implementar tests unitarios e integración', FALSE);

-- Crear índices para optimizar consultas
CREATE INDEX idx_completed ON todos(completed);
CREATE INDEX idx_created_at ON todos(created_at);