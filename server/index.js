import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import net from 'net';
import tls from 'tls';
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

const saveBase64File = (fileData, filenamePrefix = 'upload') => {
  const matches = fileData.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid file data');
  }

  const mimeType = matches[1];
  const extension = mimeType.split('/')[1] || 'bin';
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = `${filenamePrefix}-${Date.now()}.${extension}`;
  const filePath = path.join(uploadDir, filename);

  fs.writeFileSync(filePath, buffer);

  return `/uploads/${filename}`;
};

const saveBase64Image = (photoData, filenamePrefix = 'user') => saveBase64File(photoData, filenamePrefix);

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

const scryptAsync = promisify(crypto.scrypt);
const PASSWORD_HASH_PREFIX = 'scrypt$';

const isPasswordHashed = (value) => typeof value === 'string' && value.startsWith(PASSWORD_HASH_PREFIX);

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${PASSWORD_HASH_PREFIX}${salt}:${derivedKey.toString('hex')}`;
};

const verifyPassword = async (password, storedHash) => {
  if (!storedHash) return false;
  if (!isPasswordHashed(storedHash)) {
    return storedHash === password;
  }
  const [prefixSalt, storedKey] = storedHash.split(':');
  if (!prefixSalt || !storedKey) return false;
  const salt = prefixSalt.replace(PASSWORD_HASH_PREFIX, '');
  const derivedKey = await scryptAsync(password, salt, 64);
  try {
    return crypto.timingSafeEqual(Buffer.from(storedKey, 'hex'), derivedKey);
  } catch (error) {
    console.error('Password compare error', error);
    return false;
  }
};

const preventSuperadminCreation = (role) => role === 'superadmin';

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

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordValid = await verifyPassword(password, rows[0].password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!isPasswordHashed(rows[0].password)) {
      try {
        const hashed = await hashPassword(password);
        await query('UPDATE users SET password = ? WHERE id = ?', [hashed, rows[0].id]);
      } catch (error) {
        console.error('Password upgrade error', error);
      }
    }

    const profile = {
      id: rows[0].id,
      email: rows[0].email,
      full_name: rows[0].full_name,
      role: rows[0].role,
      phone: rows[0].phone,
      photo_url: rows[0].photo_url,
    };

    await logActivity({
      performedBy: rows[0].id,
      entityType: 'auth',
      entityId: rows[0].id,
      action: 'login',
      description: 'User logged in',
    });

    return res.json({ profile });
  } catch (error) {
    console.error('Login error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const { user_id: userId } = req.body || {};

  try {
    await logActivity({
      performedBy: userId,
      entityType: 'auth',
      entityId: userId || 0,
      action: 'logout',
      description: 'User logged out',
    });
  } catch (error) {
    console.error('Logout log error', error);
  }

  return res.json({ success: true });
});

const createSmtpClient = async ({ host, port, secure, socket: existingSocket, expectGreeting = true }) => {
  const socket =
    existingSocket ||
    (secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port }));

  socket.setEncoding('utf8');

  let buffer = '';
  const pending = [];

  const processLine = (line) => {
    if (!line) return;
    const code = Number(line.slice(0, 3));
    const isFinal = line[3] === ' ';

    if (!pending.length) return;
    const current = pending[0];
    current.lines.push(line);

    if (isFinal) {
      pending.shift();
      if (current.expectedCodes && !current.expectedCodes.includes(code)) {
        current.reject(new Error(`SMTP error ${code}: ${line}`));
      } else {
        current.resolve({ code, line, lines: current.lines });
      }
    }
  };

  socket.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    lines.forEach(processLine);
  });

  socket.on('error', (error) => {
    while (pending.length) {
      pending.shift().reject(error);
    }
  });

  const waitForResponse = (expectedCodes) =>
    new Promise((resolve, reject) => {
      pending.push({ resolve, reject, expectedCodes, lines: [] });
    });

  const sendCommand = async (command, expectedCodes) => {
    if (command) {
      socket.write(`${command}\r\n`);
    }
    return waitForResponse(expectedCodes);
  };

  if (expectGreeting) {
    await waitForResponse([220]);
  }

  return { socket, sendCommand, waitForResponse };
};

const sendSmtpMail = async ({ to, subject, html }) => {
  const host = process.env.MAIL_HOST;
  const port = Number(process.env.MAIL_PORT || 0);
  const encryption = process.env.MAIL_ENCRYPTION;
  const user = process.env.MAIL_USERNAME;
  const pass = process.env.MAIL_PASSWORD;
  const senderEmail = process.env.MAIL_FROM_ADDRESS;
  const senderName = process.env.MAIL_FROM_NAME || 'RGI NexaProc';

  if (!host || !port || !senderEmail) {
    throw new Error('SMTP configuration missing');
  }

  const secure = encryption === 'ssl' || port === 465;
  let client = await createSmtpClient({ host, port, secure });

  await client.sendCommand(`EHLO ${host}`, [250]);

  if (!secure && encryption === 'tls') {
    await client.sendCommand('STARTTLS', [220]);
    client.socket.removeAllListeners('data');
    client.socket.removeAllListeners('error');
    const secureSocket = tls.connect({ socket: client.socket, servername: host });
    secureSocket.setEncoding('utf8');
    client = await createSmtpClient({
      host,
      port,
      secure: true,
      socket: secureSocket,
      expectGreeting: false,
    });
    await client.sendCommand(`EHLO ${host}`, [250]);
  }

  if (user || pass) {
    await client.sendCommand('AUTH LOGIN', [334]);
    await client.sendCommand(Buffer.from(user || '').toString('base64'), [334]);
    await client.sendCommand(Buffer.from(pass || '').toString('base64'), [235]);
  }

  await client.sendCommand(`MAIL FROM:<${senderEmail}>`, [250]);
  await client.sendCommand(`RCPT TO:<${to}>`, [250, 251]);
  await client.sendCommand('DATA', [354]);

  const message = [
    `From: ${senderName} <${senderEmail}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html,
    '.',
  ].join('\r\n');

  await client.sendCommand(message, [250]);
  await client.sendCommand('QUIT', [221]);
  client.socket.end();
};

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const [user] = await query('SELECT id, email, full_name FROM users WHERE email = ? LIMIT 1', [email]);

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

      await query('INSERT INTO password_resets SET ?', {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
      const resetLink = `${appBaseUrl}/?reset_token=${token}`;

      await sendSmtpMail({
        to: user.email,
        subject: 'Reset Password - RGI NexaProc',
        html: `
          <p>Halo ${user.full_name || 'User'},</p>
          <p>Klik tautan berikut untuk mengganti password Anda:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>Tautan ini berlaku selama 1 jam.</p>
        `,
      });
    }

    return res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error', error);
    return res.status(500).json({ error: 'Failed to process reset request' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body || {};

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [resetEntry] = await query(
      'SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [tokenHash]
    );

    if (!resetEntry) {
      return res.status(400).json({ error: 'Reset token is invalid or expired' });
    }

    const hashedPassword = await hashPassword(password);
    await query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, resetEntry.user_id]);
    await query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [resetEntry.id]);

    await logActivity({
      performedBy: resetEntry.user_id,
      entityType: 'auth',
      entityId: resetEntry.user_id,
      action: 'reset_password',
      description: 'User reset password via email link',
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Reset password error', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.get('/api/:table', async (req, res) => {
  const { table } = req.params;
  if (!isValidTable(table)) return res.status(404).json({ error: 'Table not found' });

  try {
    if (table === 'activity_logs') {
      const { user_id: userId } = req.query;
      const rows = userId
        ? await query('SELECT * FROM `activity_logs` WHERE user_id = ? ORDER BY created_at DESC', [userId])
        : await query('SELECT * FROM `activity_logs` ORDER BY created_at DESC');
      return res.json(rows);
    }

    if (table === 'rfqs') {
      const rows = await query('SELECT * FROM `rfqs` ORDER BY created_at DESC');
      const goodsRows = await query('SELECT id, name FROM `goods`');
      const goodsMap = goodsRows.reduce((acc, row) => ({ ...acc, [row.id]: row.name }), {});

      const parsed = rows.map((row) => {
        let goods = [];
        try {
          goods = JSON.parse(row.goods || '[]');
        } catch {
          goods = [];
        }

        const mappedGoods = goods.map((item) => ({
          ...item,
          display_name: item.type === 'existing' ? goodsMap[item.good_id] || item.name || 'Existing good' : item.name,
        }));

        return { ...row, goods: mappedGoods };
      });

      return res.json(parsed);
    }

    if (table === 'quotations') {
      const rows = await query('SELECT * FROM `quotations` ORDER BY created_at DESC');
      const parsed = rows.map((row) => {
        let goods = [];
        try {
          goods = JSON.parse(row.goods || '[]');
        } catch {
          goods = [];
        }

        return { ...row, goods };
      });

      return res.json(parsed);
    }

    if (table === 'goods') {
      const rows = await attachSuppliersToGoods(await query('SELECT * FROM `goods` ORDER BY created_at DESC'));
      return res.json(rows);
    }

    const rows = await query(`SELECT * FROM \`${table}\` ORDER BY created_at DESC`);

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

    if (table === 'rfqs') {
      const rows = await query('SELECT * FROM `rfqs` WHERE id = ? LIMIT 1', [id]);
      if (!rows.length) {
        return res.status(404).json({ error: 'Record not found' });
      }

      let goods = [];
      try {
        goods = JSON.parse(rows[0].goods || '[]');
      } catch {
        goods = [];
      }

      return res.json({ ...rows[0], goods });
    }

    if (table === 'quotations') {
      const rows = await query('SELECT * FROM `quotations` WHERE id = ? LIMIT 1', [id]);
      if (!rows.length) {
        return res.status(404).json({ error: 'Record not found' });
      }

      let goods = [];
      try {
        goods = JSON.parse(rows[0].goods || '[]');
      } catch {
        goods = [];
      }

      return res.json({ ...rows[0], goods });
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

    if (table === 'activity_logs') {
      const { user_id: userId, entity_type, entity_id, action, description } = payload;
      if (!userId || !entity_type || !entity_id || !action) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const result = await query(
        'INSERT INTO activity_logs (user_id, entity_type, entity_id, action, description) VALUES (?, ?, ?, ?, ?)',
        [userId, entity_type, entity_id, action, description || null],
      );
      const [created] = await query('SELECT * FROM activity_logs WHERE id = ?', [result.insertId]);
      return res.status(201).json(created);
    }

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

    if (table === 'rfqs') {
      const { goods = [], attachment_data: attachmentData, performed_by: performedBy, performer_role: performerRole, ...rfqPayload } = payload;
      let attachmentUrl = null;

      if (attachmentData) {
        attachmentUrl = saveBase64File(attachmentData, 'rfq');
      }

      const cleanedGoods = Array.isArray(goods)
        ? goods.map((item) => ({
            type: item.type || (item.good_id ? 'existing' : 'other'),
            good_id: item.good_id || null,
            name: item.name || null,
          }))
        : [];

      const result = await query('INSERT INTO ?? SET ?', [
        table,
        {
          ...rfqPayload,
          performed_by: performedBy || null,
          goods: JSON.stringify(cleanedGoods),
          attachment_url: attachmentUrl,
        },
      ]);
      const [created] = await query('SELECT * FROM ?? WHERE id = ?', [table, result.insertId]);

      await logActivity({
        performedBy,
        entityType: 'rfqs',
        entityId: result.insertId,
        action: 'create',
        description: `Created RFQ ${rfqPayload.rfq_number || rfqPayload.title || result.insertId}`,
      });

      return res.status(201).json({ ...created, goods: cleanedGoods, attachment_url: attachmentUrl });
    }

    if (table === 'quotations') {
      const { goods = [], rfq_id: rfqId, ...quotationPayload } = payload;
      const cleanedGoods = Array.isArray(goods)
        ? goods.map((item) => ({
            good_id: item.good_id || null,
            name: item.name || null,
            description: item.description || null,
            unit: item.unit || null,
            qty: item.qty || 0,
            price: item.price || 0,
          }))
        : [];
      const status = quotationPayload.status || 'waiting';

      const result = await query('INSERT INTO ?? SET ?', [
        table,
        {
          ...quotationPayload,
          rfq_id: rfqId || null,
          goods: JSON.stringify(cleanedGoods),
          status,
        },
      ]);
      const [created] = await query('SELECT * FROM ?? WHERE id = ?', [table, result.insertId]);

      if (rfqId) {
        await query('UPDATE `rfqs` SET status = ? WHERE id = ?', ['process', rfqId]);
      }

      return res.status(201).json({ ...created, goods: cleanedGoods });
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
      if (preventSuperadminCreation(payload.role)) {
        return res.status(403).json({ error: 'Superadmin account cannot be created' });
      }

      const cleanPayload = sanitizeUserPayload(payload, ['full_name', 'email', 'password', 'role', 'phone', 'photo_url']);
      if (cleanPayload.password) {
        cleanPayload.password = await hashPassword(cleanPayload.password);
      }
      const result = await query('INSERT INTO ?? SET ?', [table, cleanPayload]);
      const [created] = await query('SELECT * FROM ?? WHERE id = ?', [table, result.insertId]);

      if (payload.performed_by && ['superadmin', 'admin', 'manager'].includes(payload.creator_role)) {
        await logActivity({
          performedBy: payload.performed_by,
          entityType: 'users',
          entityId: result.insertId,
          action: 'create',
          description: `Created user ${cleanPayload.full_name}`,
        });
      }

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
    if (table === 'quotations') {
      const { goods = [], rfq_id: rfqId, ...quotationUpdates } = req.body || {};
      const cleanedGoods = Array.isArray(goods)
        ? goods.map((item) => ({
            good_id: item.good_id || null,
            name: item.name || null,
            description: item.description || null,
            unit: item.unit || null,
            qty: item.qty || 0,
            price: item.price || 0,
          }))
        : [];

      await query('UPDATE ?? SET ? WHERE id = ?', [
        table,
        {
          ...quotationUpdates,
          rfq_id: rfqId || null,
          goods: JSON.stringify(cleanedGoods),
        },
        id,
      ]);
      const [updated] = await query('SELECT * FROM ?? WHERE id = ?', [table, id]);
      return res.json({ ...updated, goods: cleanedGoods });
    }

    if (table === 'rfqs') {
      const { goods = [], attachment_data: attachmentData, performed_by: performedBy, performer_role: performerRole, ...rfqUpdates } = req.body || {};
      const [existing] = await query('SELECT * FROM `rfqs` WHERE id = ? LIMIT 1', [id]);

      if (!existing) {
        return res.status(404).json({ error: 'Record not found' });
      }

      if (existing.status === 'process') {
        return res.status(403).json({ error: 'RFQ is already in process and cannot be edited' });
      }
      const allowedRoles = ['superadmin', 'admin', 'manager'];
      const isPrivileged = performerRole && allowedRoles.includes(performerRole);
      const isRequester =
        performedBy &&
        existing.performed_by &&
        String(existing.performed_by) === String(performedBy);
      if (!isPrivileged && !isRequester) {
        return res.status(403).json({ error: 'Not authorized to edit this RFQ' });
      }

      let attachmentUrl = existing.attachment_url;
      if (attachmentData) {
        attachmentUrl = saveBase64File(attachmentData, `rfq-${id}`);
      }

      const cleanedGoods = Array.isArray(goods)
        ? goods.map((item) => ({
            type: item.type || (item.good_id ? 'existing' : 'other'),
            good_id: item.good_id || null,
            name: item.name || null,
          }))
        : JSON.parse(existing.goods || '[]');

      await query('UPDATE ?? SET ? WHERE id = ?', [table, { ...rfqUpdates, goods: JSON.stringify(cleanedGoods), attachment_url: attachmentUrl }, id]);
      const [updated] = await query('SELECT * FROM ?? WHERE id = ?', [table, id]);

      await logActivity({
        performedBy,
        entityType: 'rfqs',
        entityId: id,
        action: 'update',
        description: `Updated RFQ ${rfqUpdates.rfq_number || updated?.rfq_number || id}`,
      });

      return res.json({ ...updated, goods: cleanedGoods });
    }

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

      if (existing.role === 'superadmin') {
        const updates = sanitizeUserPayload(req.body || {}, ['full_name', 'email', 'password', 'phone', 'photo_url']);
        updates.role = existing.role;

        if (Object.keys(updates).length === 1 && updates.role) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }

        if (updates.password) {
          updates.password = await hashPassword(updates.password);
        }

        await query('UPDATE ?? SET ? WHERE id = ?', [table, updates, id]);
      } else {
        const updates = sanitizeUserPayload(req.body || {}, ['full_name', 'email', 'password', 'phone', 'role', 'photo_url']);

        if (preventSuperadminCreation(updates.role)) {
          return res.status(403).json({ error: 'Cannot promote user to superadmin' });
        }

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }

        if (updates.password) {
          updates.password = await hashPassword(updates.password);
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
    const { performed_by: performedBy } = req.body || {};

    if (table === 'goods') {
      return res.status(403).json({ error: 'Goods cannot be deleted' });
    }

    if (table === 'users') {
      const [target] = await query('SELECT role FROM ?? WHERE id = ? LIMIT 1', [table, id]);
      if (target?.role === 'superadmin') {
        return res.status(403).json({ error: 'Superadmin account cannot be deleted' });
      }
    }
    if (table === 'suppliers') {
      await logActivity({
        performedBy,
        entityType: 'suppliers',
        entityId: id,
        action: 'delete',
        description: `Deleted supplier ${id}`,
      });
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
