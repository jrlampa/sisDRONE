/**
 * preventiveService.ts — Phase 38: Manutenção Preventiva Automática
 *
 * Gera planos de manutenção preventiva de forma determinística (sem IA),
 * baseado em AHI < 50, ausência de plano PENDING e custo de materiais do estoque.
 *
 * Smart Backend: toda lógica no servidor, frontend recebe apenas resultado final.
 */
import { getDb } from '../db';

export interface PreventivePlan {
  pole_id: number;
  pole_name: string;
  ahi_score: number;
  priority: 'ALTA' | 'MÉDIA' | 'BAIXA';
  activities: string[];
  materials: string[];
  estimated_cost: number;
  plan_text: string;
}

export interface ScheduledPlan {
  id: number;
  pole_id: number;
  pole_name: string;
  ahi_score: number;
  plan_text: string;
  status: string;
  estimated_cost: number;
  created_at: string;
}

/** Custo estimado padrão (R$) por prioridade quando nenhum material do estoque corresponde */
const DEFAULT_COST_BY_PRIORITY: Record<string, number> = {
  ALTA: 2500,
  MÉDIA: 1500,
  BAIXA: 800,
};
export function getPriority(ahi: number): 'ALTA' | 'MÉDIA' | 'BAIXA' {
  if (ahi < 30) return 'ALTA';
  if (ahi < 40) return 'MÉDIA';
  return 'BAIXA';
}

/** Retorna atividades recomendadas com base no AHI e material do poste */
export function getActivities(ahi: number, material: string): string[] {
  const acts: string[] = [];
  if (ahi < 30) {
    acts.push('Substituição urgente do poste');
    acts.push('Inspeção de segurança imediata');
  } else if (ahi < 40) {
    acts.push('Reforço estrutural');
    acts.push('Limpeza e tratamento anticorrosivo');
  } else {
    acts.push('Manutenção preventiva padrão');
    acts.push('Vistoria de fixações e conexões');
  }
  const mat = (material || '').toLowerCase();
  if (mat === 'concreto') acts.push('Verificação de trincas e fissuras');
  else if (mat === 'madeira') acts.push('Tratamento preservativo de madeira');
  else if (mat === 'metal' || mat === 'ferro') acts.push('Pintura anticorrosiva');
  return acts;
}

/**
 * Gera planos preventivos para postes com AHI < 50 sem plano PENDING ativo.
 * Insere os planos em maintenance_plans e retorna os dados gerados.
 */
export async function generatePreventivePlans(
  tenantId: number
): Promise<{ generated: number; plans: PreventivePlan[] }> {
  const db = await getDb();

  // Postes críticos sem plano pendente
  const poles = await db.all(
    `SELECT p.* FROM poles p
     WHERE p.tenant_id = ? AND p.ahi_score IS NOT NULL AND p.ahi_score < 50
       AND NOT EXISTS (
         SELECT 1 FROM maintenance_plans mp
         WHERE mp.pole_id = p.id AND mp.status = 'PENDING'
       )
     ORDER BY p.ahi_score ASC`,
    [tenantId]
  );

  const allMaterials = await db.all('SELECT * FROM materials');
  const plans: PreventivePlan[] = [];

  for (const pole of poles) {
    const priority = getPriority(pole.ahi_score);
    const activities = getActivities(pole.ahi_score, pole.material || '');

    // Associa materiais do estoque com base em match_keys e atributos do poste
    const matchedNames: string[] = [];
    let estimatedCost = 0;
    const poleAttr = `${pole.material || ''} ${pole.structure_type || ''}`.toLowerCase();

    for (const mat of allMaterials) {
      const keys: string[] = mat.match_keys
        ? mat.match_keys.split(',').map((k: string) => k.trim().toLowerCase())
        : [];
      if (keys.some((k: string) => k && poleAttr.includes(k))) {
        matchedNames.push(mat.name);
        estimatedCost += mat.unit_price;
      }
    }

    // Custo default quando nenhum material do estoque corresponde
    if (estimatedCost === 0) {
      estimatedCost = DEFAULT_COST_BY_PRIORITY[priority];
    }

    const poleName = pole.name || `Poste #${pole.id}`;
    const planText = [
      `Manutenção Preventiva — ${poleName}`,
      `Prioridade: ${priority}`,
      `AHI: ${pole.ahi_score}`,
      `Atividades: ${activities.join('; ')}`,
      `Materiais: ${matchedNames.length ? matchedNames.join(', ') : 'Verificar em campo'}`,
      `Custo estimado: R$ ${estimatedCost.toFixed(2)}`,
    ].join('\n');

    await db.run(
      `INSERT INTO maintenance_plans (pole_id, plan_text, estimated_cost, status, created_at)
       VALUES (?, ?, ?, 'PENDING', datetime('now'))`,
      [pole.id, planText, estimatedCost]
    );

    plans.push({
      pole_id: pole.id,
      pole_name: poleName,
      ahi_score: pole.ahi_score,
      priority,
      activities,
      materials: matchedNames,
      estimated_cost: estimatedCost,
      plan_text: planText,
    });
  }

  return { generated: plans.length, plans };
}

/**
 * Retorna o cronograma de manutenção preventiva dos próximos 90 dias
 * (planos PENDING criados nos últimos 90 dias, filtrados por tenant).
 */
export async function getPreventiveSchedule(tenantId: number): Promise<ScheduledPlan[]> {
  const db = await getDb();
  return db.all(
    `SELECT mp.id, mp.pole_id, p.name AS pole_name, p.ahi_score,
            mp.plan_text, mp.status, mp.estimated_cost, mp.created_at
     FROM maintenance_plans mp
     JOIN poles p ON mp.pole_id = p.id
     WHERE p.tenant_id = ?
       AND mp.status = 'PENDING'
       AND mp.created_at >= datetime('now', '-90 days')
     ORDER BY p.ahi_score ASC`,
    [tenantId]
  );
}
