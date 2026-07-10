import { PathManager } from '../core-logic/PathManager';
import fs from 'fs';
import path from 'path';

/**
 * Script de automatización para crear la estructura de un nuevo workflow
 * Uso: node create-workflow.js <nombre-del-flujo> [directorio-base]
 */
const workflowName = process.argv[2];
const baseDir = process.argv[3] || process.cwd();

if (!workflowName) {
  console.error("Error: Debes proporcionar un nombre para el workflow.");
  process.exit(1);
}

const paths = new PathManager(baseDir);
const blueprintPath = paths.getBlueprintPath(workflowName);

// Inicializamos un blueprint vacío
const initialBlueprint = {
  id: workflowName,
  version: "1.0.0",
  nodes: [],
  edges: [],
  createdAt: new Date().toISOString()
};

fs.writeFileSync(blueprintPath, JSON.stringify(initialBlueprint, null, 2));

console.log(`
🚀 ¡Estructura de Workflow Creada!
---------------------------------
Nombre: ${workflowName}
Carpeta de Trabajo: ${baseDir}
Archivo Blueprint: ${blueprintPath}

Carpetas generadas:
- /blueprints (Donde viven tus diseños)
- /executions (Donde se guardarán los snapshots al ejecutar)
- /vault (Donde quedarán tus PDFs finales)
`);
