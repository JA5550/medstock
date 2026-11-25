import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { requireAuth, requireSuperAdmin, requireEditor } from './middleware/auth.js';

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Auth: Sign In with Employee ID & Password (default 123456)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { emp_id, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE emp_id = $1', [emp_id?.trim().toUpperCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
      return res.status(401).json({ error: 'Invalid Employee ID or Password' });
    }
    let assignment = null;
    if (user.role === 'STOREKEEPER') {
      const a = await pool.query(
        'SELECT sa.dept_id, d.name AS dept_name, sa.scope FROM storekeeper_assignments sa JOIN departments d ON d.dept_id = sa.dept_id WHERE sa.user_id = $1',
        [user.user_id]
      );
      assignment = a.rows[0] || null;
    } else if (user.role === 'VIEWER') {
      const v = await pool.query(
        'SELECT vda.dept_id, d.name AS dept_name FROM viewer_dept_access vda JOIN departments d ON d.dept_id = vda.dept_id WHERE vda.viewer_user_id = $1',
        [user.user_id]
      );
      assignment = v.rows[0] ? { ...v.rows[0], scope: 'BOTH', can_edit: false } : null;
    }
    const token = jwt.sign(
      { user_id: user.user_id, emp_id: user.emp_id, role: user.role, assignment },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, user: { emp_id: user.emp_id, role: user.role, assignment } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection error' });
  }
});

// Change Password
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.user.user_id]);
    if (!rows[0] || !(await bcrypt.compare(current_password || '', rows[0].password_hash))) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [hash, req.user.user_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Departments (Alphabetical)
app.get('/api/departments', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM departments ORDER BY name ASC');
    res.json(rows);
  } catch { res.status(500).json({ error: 'Failed to load departments' }); }
});

app.post('/api/departments', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Department name required' });
    const { rows } = await pool.query('INSERT INTO departments (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json(rows[0]);
  } catch { res.status(409).json({ error: 'Department already exists' }); }
});

app.delete('/api/departments/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM departments WHERE dept_id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to remove department' }); }
});

// Storekeepers (Super Admin: List, Assign, Transfer, Remove)
app.get('/api/admin/storekeepers', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sa.assign_id, u.emp_id, sa.dept_id, d.name AS dept_name, sa.scope
       FROM storekeeper_assignments sa
       JOIN users u ON u.user_id = sa.user_id
       JOIN departments d ON d.dept_id = sa.dept_id
       ORDER BY d.name ASC, u.emp_id ASC`
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Failed to load storekeepers' }); }
});

app.post('/api/admin/storekeepers', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { emp_id, dept_id, scope } = req.body;
    const hash = await bcrypt.hash('123456', 10);
    const uRes = await pool.query(
      `INSERT INTO users (emp_id, role, password_hash) VALUES ($1, 'STOREKEEPER', $2)
       ON CONFLICT (emp_id) DO UPDATE SET role = 'STOREKEEPER' RETURNING user_id`,
      [emp_id.trim().toUpperCase(), hash]
    );
    const { rows } = await pool.query(
      'INSERT INTO storekeeper_assignments (user_id, dept_id, scope, assigned_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [uRes.rows[0].user_id, dept_id, scope, req.user.user_id]
    );
    res.status(201).json(rows[0]);
  } catch { res.status(409).json({ error: 'Employee already assigned as Storekeeper in this department' }); }
});

app.patch('/api/admin/storekeepers/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { dept_id, scope } = req.body;
    await pool.query('UPDATE storekeeper_assignments SET dept_id = $1, scope = $2 WHERE assign_id = $3', [dept_id, scope, req.params.id]);
    res.json({ ok: true });
  } catch { res.status(409).json({ error: 'Transfer conflicts with existing assignment' }); }
});

app.delete('/api/admin/storekeepers/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM storekeeper_assignments WHERE assign_id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to remove storekeeper' }); }
});

// Viewers (Storekeeper/Admin: List, Assign, Transfer, Remove - Strict No-Edit Policy)
app.get('/api/storekeeper/viewers', requireAuth, requireEditor, async (req, res) => {
  try {
    const deptId = req.user.role === 'SUPER_ADMIN' ? null : req.user.assignment?.dept_id;
    const { rows } = await pool.query(
      `SELECT vda.access_id, u.emp_id, vda.dept_id, d.name AS dept_name, a.emp_id AS assigned_by_emp
       FROM viewer_dept_access vda
       JOIN users u ON u.user_id = vda.viewer_user_id
       JOIN departments d ON d.dept_id = vda.dept_id
       JOIN users a ON a.user_id = vda.assigned_by
       WHERE ($1::int IS NULL OR vda.dept_id = $1)
       ORDER BY d.name ASC, u.emp_id ASC`,
      [deptId]
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Failed to load viewers' }); }
});

app.post('/api/storekeeper/viewers', requireAuth, requireEditor, async (req, res) => {
  try {
    const { emp_id, dept_id } = req.body;
    const targetDept = req.user.role === 'SUPER_ADMIN' ? dept_id : req.user.assignment?.dept_id;
    const hash = await bcrypt.hash('123456', 10);
    const uRes = await pool.query(
      `INSERT INTO users (emp_id, role, password_hash) VALUES ($1, 'VIEWER', $2)
       ON CONFLICT (emp_id) DO UPDATE SET role = 'VIEWER' RETURNING user_id`,
      [emp_id.trim().toUpperCase(), hash]
    );
    const { rows } = await pool.query(
      'INSERT INTO viewer_dept_access (viewer_user_id, dept_id, assigned_by, can_edit) VALUES ($1, $2, $3, FALSE) RETURNING *',
      [uRes.rows[0].user_id, targetDept, req.user.user_id]
    );
    res.status(201).json(rows[0]);
  } catch { res.status(409).json({ error: 'Employee already assigned as Viewer in this department' }); }
});

app.patch('/api/storekeeper/viewers/:id', requireAuth, requireEditor, async (req, res) => {
  try {
    await pool.query('UPDATE viewer_dept_access SET dept_id = $1 WHERE access_id = $2', [req.body.dept_id, req.params.id]);
    res.json({ ok: true });
  } catch { res.status(409).json({ error: 'Viewer already assigned to that department' }); }
});

app.delete('/api/storekeeper/viewers/:id', requireAuth, requireEditor, async (req, res) => {
  try {
    await pool.query('DELETE FROM viewer_dept_access WHERE access_id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to remove viewer' }); }
});

// Consumables & Equipments (Scoped)
app.get('/api/consumables', requireAuth, async (req, res) => {
  try {
    if (req.user.assignment?.scope === 'EQUIPMENT_ONLY') return res.status(403).json({ error: 'Scope restricted to Equipments' });
    const deptId = req.user.role === 'SUPER_ADMIN' ? null : req.user.assignment?.dept_id;
    const { rows } = await pool.query(
      `SELECT cb.*, im.name, im.sub_category, im.min_threshold, d.name AS dept_name
       FROM consumable_batches cb
       JOIN items_master im ON im.item_id = cb.item_id
       JOIN departments d ON d.dept_id = cb.dept_id
       WHERE ($1::int IS NULL OR cb.dept_id = $1)
       ORDER BY cb.expiry_date ASC`,
      [deptId]
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Failed to load consumables' }); }
});

app.post('/api/consumables/use/:id', requireAuth, requireEditor, async (req, res) => {
  try {
    await pool.query('UPDATE consumable_batches SET qty = GREATEST(qty - 1, 0) WHERE batch_id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to update stock' }); }
});

app.get('/api/equipments', requireAuth, async (req, res) => {
  try {
    if (req.user.assignment?.scope === 'CONSUMABLES_ONLY') return res.status(403).json({ error: 'Scope restricted to Consumables' });
    const deptId = req.user.role === 'SUPER_ADMIN' ? null : req.user.assignment?.dept_id;
    const { rows } = await pool.query(
      `SELECT ea.*, im.name, d.name AS dept_name
       FROM equipment_assets ea
       JOIN items_master im ON im.item_id = ea.item_id
       JOIN departments d ON d.dept_id = ea.dept_id
       WHERE ($1::int IS NULL OR ea.dept_id = $1)
       ORDER BY ea.asset_id DESC`,
      [deptId]
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Failed to load equipments' }); }
});

app.patch('/api/equipments/:id/toggle', requireAuth, requireEditor, async (req, res) => {
  try {
    await pool.query(
      `UPDATE equipment_assets SET status = CASE WHEN status = 'ACTIVE' THEN 'UNDER_REPAIR' ELSE 'ACTIVE' END WHERE asset_id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to update status' }); }
});

// Inward Items (Single, Multiple, Import)
app.post('/api/inward/bulk', requireAuth, requireEditor, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const items = req.body.items || [];
    for (const row of items) {
      const targetDept = req.user.role === 'SUPER_ADMIN' ? row.dept_id : req.user.assignment?.dept_id;
      const area = row.area === 'EQUIPMENTS' ? 'EQUIPMENTS' : 'CONSUMABLES';
      const subcat = area === 'CONSUMABLES' ? (row.sub_category === 'NON_SURGICAL' ? 'NON_SURGICAL' : 'SURGICAL') : null;
      let itemRes = await client.query('SELECT item_id FROM items_master WHERE LOWER(name) = LOWER($1) AND area = $2', [row.name.trim(), area]);
      let itemId = itemRes.rows[0]?.item_id;
      if (!itemId) {
        const ins = await client.query('INSERT INTO items_master (name, area, sub_category) VALUES ($1, $2, $3) RETURNING item_id', [row.name.trim(), area, subcat]);
        itemId = ins.rows[0].item_id;
      }
      const qty = parseInt(row.qty, 10) || 1;
      if (area === 'CONSUMABLES') {
        await client.query(
          'INSERT INTO consumable_batches (item_id, dept_id, batch_no, expiry_date, qty) VALUES ($1, $2, $3, $4, $5)',
          [itemId, targetDept, row.code || 'B-NEW', row.expiry_date || '2028-06-30', qty]
        );
      } else {
        await client.query(
          'INSERT INTO equipment_assets (item_id, dept_id, serial_no, service_due) VALUES ($1, $2, $3, $4)',
          [itemId, targetDept, row.code || `SN-${Date.now()}`, row.expiry_date || '2027-12-31']
        );
      }
      await client.query(
        'INSERT INTO tender_intakes (tender_no, dept_id, item_id, qty, entered_by) VALUES ($1, $2, $3, $4, $5)',
        [row.tender_no || 'INWARD', targetDept, itemId, qty, req.user.user_id]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ ok: true, count: items.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message || 'Failed to save inward items' });
  } finally {
    client.release();
  }
});

// Indents & Borrow
app.get('/api/indents', requireAuth, requireEditor, async (req, res) => {
  try {
    const deptId = req.user.role === 'SUPER_ADMIN' ? null : req.user.assignment?.dept_id;
    const { rows } = await pool.query(
      `SELECT i.*, im.name AS item_name, d.name AS store_dept_name
       FROM indents i JOIN items_master im ON im.item_id = i.item_id JOIN departments d ON d.dept_id = i.store_dept_id
       WHERE ($1::int IS NULL OR i.store_dept_id = $1) ORDER BY i.indent_id DESC`,
      [deptId]
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Failed to load indents' }); }
});

app.post('/api/indents', requireAuth, requireEditor, async (req, res) => {
  try {
    const deptId = req.user.role === 'SUPER_ADMIN' ? req.body.store_dept_id : req.user.assignment?.dept_id;
    const { rows } = await pool.query(
      'INSERT INTO indents (requesting_unit, store_dept_id, item_id, req_qty, handled_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.body.requesting_unit, deptId, req.body.item_id, req.body.req_qty, req.user.user_id]
    );
    res.status(201).json(rows[0]);
  } catch { res.status(400).json({ error: 'Failed to create indent' }); }
});

app.post('/api/indents/:id/issue', requireAuth, requireEditor, async (req, res) => {
  try {
    await pool.query("UPDATE indents SET issued_qty = req_qty, status = 'ISSUED' WHERE indent_id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to issue indent' }); }
});

app.get('/api/loans', requireAuth, requireEditor, async (req, res) => {
  try {
    const deptId = req.user.role === 'SUPER_ADMIN' ? null : req.user.assignment?.dept_id;
    const { rows } = await pool.query(
      `SELECT l.*, im.name AS item_name, d.name AS borrower_dept_name
       FROM inter_store_loans l JOIN items_master im ON im.item_id = l.item_id JOIN departments d ON d.dept_id = l.borrower_dept_id
       WHERE ($1::int IS NULL OR l.borrower_dept_id = $1) ORDER BY l.loan_id DESC`,
      [deptId]
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Failed to load loans' }); }
});

app.post('/api/loans', requireAuth, requireEditor, async (req, res) => {
  try {
    const deptId = req.user.role === 'SUPER_ADMIN' ? req.body.borrower_dept_id : req.user.assignment?.dept_id;
    const { rows } = await pool.query(
      'INSERT INTO inter_store_loans (borrower_dept_id, lender_dept_name, item_id, qty, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [deptId, req.body.lender_dept_name, req.body.item_id, req.body.qty, req.user.user_id]
    );
    res.status(201).json(rows[0]);
  } catch { res.status(400).json({ error: 'Failed to record loan' }); }
});

app.post('/api/loans/:id/return', requireAuth, requireEditor, async (req, res) => {
  try {
    await pool.query("UPDATE inter_store_loans SET status = 'RETURNED' WHERE loan_id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to return loan' }); }
});

// Separate Monthly Excel (.xlsx) Export
app.get('/api/reports/export/:area', requireAuth, async (req, res) => {
  try {
    const area = req.params.area.toUpperCase();
    const deptId = req.user.role === 'SUPER_ADMIN' ? null : req.user.assignment?.dept_id;
    const wb = new ExcelJS.Workbook();
    if (area === 'CONSUMABLES' || area === 'COMBINED') {
      const ws = wb.addWorksheet('Consumables');
      ws.columns = [
        { header: 'Item', key: 'name', width: 28 },
        { header: 'Subcategory', key: 'sub_category', width: 16 },
        { header: 'Department', key: 'dept_name', width: 20 },
        { header: 'Batch', key: 'batch_no', width: 16 },
        { header: 'Expiry', key: 'expiry_date', width: 14 },
        { header: 'Qty', key: 'qty', width: 10 }
      ];
      const { rows } = await pool.query(
        `SELECT im.name, im.sub_category, d.name AS dept_name, cb.batch_no, cb.expiry_date, cb.qty
         FROM consumable_batches cb JOIN items_master im ON im.item_id = cb.item_id JOIN departments d ON d.dept_id = cb.dept_id
         WHERE ($1::int IS NULL OR cb.dept_id = $1)`, [deptId]
      );
      ws.addRows(rows);
    }
    if (area === 'EQUIPMENTS' || area === 'COMBINED') {
      const ws = wb.addWorksheet('Equipments');
      ws.columns = [
        { header: 'Equipment', key: 'name', width: 28 },
        { header: 'Department', key: 'dept_name', width: 20 },
        { header: 'Serial No', key: 'serial_no', width: 18 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Service Due', key: 'service_due', width: 14 }
      ];
      const { rows } = await pool.query(
        `SELECT im.name, d.name AS dept_name, ea.serial_no, ea.status, ea.service_due
         FROM equipment_assets ea JOIN items_master im ON im.item_id = ea.item_id JOIN departments d ON d.dept_id = ea.dept_id
         WHERE ($1::int IS NULL OR ea.dept_id = $1)`, [deptId]
      );
      ws.addRows(rows);
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=MedStock-${area}-Report.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch { res.status(500).json({ error: 'Export failed' }); }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`MedStock API running on port ${port}`));
