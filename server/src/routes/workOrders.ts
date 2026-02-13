import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { WorkOrder } from '../types';

const router = Router();

// GET /api/work-orders - List all work orders
router.get('/', async (req: Request, res: Response) => {
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
      query += ` AND w.status = ?`;
      params.push(status);
    }

    if (assignee_id) {
      query += ` AND w.assignee_id = ?`;
      params.push(assignee_id);
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, priority, assignee_id, pole_id, due_date } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const db = await getDb();
    const result = await db.run(
      `INSERT INTO work_orders (title, description, priority, assignee_id, pole_id, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description, priority || 'MED', assignee_id, pole_id, due_date]
    );

    const newOrder = await db.get('SELECT * FROM work_orders WHERE id = ?', result.lastID);
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({ error: 'Failed to create work order' });
  }
});

// PUT /api/work-orders/:id - Update status or assignment
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, assignee_id, priority, description } = req.body;
    const db = await getDb();

    // Dynamically build update query
    const updates: string[] = [];
    const params: any[] = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (assignee_id !== undefined) {
      updates.push('assignee_id = ?');
      params.push(assignee_id);
    }
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (description) {
      updates.push('description = ?');
      params.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const query = `UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    await db.run(query, params);

    const updatedOrder = await db.get('SELECT * FROM work_orders WHERE id = ?', id);
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating work order:', error);
    res.status(500).json({ error: 'Failed to update work order' });
  }
});

export default router;
