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

// 1. Auth: Sign In with Employee ID & Password (default 123456)
app.post('/api/auth/login', async (req, res) => {
  const { emp_id, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE emp_id = $1', [emp_id?.toUpperCase()]);
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
});

// Change Password
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE user_id = $1', [req.user.user_id]);
  if (!rows[0] || !(await bcrypt.compare(current_password, rows[0].password_hash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const hash = await bcrypt.hash(new_password, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [hash, req.user.user_id]);
  res.json({ ok: true });
});

// 2. Departments (Alphabetical, Super Admin Create & Remove)
app.get('/api/departments', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM departments ORDER BY name ASC');
  res.json(rows);
});

app.post('/api/departments', requireAuth, requireSuperAdmin, async (req, res) => {
  const { name } = req.body;
  const { rows } = await pool.query('INSERT INTO departments (name) VALUES ($1) RETURNING *', [name.trim()]);
  res.status(201).json(rows[0]);
});

app.delete('/api/departments/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  await pool.query('DELETE FROM departments WHERE dept_id = $1', [req.params.id]);
  res.json({ ok: true });
});

// 3. Super Admin: Assign / Transfer / Remove Storekeeper (no duplicates in same dept)
app.post('/api/admin/storekeepers', requireAuth, requireSuperAdmin, async (req, res) => {
  const { emp_id, dept_id, scope } = req.body;
  const hash = await bcrypt.hash('123456', 10);
  const uRes = await pool.query(
    `INSERT INTO users (emp_id, role, password_hash) VALUES ($1, 'STOREKEEPER', $2)
     ON CONFLICT (emp_id) DO UPDATE SET role = 'STOREKEEPER' RETURNING user_id`,
    [emp_id.trim().toUpperCase(), hash]
  );
  try {
    const { rows } = await pool.query(
      'INSERT INTO storekeeper_assignments (user_id, dept_id, scope, assigned_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [uRes.rows[0].user_id, dept_id, scope, req.user.user_id]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(409).json({ error: 'Employee already assigned as Storekeeper in this department' });
  }
});

// 4. Storekeeper: Assign Viewer with strict No-Editing Policy (no duplicates in same dept)
app.post('/api/storekeeper/viewers', requireAuth, requireEditor, async (req, res) => {
  const { emp_id, dept_id } = req.body;
  const targetDept = req.user.role === 'SUPER_ADMIN' ? dept_id : req.user.assignment?.dept_id;
  const hash = await bcrypt.hash('123456', 10);
  const uRes = await pool.query(
    `INSERT INTO users (emp_id, role, password_hash) VALUES ($1, 'VIEWER', $2)
     ON CONFLICT (emp_id) DO UPDATE SET role = 'VIEWER' RETURNING user_id`,
    [emp_id.trim().toUpperCase(), hash]
  );
  try {
    const { rows } = await pool.query(
      'INSERT INTO viewer_dept_access (viewer_user_id, dept_id, assigned_by, can_edit) VALUES ($1, $2, $3, FALSE) RETURNING *',
      [uRes.rows[0].user_id, targetDept, req.user.user_id]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(409).json({ error: 'Employee already assigned as Viewer in this department' });
  }
});

// 5. Scoped Consumables & Equipments Read
app.get('/api/consumables', requireAuth, async (req, res) => {
  if (req.user.assignment?.scope === 'EQUIPMENT_ONLY') return res.status(403).json({ error: 'Scope restricted to Equipments' });
  const deptId = req.user.role === 'SUPER_ADMIN' ? null : req.user.assignment?.dept_id;
  const { rows } = await pool.query(
    `SELECT cb.*, im.name, im.sub_category, d.name AS dept_name
     FROM consumable_batches cb
     JOIN items_master im ON im.item_id = cb.item_id
     JOIN departments d ON d.dept_id = cb.dept_id
     WHERE ($1::int IS NULL OR cb.dept_id = $1)
     ORDER BY cb.expiry_date ASC`,
    [deptId]
  );
  res.json(rows);
});

app.get('/api/equipments', requireAuth, async (req, res) => {
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
});

// 6. Separate Monthly Excel (.xlsx) Export for Consumables or Equipments
app.get('/api/reports/export/:area', requireAuth, async (req, res) => {
  const area = req.params.area.toUpperCase(); // CONSUMABLES | EQUIPMENTS
  const deptId = req.user.role === 'SUPER_ADMIN' ? null : req.user.assignment?.dept_id;
  const wb = new ExcelJS.Workbook();

  if (area === 'CONSUMABLES') {
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
       WHERE ($1::int IS NULL OR cb.dept_id = $1)`,
      [deptId]
    );
    ws.addRows(rows);
  } else {
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
       WHERE ($1::int IS NULL OR ea.dept_id = $1)`,
      [deptId]
    );
    ws.addRows(rows);
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=MedStock-${area}-Report.xlsx`);
  await wb.xlsx.write(res);
  res.end();
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`MedStock API running on port ${port}`));
