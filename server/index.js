import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './db.js';

dotenv.config();

const app = express();
const port = Number(process.env.SERVER_PORT || 4000);

app.use(cors());
app.use(express.json());

const TABLES = [
  'suppliers',
  'goods',
  'rfqs',
  'quotations',
  'sales_orders',
  'invoices',
  'financing',
  'users',
];

const isValidTable = (name) => TABLES.includes(name);

const OWNER_ROLE = 'owner';

const normalizePhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const withoutCountry = digits.startsWith('62') ? digits.slice(2) : digits.startsWith('0') ? digits.slice(1) : digits;
  return `+62${withoutCountry}`;
};

const buildUpdate = (allowedKeys, payload) => {
  const updates = [];
  const params = [];

  allowedKeys.forEach((key) => {
    if (payload[key] !== undefined) {
      updates.push(`\`${key}\` = ?`);
      params.push(payload[key]);
    }
  });

  return { updates, params };
};

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const rows = await query(
      'SELECT id, email, full_name, role, password FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0 || rows[0].password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const profile = {
      id: rows[0].id,
      email: rows[0].email,
      full_name: rows[0].full_name,
      role: rows[0].role,
    };

    return res.json({ profile });
  } catch (error) {
    console.error('Login error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/:table', async (req, res) => {
  const { table } = req.params;
  if (!isValidTable(table)) return res.status(404).json({ error: 'Table not found' });

  try {
    const rows = await query(`SELECT * FROM \`${table}\` ORDER BY created_at DESC`);
    return res.json(rows);
  } catch (error) {
    console.error('Fetch error', error);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.post('/api/:table', async (req, res) => {
  const { table } = req.params;
  if (!isValidTable(table)) return res.status(404).json({ error: 'Table not found' });

  try {
    if (table === 'users') {
      const { full_name, email, password, role = 'staff', phone } = req.body || {};

      if (!full_name || !email || !password) {
        return res.status(400).json({ error: 'Full name, email, and password are required' });
      }

      if (role === OWNER_ROLE) {
        const existingOwner = await query('SELECT id FROM `users` WHERE role = ? LIMIT 1', [OWNER_ROLE]);
        if (existingOwner.length > 0) {
          return res.status(400).json({ error: 'Owner account already exists and cannot be duplicated' });
        }
      }

      const formattedPhone = normalizePhone(phone);
      const result = await query(
        'INSERT INTO `users` (`full_name`, `email`, `password`, `role`, `phone`) VALUES (?,?,?,?,?)',
        [full_name, email, password, role, formattedPhone]
      );

      const [created] = await query('SELECT * FROM `users` WHERE id = ?', [result.insertId]);
      return res.status(201).json(created);
    }

    const payload = req.body || {};
    const result = await query('INSERT INTO ?? SET ?', [table, payload]);
    const [created] = await query('SELECT * FROM ?? WHERE id = ?', [table, result.insertId]);
    return res.status(201).json(created);
  } catch (error) {
    console.error('Insert error', error);
    return res.status(500).json({ error: 'Failed to create record' });
  }
});

app.put('/api/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  if (!isValidTable(table)) return res.status(404).json({ error: 'Table not found' });

  try {
    if (table === 'users') {
      const [existing] = await query('SELECT * FROM `users` WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'User not found' });
      }

      const incoming = req.body || {};
      const formattedPhone = normalizePhone(incoming.phone);
      const payload = { ...incoming, phone: formattedPhone };

      if (existing.role === OWNER_ROLE) {
        const { updates, params } = buildUpdate(['full_name', 'email', 'password', 'phone'], payload);

        if (updates.length === 0) {
          const [unchanged] = await query('SELECT * FROM `users` WHERE id = ?', [id]);
          return res.json(unchanged);
        }

        await query(`UPDATE \`users\` SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);
        const [updatedOwner] = await query('SELECT * FROM `users` WHERE id = ?', [id]);
        return res.json(updatedOwner);
      }

      const { updates, params } = buildUpdate(['full_name', 'email', 'password', 'role', 'phone'], payload);

      if (payload.role === OWNER_ROLE) {
        const existingOwner = await query('SELECT id FROM `users` WHERE role = ? LIMIT 1', [OWNER_ROLE]);
        if (existingOwner.length > 0 && existingOwner[0].id !== Number(id)) {
          return res.status(400).json({ error: 'Owner account already exists and cannot be duplicated' });
        }
      }

      if (updates.length === 0) {
        const [unchanged] = await query('SELECT * FROM `users` WHERE id = ?', [id]);
        return res.json(unchanged);
      }

      await query(`UPDATE \`users\` SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);
      const [updated] = await query('SELECT * FROM `users` WHERE id = ?', [id]);
      return res.json(updated);
    }

    await query('UPDATE ?? SET ? WHERE id = ?', [table, req.body || {}, id]);
    const [updated] = await query('SELECT * FROM ?? WHERE id = ?', [table, id]);
    return res.json(updated);
  } catch (error) {
    console.error('Update error', error);
    return res.status(500).json({ error: 'Failed to update record' });
  }
});

app.delete('/api/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  if (!isValidTable(table)) return res.status(404).json({ error: 'Table not found' });

  try {
    if (table === 'users') {
      const [existing] = await query('SELECT role FROM `users` WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (existing.role === OWNER_ROLE) {
        return res.status(400).json({ error: 'Owner account cannot be deleted' });
      }
    }

    await query('DELETE FROM ?? WHERE id = ?', [table, id]);
    return res.status(204).send();
  } catch (error) {
    console.error('Delete error', error);
    return res.status(500).json({ error: 'Failed to delete record' });
  }
});

app.listen(port, () => {
  console.log(`RGI NexaProc API listening on port ${port}`);
});
