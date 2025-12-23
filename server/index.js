import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from './db.js';

dotenv.config();

const app = express();
const port = Number(process.env.SERVER_PORT || 4000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(uploadDir));

const TABLES = [
  'suppliers',
  'goods',
  'goods_suppliers',
  'rfqs',
  'quotations',
  'sales_orders',
  'invoices',
  'financing',
  'users',
  'activity_logs',
];

const isValidTable = (name) => TABLES.includes(name);

const saveBase64Image = (photoData, filenamePrefix = 'user') => {
  const matches = photoData.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid image data');
  }

  const mimeType = matches[1];
  const extension = mimeType.split('/')[1] || 'png';
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = `${filenamePrefix}-${Date.now()}.${extension}`;
  const filePath = path.join(uploadDir, filename);

  fs.writeFileSync(filePath, buffer);

  return `/uploads/${filename}`;
};

const normalizePhone = (value) => {
  if (value === undefined || value === null) return value;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('62')) return `+${digits}`;
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
  return `+62${digits}`;
};

const sanitizeUserPayload = (payload, allowedFields) => {
  const clean = {};

  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) {
      clean[field] = field === 'phone' ? normalizePhone(payload[field]) : payload[field];
    }
  });

  return clean;
};

const preventOwnerCreation = (role) => role === 'owner';

const logActivity = async ({ performedBy, entityType, entityId, action, description }) => {
  if (!performedBy || !entityType || !entityId || !action) return;

  try {
    await query(
      'INSERT INTO activity_logs (user_id, entity_type, entity_id, action, description) VALUES (?, ?, ?, ?, ?)',
      [performedBy, entityType, entityId, action, description || null]
    );
  } catch (error) {
    console.error('Activity log error', error);
  }
};

const attachSuppliersToGoods = async (goodsRows) => {
  if (!goodsRows.length) return goodsRows;

  const goodsIds = goodsRows.map((good) => good.id);
  const supplierRows = await query(
    `SELECT gs.good_id, s.id, s.name
     FROM goods_suppliers gs
     JOIN suppliers s ON gs.supplier_id = s.id
     WHERE gs.good_id IN (?)`,
    [goodsIds]
  );

  const supplierMap = supplierRows.reduce((acc, row) => {
    if (!acc[row.good_id]) {
      acc[row.good_id] = [];
    }
    acc[row.good_id].push({ id: row.id, name: row.name });
    return acc;
  }, {});

  return goodsRows.map((good) => ({
    ...good,
    suppliers: supplierMap[good.id] || [],
  }));
};

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const rows = await query(
      'SELECT id, email, full_name, role, password, phone, photo_url FROM users WHERE email = ? LIMIT 1',
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
      phone: rows[0].phone,
      photo_url: rows[0].photo_url,
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

    if (table === 'goods') {
      return res.json(rows);
    }

    return res.json(rows);
  } catch (error) {
    console.error('Fetch error', error);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  if (!isValidTable(table)) return res.status(404).json({ error: 'Table not found' });

  try {
    if (table === 'goods') {
      const goodsRows = await query('SELECT * FROM `goods` WHERE id = ? LIMIT 1', [id]);
      if (!goodsRows.length) {
        return res.status(404).json({ error: 'Record not found' });
      }
      const [goodWithSuppliers] = await attachSuppliersToGoods(goodsRows);
      return res.json(goodWithSuppliers);
    }

    const rows = await query('SELECT * FROM ?? WHERE id = ? LIMIT 1', [table, id]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Record not found' });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error('Fetch error', error);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.post('/api/:table', async (req, res) => {
  const { table } = req.params;
  if (!isValidTable(table)) return res.status(404).json({ error: 'Table not found' });

  try {
    const payload = req.body || {};

    if (table === 'goods') {
      const { suppliers = [], performed_by: performedBy, ...goodPayload } = payload;
      const result = await query('INSERT INTO ?? SET ?', [table, goodPayload]);

      if (Array.isArray(suppliers) && suppliers.length > 0) {
        const supplierValues = suppliers.map((supplierId) => [result.insertId, supplierId]);
        await query('INSERT INTO goods_suppliers (good_id, supplier_id) VALUES ?', [supplierValues]);
      }

      const [created] = await attachSuppliersToGoods(
        await query('SELECT * FROM `goods` WHERE id = ?', [result.insertId])
      );

      await logActivity({
        performedBy,
        entityType: 'goods',
        entityId: result.insertId,
        action: 'create',
        description: `Created good ${goodPayload.name}`,
      });
      return res.status(201).json(created);
    }

    if (table === 'suppliers') {
      const { performed_by: performedBy, ...supplierPayload } = payload;

      const result = await query('INSERT INTO ?? SET ?', [table, supplierPayload]);
      const [created] = await query('SELECT * FROM ?? WHERE id = ?', [table, result.insertId]);

      await logActivity({
        performedBy,
        entityType: 'suppliers',
        entityId: result.insertId,
        action: 'create',
        description: `Created supplier ${supplierPayload.name}`,
      });

      return res.status(201).json(created);
    }

    if (table === 'users') {
      if (preventOwnerCreation(payload.role)) {
        return res.status(403).json({ error: 'Owner account cannot be created' });
      }

      const cleanPayload = sanitizeUserPayload(payload, ['full_name', 'email', 'password', 'role', 'phone', 'photo_url']);
      const result = await query('INSERT INTO ?? SET ?', [table, cleanPayload]);
      const [created] = await query('SELECT * FROM ?? WHERE id = ?', [table, result.insertId]);
      return res.status(201).json(created);
    }

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
    if (table === 'goods') {
      const [existingGood] = await query('SELECT * FROM `goods` WHERE id = ? LIMIT 1', [id]);
      if (!existingGood) {
        return res.status(404).json({ error: 'Record not found' });
      }

      const { suppliers = [], performed_by: performedBy, ...goodUpdates } = req.body || {};
      if (Object.keys(goodUpdates).length > 0) {
        await query('UPDATE ?? SET ? WHERE id = ?', [table, goodUpdates, id]);
      }

      await query('DELETE FROM goods_suppliers WHERE good_id = ?', [id]);
      if (Array.isArray(suppliers) && suppliers.length > 0) {
        const supplierValues = suppliers.map((supplierId) => [id, supplierId]);
        await query('INSERT INTO goods_suppliers (good_id, supplier_id) VALUES ?', [supplierValues]);
      }

      const [updated] = await attachSuppliersToGoods(await query('SELECT * FROM `goods` WHERE id = ?', [id]));

      await logActivity({
        performedBy,
        entityType: 'goods',
        entityId: id,
        action: 'update',
        description: `Updated good ${goodUpdates.name || existingGood.name}`,
      });
      return res.json(updated);
    }

    if (table === 'suppliers') {
      const { performed_by: performedBy, ...supplierUpdates } = req.body || {};
      await query('UPDATE ?? SET ? WHERE id = ?', [table, supplierUpdates, id]);
      const [updated] = await query('SELECT * FROM ?? WHERE id = ?', [table, id]);

      await logActivity({
        performedBy,
        entityType: 'suppliers',
        entityId: id,
        action: 'update',
        description: `Updated supplier ${supplierUpdates.name || updated?.name}`,
      });
      return res.json(updated);
    }

    if (table === 'users') {
      const [existing] = await query('SELECT * FROM ?? WHERE id = ? LIMIT 1', [table, id]);
      if (!existing) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (existing.role === 'owner') {
        const updates = sanitizeUserPayload(req.body || {}, ['full_name', 'email', 'password', 'phone', 'photo_url']);
        updates.role = existing.role;

        if (Object.keys(updates).length === 1 && updates.role) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }

        await query('UPDATE ?? SET ? WHERE id = ?', [table, updates, id]);
      } else {
        const updates = sanitizeUserPayload(req.body || {}, ['full_name', 'email', 'password', 'phone', 'role', 'photo_url']);

        if (preventOwnerCreation(updates.role)) {
          return res.status(403).json({ error: 'Cannot promote user to owner' });
        }

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }

        await query('UPDATE ?? SET ? WHERE id = ?', [table, updates, id]);
      }

      const [updated] = await query('SELECT * FROM ?? WHERE id = ?', [table, id]);
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

app.post('/api/users/:id/photo', async (req, res) => {
  const { id } = req.params;
  const { photoData } = req.body || {};

  if (!photoData) {
    return res.status(400).json({ error: 'Photo data is required' });
  }

  try {
    const [existing] = await query('SELECT * FROM ?? WHERE id = ? LIMIT 1', ['users', id]);

    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    const photoUrl = saveBase64Image(photoData, `user-${id}`);

    await query('UPDATE ?? SET ? WHERE id = ?', ['users', { photo_url: photoUrl }, id]);
    return res.json({ photo_url: photoUrl });
  } catch (error) {
    console.error('Photo upload error', error);
    return res.status(500).json({ error: 'Failed to upload photo' });
  }
});

app.delete('/api/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  if (!isValidTable(table)) return res.status(404).json({ error: 'Table not found' });

  try {
    if (table === 'goods') {
      return res.status(403).json({ error: 'Goods cannot be deleted' });
    }

    if (table === 'users') {
      const [target] = await query('SELECT role FROM ?? WHERE id = ? LIMIT 1', [table, id]);
      if (target?.role === 'owner') {
        return res.status(403).json({ error: 'Owner account cannot be deleted' });
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
