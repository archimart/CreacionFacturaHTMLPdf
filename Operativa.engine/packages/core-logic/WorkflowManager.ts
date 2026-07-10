import { PathManager } from './PathManager';
import fs from 'fs';
import path from 'path';

export class WorkflowManager {
  private paths: PathManager;

  constructor(workingDir?: string) {
    this.paths = new PathManager(workingDir);
  }

  /**
   * Lista todos los workflows (.json) disponibles en /blueprints
   */
  listWorkflows() {
    const blueprintDir = path.join(this.paths.getBaseDir(), 'blueprints');
    if (!fs.existsSync(blueprintDir)) return [];
    return fs.readdirSync(blueprintDir)
      .filter(f => f.endsWith('.json') && !f.includes('.draft')) // Listamos los .json normales, ignorando borradores
      .map(f => f.replace('.json', ''));
  }

  /**
   * Guarda un flujo específico
   */
  saveWorkflow(workflowId: string, data: any, filename: string = 'main') {
    const filePath = this.paths.getBlueprintPath(workflowId, filename);
    console.log(`[WorkflowManager] GUARDANDO en: ${filePath}`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`[WorkflowManager] Guardado completado con éxito.`);
    return { success: true, path: filePath };
  }

  /**
   * Carga un flujo específico
   */
  loadWorkflow(workflowId: string, filename: string = 'main') {
    const filePath = this.paths.getBlueprintPath(workflowId, filename);
    console.log(`[WorkflowManager] Intentando cargar: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`[WorkflowManager] ARCHIVO NO ENCONTRADO: ${filePath}`);
      return null; // Retornamos null para que el frontend sepa que falló y no pise datos
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      console.log(`[WorkflowManager] Carga exitosa. Tamaño: ${content.length} bytes`);
      return JSON.parse(content);
    } catch (err) {
      console.error(`[WorkflowManager] Error al leer/parsear: ${err.message}`);
      return null;
    }
  }
}
