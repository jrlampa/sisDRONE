import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { signToken, comparePassword } from '../services/authService';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
