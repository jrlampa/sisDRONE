import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { signToken, comparePassword, hashPassword } from '../services/authService';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

const VALID_ROLES = ['ADMIN', 'ENGINEER', 'VIEWER'] as const;

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, user }
 */
router.post('/login', rateLimit(10, 60_000), async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  const safeUsername = username.trim().slice(0, 100);

  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [safeUsername]);

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isValid = await comparePassword(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenant_id
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tenant_id: user.tenant_id
      }
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

/**
 * POST /api/auth/register
 * Body: { username, password, tenant_id?, role? }
 * Returns: { token, user }
 */
router.post('/register', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  const { username, password, tenant_id, role } = req.body;

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ error: 'Usuário deve ter pelo menos 3 caracteres' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
  }

  const safeUsername = username.trim().slice(0, 100).replace(/[^a-zA-Z0-9_.-]/g, '');
  if (safeUsername.length < 3) {
    return res.status(400).json({ error: 'Usuário contém caracteres inválidos' });
  }

  const safeRole = role && VALID_ROLES.includes(role) ? role : 'VIEWER';
  const safeTenantId = tenant_id ? parseInt(String(tenant_id), 10) : 1;
  if (isNaN(safeTenantId) || safeTenantId <= 0) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  try {
    const db = await getDb();
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [safeUsername]);
    if (existing) {
      return res.status(409).json({ error: 'Nome de usuário já está em uso' });
    }

    const password_hash = await hashPassword(password);
    const result = await db.run(
      'INSERT INTO users (username, role, tenant_id, password_hash) VALUES (?, ?, ?, ?)',
      [safeUsername, safeRole, safeTenantId, password_hash]
    );

    const token = signToken({
      userId: result.lastID!,
      username: safeUsername,
      role: safeRole,
      tenantId: safeTenantId,
    });

    res.status(201).json({
      token,
      user: {
        id: result.lastID,
        username: safeUsername,
        role: safeRole,
        tenant_id: safeTenantId,
      },
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
});

/**
 * POST /api/auth/change-password
 * Body: { username, currentPassword, newPassword }
 * Returns: { message }
 */
router.post('/change-password', rateLimit(10, 60_000), async (req: Request, res: Response) => {
  const { username, currentPassword, newPassword } = req.body;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Usuário é obrigatório' });
  }
  if (!currentPassword || typeof currentPassword !== 'string') {
    return res.status(400).json({ error: 'Senha atual é obrigatória' });
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Nova senha deve ter pelo menos 8 caracteres' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'Nova senha deve ser diferente da senha atual' });
  }

  const safeUsername = username.trim().slice(0, 100);

  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [safeUsername]);

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isValid = await comparePassword(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const newHash = await hashPassword(newPassword);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
