import express from 'express';
import cors from 'cors';
import { PathManager } from './PathManager';
import { WorkflowManager } from './WorkflowManager';

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint para crear la estructura real de un workflow
app.post('/api/workflows/create', (req, res) => {
  const { name, baseDir } = req.body;
  try {
    const paths = new PathManager(baseDir);
    const manager = new WorkflowManager(baseDir);
    
    // Crear el blueprint inicial
    manager.saveWorkflow(name, {
      id: name,
      nodes: [],
      edges: [],
      createdAt: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      message: "Estructura creada físicamente",
      paths: {
        blueprints: `${baseDir}/blueprints`,
        executions: `${baseDir}/executions`,
        vault: `${baseDir}/vault`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Nuevo: Listar los flujos reales de una carpeta
app.get('/api/workflows/list', (req, res) => {
  const { baseDir } = req.query;
  try {
    const manager = new WorkflowManager(baseDir as string);
    const list = manager.listWorkflows();
    res.json({ success: true, workflows: list });
  } catch (error) {
    res.status(500).json({ success: false, workflows: [] });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Operativa.engine API activa en http://localhost:${PORT}`);
});
