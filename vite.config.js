import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Plugin para integrar la API de archivos en el servidor de Vite
const localApiServer = () => ({
  name: 'local-api-server',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      // Solo interceptar peticiones que empiecen por /api
      if (!req.url?.startsWith('/api')) return next();

      try {
        // --- 1. LISTAR DIRECTORIOS (EXPLORADOR) ---
        if (req.url.startsWith('/api/utils/list-dirs')) {
          const url = new URL(req.url, `http://${req.headers.host}`);
          let currentPath = url.searchParams.get('path') || 'C:/';
          
          // Normalizar ruta para Windows
          if (!currentPath.endsWith('/') && !currentPath.endsWith('\\')) currentPath += '/';

          if (!fs.existsSync(currentPath)) {
             return res.end(JSON.stringify({ success: false, error: 'Ruta no existe' }));
          }

          const items = fs.readdirSync(currentPath, { withFileTypes: true });
          const dirs = items
            .filter(item => item.isDirectory())
            .map(item => item.name)
            .sort((a, b) => a.localeCompare(b));

          const files = items
            .filter(item => !item.isDirectory() && item.name.endsWith('.json'))
            .map(item => item.name)
            .sort((a, b) => a.localeCompare(b));
          
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ 
            success: true, 
            parent: path.dirname(currentPath.replace(/\/$/, '')),
            current: currentPath,
            dirs,
            files
          }));
        }

        // --- 1.2 CREAR DIRECTORIO ---
        if (req.url.startsWith('/api/utils/create-dir') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { path: dirPath, name: dirName } = JSON.parse(body);
              const fullPath = path.join(dirPath, dirName);
              if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: true }));
              }
              res.end(JSON.stringify({ success: false, error: 'La carpeta ya existe' }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // --- 1.25 GUARDAR ARCHIVO EN DISCO (PDFs) ---
        if (req.url.startsWith('/api/utils/save-file') && req.method === 'POST') {
          let bodyChunks = [];
          req.on('data', chunk => bodyChunks.push(chunk));
          req.on('end', () => {
            try {
              const rawBody = Buffer.concat(bodyChunks).toString('utf8');
              const { filePath, encoding, content } = JSON.parse(rawBody);
              const normalizedPath = path.normalize(filePath);
              const fullDir = path.dirname(normalizedPath);
              if (!fs.existsSync(fullDir)) {
                fs.mkdirSync(fullDir, { recursive: true });
              }
              const fileBuffer = encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8');
              fs.writeFileSync(normalizedPath, fileBuffer);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, path: normalizedPath }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // --- 1.28 GUARDAR ARCHIVOS EN LOTE (BATCH ULTRA-RÁPIDO) ---
        if (req.url.startsWith('/api/utils/save-files-batch') && req.method === 'POST') {
          let bodyChunks = [];
          req.on('data', chunk => bodyChunks.push(chunk));
          req.on('end', () => {
            try {
              const rawBody = Buffer.concat(bodyChunks).toString('utf8');
              const { files } = JSON.parse(rawBody);
              const savedPaths = [];
              for (const file of files) {
                const normalizedPath = path.normalize(file.filePath);
                const fullDir = path.dirname(normalizedPath);
                if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });
                const fileBuffer = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : Buffer.from(file.content, 'utf8');
                fs.writeFileSync(normalizedPath, fileBuffer);
                savedPaths.push(normalizedPath);
              }
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, count: savedPaths.length }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // --- 1.3 IMPORTAR WORKFLOW (COPIAR ARCHIVO) ---
        if (req.url.startsWith('/api/workflows/import') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { sourcePath, targetBaseDir } = JSON.parse(body);
              const fileName = path.basename(sourcePath);
              const targetPath = path.join(targetBaseDir, 'blueprints', fileName);
              
              // Asegurar que existe la carpeta destino
              const targetDir = path.dirname(targetPath);
              if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

              fs.copyFileSync(sourcePath, targetPath);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // --- 1.5 SCHEDULES ---
        if (req.url.startsWith('/api/schedules/')) {
          const schedulePath = (baseDir) => {
            const dir = baseDir || 'C:/NegocioEnMarcha/Workflows';
            return path.join(dir, 'schedules.json');
          };
          const readSchedules = (baseDir) => {
            const p = schedulePath(baseDir);
            return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
          };
          const writeSchedules = (baseDir, data) => {
            const p = schedulePath(baseDir);
            const dir = path.dirname(p);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(p, JSON.stringify(data, null, 2));
          };

          if (req.url.startsWith('/api/schedules/load')) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const baseDir = url.searchParams.get('baseDir');
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, schedules: readSchedules(baseDir) }));
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', () => {
              try {
                const { baseDir, workflowName, schedule } = JSON.parse(body);
                const all = readSchedules(baseDir);

                if (req.url.startsWith('/api/schedules/save')) {
                  all[workflowName] = { ...schedule, updatedAt: new Date().toISOString() };
                  writeSchedules(baseDir, all);
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ success: true }));
                }
                if (req.url.startsWith('/api/schedules/delete')) {
                  delete all[workflowName];
                  writeSchedules(baseDir, all);
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ success: true }));
                }
                if (req.url.startsWith('/api/schedules/update-last-run')) {
                  if (all[workflowName]) {
                    all[workflowName].lastRun = new Date().toISOString();
                    writeSchedules(baseDir, all);
                  }
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ success: true }));
                }
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
        }

        // --- 2. GESTIÓN DE WORKFLOWS (POST) ---
        if (req.method === 'POST') {
          // Leer el cuerpo de la petición manualmente para evitar depender de express.json()
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const { WorkflowManager } = await import('./Operativa.engine/packages/core-logic/WorkflowManager.ts');
              const manager = new WorkflowManager(data.baseDir);

              if (req.url === '/api/workflows/create') {
                manager.saveWorkflow(data.name, { id: data.name, nodes: [], edges: [], createdAt: new Date().toISOString() });
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: true }));
              }

              if (req.url === '/api/workflows/save') {
                const filename = data.isDraft ? 'main.draft' : 'main';
                manager.saveWorkflow(data.name, data.data, filename);
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: true }));
              }
            } catch (err) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // --- 3. LISTAR Y CARGAR (GET) ---
        const url = new URL(req.url, `http://${req.headers.host}`);
        const baseDir = url.searchParams.get('baseDir');
        const name = url.searchParams.get('name');
        const { WorkflowManager } = await import('./Operativa.engine/packages/core-logic/WorkflowManager.ts');
        const manager = new WorkflowManager(baseDir);

        if (req.url.startsWith('/api/workflows/list')) {
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ success: true, workflows: manager.listWorkflows() }));
        }

        if (req.url.startsWith('/api/workflows/load')) {
          const flowData = manager.loadWorkflow(name);
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ success: true, data: flowData }));
        }

      } catch (err) {
        console.error("[Vite API Error]", err);
        res.statusCode = 500;
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }

      next();
    });
  }
})

export default defineConfig({
  plugins: [react(), localApiServer()],
  resolve: {
    alias: {
      '@engine/core-logic': path.resolve(__dirname, './Operativa.engine/packages/core-logic/index.ts')
    }
  }
})
