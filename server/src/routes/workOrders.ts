import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';
import { WorkOrder } from '../types';

const VALID_STATUSES: WorkOrder['status'][] = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'];
const VALID_PRIORITIES: WorkOrder['priority'][] = ['LOW', 'MED', 'HIGH', 'CRITICAL'];

const router = Router();

// GET /api/work-orders - List all work orders
router.get('/', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { status, assignee_id } = req.query;

    let query = `
      SELECT w.*, 
             u.username as assignee_name, 
             p.name as pole_name 
      FROM work_orders w
      LEFT JOIN users u ON w.assignee_id = u.id
      LEFT JOIN poles p ON w.pole_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      if (!VALID_STATUSES.includes(status as WorkOrder['status'])) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      query += ` AND w.status = ?`;
      params.push(status);
    }

    if (assignee_id) {
      const safeAssigneeId = parseInt(String(assignee_id), 10);
      if (isNaN(safeAssigneeId) || safeAssigneeId <= 0) {
        return res.status(400).json({ error: 'assignee_id inválido' });
      }
      query += ` AND w.assignee_id = ?`;
      params.push(safeAssigneeId);
    }

    query += ` ORDER BY w.created_at DESC`;

    const workOrders = await db.all(query, params);
    res.json(workOrders);
  } catch (error) {
    console.error('Error fetching work orders:', error);
    res.status(500).json({ error: 'Failed to fetch work orders' });
  }
});

// POST /api/work-orders - Create a new work order
router.post('/', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  try {
    const { title, description, priority, assignee_id, pole_id, due_date } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const safeTitle = title.trim().slice(0, 200);
    const safeDescription = description ? String(description).slice(0, 2000) : null;
    const safePriority = VALID_PRIORITIES.includes(priority) ? priority : 'MED';

    let safeAssigneeId: number | null = null;
    if (assignee_id) {
      safeAssigneeId = parseInt(String(assignee_id), 10);
      if (isNaN(safeAssigneeId) || safeAssigneeId <= 0) {
        return res.status(400).json({ error: 'assignee_id inválido' });
      }
    }

    let safePoleId: number | null = null;
    if (pole_id) {
      safePoleId = parseInt(String(pole_id), 10);
      if (isNaN(safePoleId) || safePoleId <= 0) {
        return res.status(400).json({ error: 'pole_id inválido' });
      }
    }

    const db = await getDb();
    const result = await db.run(
      `INSERT INTO work_orders (title, description, priority, assignee_id, pole_id, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [safeTitle, safeDescription, safePriority, safeAssigneeId, safePoleId, due_date || null]
    );

    const newOrder = await db.get('SELECT * FROM work_orders WHERE id = ?', result.lastID);
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({ error: 'Failed to create work order' });
  }
});

// GET /api/work-orders/:id - Get a single work order
router.get('/:id', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  try {
    const db = await getDb();
    const order = await db.get(`
      SELECT w.*, u.username as assignee_name, p.name as pole_name
      FROM work_orders w
      LEFT JOIN users u ON w.assignee_id = u.id
      LEFT JOIN poles p ON w.pole_id = p.id
      WHERE w.id = ?
    `, [id]);
    if (!order) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
    res.json(order);
  } catch (error) {
    console.error('Error fetching work order:', error);
    res.status(500).json({ error: 'Failed to fetch work order' });
  }
});

// PUT /api/work-orders/:id - Update status or assignment
router.put('/:id', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { status, assignee_id, priority, description } = req.body;
    const db = await getDb();

    // Dynamically build update query
    const updates: string[] = [];
    const params: any[] = [];

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      updates.push('status = ?');
      params.push(status);
    }
    if (assignee_id !== undefined) {
      const safeAssigneeId = assignee_id === null ? null : parseInt(String(assignee_id), 10);
      if (safeAssigneeId !== null && (isNaN(safeAssigneeId) || safeAssigneeId <= 0)) {
        return res.status(400).json({ error: 'assignee_id inválido' });
      }
      updates.push('assignee_id = ?');
      params.push(safeAssigneeId);
    }
    if (priority) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: 'Prioridade inválida' });
      }
      updates.push('priority = ?');
      params.push(priority);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description ? String(description).slice(0, 2000) : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const query = `UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    await db.run(query, params);

    const updatedOrder = await db.get('SELECT * FROM work_orders WHERE id = ?', id);
    if (!updatedOrder) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating work order:', error);
    res.status(500).json({ error: 'Failed to update work order' });
  }
});

export default router;
