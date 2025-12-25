import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import net from 'net';
import tls from 'tls';
import { loadEnv, query } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv();

const app = express();
const port = Number(process.env.PORT || process.env.SERVER_PORT || 4000);
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '15mb' }));
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

const normalizeDocumentsPayload = (documents = [], filenamePrefix = 'document') => {
  if (!Array.isArray(documents)) return [];
  return documents
    .map((doc) => {
      if (!doc) return null;
      if (doc.url) {
        return { name: doc.name || 'document', url: doc.url };
      }
      if (doc.data && typeof doc.data === 'string') {
        try {
          const url = saveBase64File(doc.data, filenamePrefix);
          return { name: doc.name || 'document', url };
        } catch (error) {
          console.error('Failed to save document', error);
          return null;
        }
      }
      return null;
    })
    .filter(Boolean);
};

const normalizePhone = (value) => {
  if (value === undefined || value === null) return value;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('62')) return `+${digits}`;
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
  return `+62${digits}`;
};

const normalizeUsername = (value) => {
  if (value === undefined || value === null) return value;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.toLowerCase() : null;
};

const sanitizeUserPayload = (payload, allowedFields) => {
  const clean = {};

  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) {
      if (field === 'phone') {
        clean[field] = normalizePhone(payload[field]);
        return;
      }
      if (field === 'username') {
        clean[field] = normalizeUsername(payload[field]);
        return;
      }
      clean[field] = payload[field];
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

const generateDefaultPassword = () => crypto.randomBytes(6).toString('base64url');

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
  const { identifier, email, password } = req.body;
  const loginIdentifier = identifier || email;

  if (!loginIdentifier || !password) {
    return res.status(400).json({ error: 'Email/username and password are required' });
  }

  try {
    const rows = await query(
      'SELECT id, email, full_name, role, password, phone, photo_url, username, password_reset_required FROM users WHERE email = ? OR username = ? LIMIT 1',
      [loginIdentifier, normalizeUsername(loginIdentifier)]
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
      username: rows[0].username,
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
    const requiresSetup = !rows[0].username || rows[0].password_reset_required === 1;
    return res.json({ profile, requires_setup: requiresSetup });
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

app.post('/api/auth/complete-setup', async (req, res) => {
  const { user_id: userId, current_password: currentPassword, username, password } = req.body || {};

  if (!userId || !currentPassword || !username || !password) {
    return res.status(400).json({ error: 'User, current password, username, and new password are required' });
  }

  try {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const [user] = await query('SELECT id, password, username FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordValid = await verifyPassword(currentPassword, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const [existingUsername] = await query(
      'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1',
      [normalizedUsername, userId]
    );
    if (existingUsername) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    const hashedPassword = await hashPassword(password);
    await query(
      'UPDATE users SET username = ?, password = ?, password_reset_required = 0 WHERE id = ?',
      [normalizedUsername, hashedPassword, userId]
    );

    await logActivity({
      performedBy: userId,
      entityType: 'auth',
      entityId: userId,
      action: 'complete_setup',
      description: 'User completed initial setup',
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Complete setup error', error);
    return res.status(500).json({ error: 'Failed to complete setup' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body || {};
  const googleClientId = process.env.GOOGLE_CLIENT_ID;

  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required' });
  }
  if (!googleClientId) {
    return res.status(500).json({ error: 'Google client ID is not configured' });
  }

  try {
    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    const tokenInfo = await tokenInfoResponse.json();
    if (!tokenInfoResponse.ok) {
      return res.status(401).json({ error: tokenInfo?.error_description || 'Invalid Google token' });
    }
    if (tokenInfo.aud !== googleClientId) {
      return res.status(401).json({ error: 'Invalid Google token audience' });
    }

    const email = tokenInfo.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Google account has no email' });
    }

    const rows = await query(
      'SELECT id, email, full_name, role, phone, photo_url, username, password_reset_required FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'No user found for this Google account' });
    }

    const profile = {
      id: rows[0].id,
      email: rows[0].email,
      username: rows[0].username,
      full_name: rows[0].full_name,
      role: rows[0].role,
      phone: rows[0].phone,
      photo_url: rows[0].photo_url,
    };

    await logActivity({
      performedBy: rows[0].id,
      entityType: 'auth',
      entityId: rows[0].id,
      action: 'login_google',
      description: 'User logged in with Google',
    });

    const requiresSetup = !rows[0].username || rows[0].password_reset_required === 1;
    return res.json({ profile, requires_setup: requiresSetup });
  } catch (error) {
    console.error('Google login error', error);
    return res.status(500).json({ error: 'Failed to login with Google' });
  }
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

const wrapSmtpLines = (content, maxLength = 998) => {
  if (!content) return '';
  return content
    .split(/\r?\n/)
    .flatMap((line) => {
      if (line.length <= maxLength) return [line];
      const chunks = [];
      let remaining = line;
      while (remaining.length > maxLength) {
        chunks.push(remaining.slice(0, maxLength));
        remaining = remaining.slice(maxLength);
      }
      if (remaining.length) chunks.push(remaining);
      return chunks;
    })
    .join('\r\n');
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

  const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1] : host;
  const messageId = `<${Date.now()}.${crypto.randomBytes(16).toString('hex')}@${senderDomain || 'localhost'}>`;
  const safeHtml = wrapSmtpLines(html);
  const message = [
    `From: ${senderName} <${senderEmail}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    safeHtml,
    '.',
  ].join('\r\n');

  await client.sendCommand(message, [250]);
  await client.sendCommand('QUIT', [221]);
  client.socket.end();
};

const getRoleEmails = async (roles) => {
  const rows = await query('SELECT email FROM users WHERE role IN (?)', [roles]);
  const emails = rows.map((row) => row.email).filter(Boolean);
  return Array.from(new Set(emails));
};

const getUserById = async (id) => {
  if (!id) return null;
  const [user] = await query('SELECT id, email, full_name, role FROM users WHERE id = ? LIMIT 1', [id]);
  return user || null;
};

const getRfqById = async (id) => {
  if (!id) return null;
  const [rfq] = await query(
    'SELECT id, rfq_number, company_name, pic_name, pic_email, pic_phone FROM rfqs WHERE id = ? LIMIT 1',
    [id]
  );
  return rfq || null;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(value || 0));

const formatStatusLabel = (status) => {
  const map = {
    waiting: 'Waiting',
    negotiation: 'Negotiation',
    renegotiation: 'Renegotiation',
    rejected: 'Rejected',
    process: 'Processed',
    approved: 'Approved',
  };
  return map[status] || status || '-';
};

const buildQuotationEmailHtml = ({ quotation, goods, requester, rfq, statusLabel }) => {
  const rows = Array.isArray(goods) ? goods : [];
  const goodsRows = rows.length
    ? rows
        .map(
          (item, index) => `
            <tr>
              <td style="padding:8px;border:1px solid #e2e8f0;">${index + 1}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;">${item.name || item.description || '-'}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;">${item.unit || '-'}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;">${item.qty ?? 0}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;">${formatCurrency(item.price)}</td>
            </tr>
          `
        )
        .join('')
    : `
        <tr>
          <td colspan="5" style="padding:8px;border:1px solid #e2e8f0;text-align:center;">Tidak ada item</td>
        </tr>
      `;

  return `
    <p>Halo Tim,</p>
    <p>Berikut update quotation dengan status <strong>${formatStatusLabel(statusLabel)}</strong>.</p>
    <h3>Informasi Quotation</h3>
    <table style="border-collapse:collapse;width:100%;max-width:720px;">
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">Nomor Quotation</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${quotation.quotation_number || '-'}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">Status</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${formatStatusLabel(statusLabel)}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">Perusahaan</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${quotation.company_name || rfq?.company_name || '-'}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">Project</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${quotation.project_name || rfq?.project_name || '-'}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">PIC</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${quotation.pic_name || rfq?.pic_name || '-'}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">Email PIC</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${quotation.pic_email || rfq?.pic_email || '-'}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">Telepon PIC</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${quotation.pic_phone || rfq?.pic_phone || '-'}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">Delivery Time</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${quotation.delivery_time || '-'}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">Payment Time</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${quotation.payment_time || '-'}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">Total</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${formatCurrency(quotation.total_amount)}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">PPN</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${formatCurrency(quotation.tax_amount)}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">Grand Total</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${formatCurrency(quotation.grand_total)}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">RFQ</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${rfq?.rfq_number || quotation.rfq_id || '-'}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">Diajukan oleh</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${requester?.full_name || 'User'} ${requester?.email ? `(${requester.email})` : ''}</td></tr>
    </table>
    <h3>Item Barang</h3>
    <table style="border-collapse:collapse;width:100%;max-width:720px;">
      <thead>
        <tr>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">No</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Nama</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Unit</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Qty</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Harga</th>
        </tr>
      </thead>
      <tbody>
        ${goodsRows}
      </tbody>
    </table>
    <p>Terima kasih.</p>
  `;
};

const sendQuotationNotification = async ({ quotation, goods, statusLabel, recipients, requester, rfq }) => {
  try {
    const uniqueRecipients = Array.from(new Set((recipients || []).filter(Boolean)));
    if (!uniqueRecipients.length) return;
    const subject = `Quotation ${quotation.quotation_number || quotation.id} - ${formatStatusLabel(statusLabel)}`;
    const html = buildQuotationEmailHtml({ quotation, goods, requester, rfq, statusLabel });
    await Promise.allSettled(
      uniqueRecipients.map((email) =>
        sendSmtpMail({
          to: email,
          subject,
          html,
        })
      )
    );
  } catch (error) {
    console.error('Quotation notification error', error);
  }
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
      const {
        goods = [],
        rfq_id: rfqId,
        performed_by: performedBy,
        performer_role: performerRole,
        ...quotationPayload
      } = payload;
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
      const cleanedQuotationPayload = { ...quotationPayload };
      delete cleanedQuotationPayload.performer_role;
      delete cleanedQuotationPayload.performerRole;
      const status = cleanedQuotationPayload.status || 'waiting';

      const result = await query('INSERT INTO ?? SET ?', [
        table,
        {
          ...cleanedQuotationPayload,
          rfq_id: rfqId || null,
          goods: JSON.stringify(cleanedGoods),
          status,
          negotiation_round: 0,
          performed_by: performedBy || null,
        },
      ]);
      const [created] = await query('SELECT * FROM ?? WHERE id = ?', [table, result.insertId]);

      if (rfqId) {
        await query('UPDATE `rfqs` SET status = ? WHERE id = ?', ['process', rfqId]);
      }

      await logActivity({
        performedBy,
        entityType: 'quotations',
        entityId: result.insertId,
        action: 'create',
        description: `Created quotation ${cleanedQuotationPayload.quotation_number || result.insertId}`,
      });

      if (status === 'waiting') {
        const requester = await getUserById(performedBy);
        const rfq = await getRfqById(rfqId);
        const roleEmails = await getRoleEmails(['superadmin', 'manager']);
        const requesterEmail = requester?.email ? requester.email.toLowerCase() : null;
        const recipients = roleEmails.filter((email) => email.toLowerCase() !== requesterEmail);
        await sendQuotationNotification({
          quotation: created,
          goods: cleanedGoods,
          statusLabel: 'waiting',
          recipients,
          requester,
          rfq,
        });
      }

      return res.status(201).json({ ...created, goods: cleanedGoods });
    }

    if (table === 'sales_orders') {
      const { goods = [], documents = [], status, ...orderPayload } = payload;
      const cleanedGoods = Array.isArray(goods) ? goods : [];
      const cleanedDocuments = normalizeDocumentsPayload(documents, 'sales-order');
      const result = await query('INSERT INTO ?? SET ?', [
        table,
        {
          ...orderPayload,
          goods: JSON.stringify(cleanedGoods),
          documents: cleanedDocuments.length ? JSON.stringify(cleanedDocuments) : null,
          status: status || 'ongoing',
        },
      ]);
      const [created] = await query('SELECT * FROM ?? WHERE id = ?', [table, result.insertId]);
      return res.status(201).json({ ...created, goods: cleanedGoods, documents: cleanedDocuments });
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

      const cleanPayload = sanitizeUserPayload(payload, ['full_name', 'email', 'role', 'phone', 'photo_url']);
      const defaultPassword = generateDefaultPassword();
      const hashedPassword = await hashPassword(defaultPassword);
      const userPayload = {
        ...cleanPayload,
        role: cleanPayload.role || 'staff',
        username: null,
        password: hashedPassword,
        password_reset_required: 1,
      };
      const result = await query('INSERT INTO ?? SET ?', [table, userPayload]);
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

      if (created?.email) {
        const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
        try {
          await sendSmtpMail({
            to: created.email,
            subject: 'Akun Baru RGI NexaProc',
            html: `
              <p>Halo ${created.full_name || 'User'},</p>
              <p>Akun RGI NexaProc Anda sudah dibuat.</p>
              <p><strong>Email:</strong> ${created.email}<br />
              <strong>Password default:</strong> ${defaultPassword}</p>
              <p>Silakan login di <a href="${appBaseUrl}">${appBaseUrl}</a> dan lengkapi username serta password baru Anda.</p>
            `,
          });
        } catch (error) {
          console.error('New user email error', error);
        }
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
    if (table === 'sales_orders') {
      const { goods, documents, ...orderUpdates } = req.body || {};
      const [existing] = await query('SELECT * FROM `sales_orders` WHERE id = ? LIMIT 1', [id]);

      if (!existing) {
        return res.status(404).json({ error: 'Record not found' });
      }

      const nextUpdates = { ...orderUpdates };
      let cleanedGoods;
      let cleanedDocuments;

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'goods')) {
        cleanedGoods = Array.isArray(goods) ? goods : [];
        nextUpdates.goods = JSON.stringify(cleanedGoods);
      }

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'documents')) {
        cleanedDocuments = normalizeDocumentsPayload(documents, 'sales-order');
        nextUpdates.documents = cleanedDocuments.length ? JSON.stringify(cleanedDocuments) : null;
      }

      await query('UPDATE ?? SET ? WHERE id = ?', [table, nextUpdates, id]);
      const [updated] = await query('SELECT * FROM ?? WHERE id = ?', [table, id]);

      let responseGoods = cleanedGoods;
      if (!responseGoods) {
        try {
          responseGoods = JSON.parse(updated?.goods || '[]');
        } catch {
          responseGoods = [];
        }
      }

      let responseDocuments = cleanedDocuments;
      if (!responseDocuments) {
        try {
          responseDocuments = JSON.parse(updated?.documents || '[]');
        } catch {
          responseDocuments = [];
        }
      }

      return res.json({ ...updated, goods: responseGoods, documents: responseDocuments });
    }

    if (table === 'quotations') {
      const {
        goods,
        rfq_id: rfqId,
        performed_by: performedBy,
        performer_role: performerRole,
        ...quotationUpdates
      } = req.body || {};
      const [existing] = await query('SELECT * FROM `quotations` WHERE id = ? LIMIT 1', [id]);

      if (!existing) {
        return res.status(404).json({ error: 'Record not found' });
      }

      if (existing.status === 'process') {
        return res.status(403).json({ error: 'Processed quotations cannot be edited' });
      }

      if (existing.status === 'rejected') {
        return res.status(403).json({ error: 'Rejected quotations cannot be edited' });
      }

      const isPrivileged = performerRole && ['superadmin', 'manager'].includes(performerRole);
      const isRequester =
        performedBy &&
        existing.performed_by &&
        String(existing.performed_by) === String(performedBy);

      if (!isPrivileged && !isRequester) {
        return res.status(403).json({ error: 'Not authorized to edit this quotation' });
      }

      const hasGoodsUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, 'goods');
      const cleanedGoods = hasGoodsUpdate
        ? Array.isArray(goods)
          ? goods.map((item) => ({
              good_id: item.good_id || null,
              name: item.name || null,
              description: item.description || null,
              unit: item.unit || null,
              qty: item.qty || 0,
              price: item.price || 0,
            }))
          : []
        : JSON.parse(existing.goods || '[]');

      const editableFields = ['delivery_time', 'payment_time', 'total_amount', 'tax_amount', 'grand_total'];
      const sanitizedUpdates = Object.fromEntries(
        Object.entries(quotationUpdates || {}).filter(([key]) => editableFields.includes(key))
      );
      const nextUpdates = { ...sanitizedUpdates };
      if (hasGoodsUpdate) {
        nextUpdates.goods = JSON.stringify(cleanedGoods);
      }

      const requestedStatus = quotationUpdates.status;
      const isStatusChange = requestedStatus && requestedStatus !== existing.status;
      const isOtherUpdate =
        hasGoodsUpdate ||
        Object.keys(sanitizedUpdates).length > 0;

      if (isStatusChange && !isPrivileged) {
        return res.status(403).json({ error: 'Only managers can update status' });
      }

      let shouldNotifyRenegotiation = false;
      const shouldNotifyWaiting =
        isStatusChange && requestedStatus === 'waiting';
      const shouldNotifyRenegotiationStatusChange =
        isStatusChange && requestedStatus === 'renegotiation';
      const shouldNotifyProcess = isStatusChange && requestedStatus === 'process';
      if (!isStatusChange && existing.status === 'negotiation' && isOtherUpdate) {
        nextUpdates.status = 'renegotiation';
        shouldNotifyRenegotiation = true;
      }
      const shouldNotifyWaitingOrRenegotiation =
        shouldNotifyWaiting || shouldNotifyRenegotiation || shouldNotifyRenegotiationStatusChange;

      if (isStatusChange && requestedStatus === 'negotiation') {
        const currentRound = Number(existing.negotiation_round || 0);
        nextUpdates.negotiation_round = currentRound + 1;
      }
      if (isStatusChange) {
        nextUpdates.status = requestedStatus;
      }

      await query('UPDATE ?? SET ? WHERE id = ?', [table, nextUpdates, id]);
      const [updated] = await query('SELECT * FROM ?? WHERE id = ?', [table, id]);

      if (isOtherUpdate) {
        await logActivity({
          performedBy,
          entityType: 'quotations',
          entityId: id,
          action: 'update',
          description: `Updated quotation ${updated?.quotation_number || id}`,
        });
      }

      if (isStatusChange || shouldNotifyRenegotiation) {
        await logActivity({
          performedBy,
          entityType: 'quotations',
          entityId: id,
          action: 'status',
          description: `Updated quotation status to ${updated?.status || requestedStatus}`,
        });
      }

      const requester = await getUserById(updated?.performed_by || existing.performed_by);
      const rfq = await getRfqById(updated?.rfq_id || existing.rfq_id);
      const roleEmails = await getRoleEmails(['superadmin', 'manager']);
      const requesterEmail = requester?.email ? requester.email.toLowerCase() : null;
      const roleRecipients = roleEmails.filter((email) => email.toLowerCase() !== requesterEmail);
      const statusForNotification = shouldNotifyRenegotiation ? 'renegotiation' : updated?.status || existing.status;
      const shouldNotifyRequester =
        ['negotiation', 'rejected', 'renegotiation'].includes(statusForNotification) &&
        (isStatusChange || shouldNotifyRenegotiation);
      const requesterRecipients =
        shouldNotifyRequester && requester?.email && requester?.role !== 'superadmin'
          ? [requester.email]
          : [];

      if (shouldNotifyWaitingOrRenegotiation) {
        await sendQuotationNotification({
          quotation: updated,
          goods: cleanedGoods,
          statusLabel: statusForNotification,
          recipients: roleRecipients,
          requester,
          rfq,
        });
      }

      if (shouldNotifyRequester) {
        await sendQuotationNotification({
          quotation: updated,
          goods: cleanedGoods,
          statusLabel: statusForNotification,
          recipients: requesterRecipients,
          requester,
          rfq,
        });
      }

      if (shouldNotifyProcess) {
        const processRecipients = Array.from(
          new Set([...roleRecipients, ...(requester?.email ? [requester.email] : [])])
        );
        await sendQuotationNotification({
          quotation: updated,
          goods: cleanedGoods,
          statusLabel: 'process',
          recipients: processRecipients,
          requester,
          rfq,
        });
      }

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
        const updates = sanitizeUserPayload(req.body || {}, [
          'full_name',
          'email',
          'password',
          'phone',
          'photo_url',
          'username',
        ]);
        updates.role = existing.role;

        if (Object.keys(updates).length === 1 && updates.role) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }

        if (updates.username && updates.username !== existing.username) {
          const [usernameConflict] = await query(
            'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1',
            [updates.username, id]
          );
          if (usernameConflict) {
            return res.status(409).json({ error: 'Username is already taken' });
          }
        }

        if (updates.password) {
          updates.password = await hashPassword(updates.password);
        }

        await query('UPDATE ?? SET ? WHERE id = ?', [table, updates, id]);
      } else {
        const updates = sanitizeUserPayload(req.body || {}, [
          'full_name',
          'email',
          'password',
          'phone',
          'role',
          'photo_url',
          'username',
        ]);

        if (preventSuperadminCreation(updates.role)) {
          return res.status(403).json({ error: 'Cannot promote user to superadmin' });
        }

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }

        if (updates.username && updates.username !== existing.username) {
          const [usernameConflict] = await query(
            'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1',
            [updates.username, id]
          );
          if (usernameConflict) {
            return res.status(409).json({ error: 'Username is already taken' });
          }
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

app.listen(port, '0.0.0.0', () => {
  console.log(`RGI NexaProc API listening on port ${port}`);
});
