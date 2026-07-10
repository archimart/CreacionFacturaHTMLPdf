import path from 'path';
import fs from 'fs';

/**
 * PathManager: Orquestador de persistencia agnóstico
 * Gestiona la estructura de carpetas para blueprints, ejecuciones y vault.
 */
export class PathManager {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    // Si no se especifica, usamos una carpeta 'storage' en la raíz del proyecto
    this.baseDir = customBaseDir || path.resolve(process.cwd(), 'storage');
    this.initializeBaseStructure();
  }

  private initializeBaseStructure() {
    const dirs = ['blueprints', 'executions', 'vault'];
    dirs.forEach(dir => {
      const target = path.join(this.baseDir, dir);
      if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
      }
    });
  }

  /**
   * Obtiene la ruta base del almacenamiento
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Obtiene la ruta de un Blueprint específico
   */
  getBlueprintPath(workflowId: string, filename: string = 'main'): string {
    // Si es main, usamos el nombre directo para compatibilidad. Si es draft, añadimos el sufijo.
    const suffix = filename === 'main' ? '' : `.${filename}`;
    return path.join(this.baseDir, 'blueprints', `${workflowId}${suffix}.json`);
  }

  /**
   * Crea y obtiene la carpeta de una nueva ejecución (Snapshots + Logs)
   */
  getExecutionDir(workflowId: string, runId: string): string {
    const dir = path.join(this.baseDir, 'executions', workflowId, runId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Genera la ruta en el Vault para el producto final (PDF)
   * Organizado por AAAA/MM/DD/WorkflowID
   */
  getVaultPath(workflowId: string, filename: string): string {
    const now = new Date();
    const datePath = path.join(
      now.getFullYear().toString(),
      (now.getMonth() + 1).toString().padStart(2, '0'),
      now.getDate().toString().padStart(2, '0')
    );
    
    const targetDir = path.join(this.baseDir, 'vault', datePath, workflowId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    return path.join(targetDir, filename);
  }

  /**
   * Obtiene la ruta para el Snapshot de datos (.jsonl para streaming)
   */
  getSnapshotPath(workflowId: string, runId: string): string {
    return path.join(this.getExecutionDir(workflowId, runId), 'data_snapshot.jsonl');
  }
}
