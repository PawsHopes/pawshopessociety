import type { Bindings } from '../types/env';

type NoticeType = 'vaccination_due' | 'low_stock' | 'stock_expiry' | 'doc_expiry' | 'approval_needed' | 'new_rescue' | 'new_adoption';
type Notice = { type: NoticeType; dedupeKey: string; title: string; message: string; link: string; roles: string[] };

const add = (items: Notice[], type: NoticeType, dedupeKey: string, title: string, message: string, link: string, roles: string[]) => {
  items.push({ type, dedupeKey, title, message, link, roles });
};

export async function runDailyNotifications(env: Bindings): Promise<{ createdCandidates: number }> {
  const db = env.DB;
  const notices: Notice[] = [];
  const [vaccinations, lowStock, expiringStock, expiringDocs, rescues, adoptions, pendingFinance, pendingDonations, pendingStock] = await Promise.all([
    db.prepare(`SELECT v.id, v.vaccine_name, v.next_due_date, a.name AS animal_name
      FROM vaccinations v JOIN animals a ON a.id = v.animal_id
      WHERE v.next_due_date >= date('now') AND v.next_due_date <= date('now', '+30 days')
      ORDER BY v.next_due_date LIMIT 100`).all<{id:string;vaccine_name:string;next_due_date:string;animal_name:string}>(),
    db.prepare(`SELECT id, name, current_stock, min_stock_threshold, unit FROM inventory_items
      WHERE min_stock_threshold > 0 AND current_stock <= min_stock_threshold ORDER BY current_stock LIMIT 100`).all<{id:string;name:string;current_stock:number;min_stock_threshold:number;unit:string}>(),
    db.prepare(`SELECT sm.id, sm.item_id, i.name AS item_name, sm.batch_number, sm.expiry_date
      FROM stock_movements sm JOIN inventory_items i ON i.id = sm.item_id
      WHERE sm.approval_status = 'approved' AND sm.expiry_date >= date('now') AND sm.expiry_date <= date('now', '+30 days')
      ORDER BY sm.expiry_date LIMIT 100`).all<{id:string;item_id:string;item_name:string;batch_number:string|null;expiry_date:string}>(),
    db.prepare(`SELECT id, title, doc_category, expiry_date FROM documents
      WHERE expiry_date >= date('now') AND expiry_date <= date('now', '+30 days')
      ORDER BY expiry_date LIMIT 100`).all<{id:string;title:string;doc_category:string;expiry_date:string}>(),
    db.prepare(`SELECT id, case_code, location_address FROM rescue_cases
      WHERE status IN ('new','verified','assigned') ORDER BY reported_at DESC LIMIT 100`).all<{id:string;case_code:string;location_address:string}>(),
    db.prepare(`SELECT id, application_code, applicant_name FROM adoption_applications
      WHERE status IN ('application','initial_review','verification') ORDER BY created_at DESC LIMIT 100`).all<{id:string;application_code:string;applicant_name:string}>(),
    db.prepare(`SELECT id, expense_code, vendor_payee, amount_paise FROM expenses
      WHERE approval_status = 'pending' ORDER BY created_at DESC LIMIT 100`).all<{id:string;expense_code:string;vendor_payee:string;amount_paise:number}>(),
    db.prepare(`SELECT id, amount_paise, donation_date FROM donations
      WHERE verification_status = 'pending' ORDER BY created_at DESC LIMIT 100`).all<{id:string;amount_paise:number;donation_date:string}>(),
    db.prepare(`SELECT sm.id, sm.movement_type, sm.quantity_delta, i.name AS item_name FROM stock_movements sm
      JOIN inventory_items i ON i.id = sm.item_id
      WHERE sm.approval_status = 'pending' ORDER BY sm.created_at DESC LIMIT 100`).all<{id:string;movement_type:string;quantity_delta:number;item_name:string}>(),
  ]);

  for (const row of vaccinations.results || []) add(notices, 'vaccination_due', `vaccination_due:${row.id}:${row.next_due_date}`, 'Vaccination due soon', `${row.animal_name}: ${row.vaccine_name} is due by ${row.next_due_date}.`, '/modules/medical', ['vet_staff','super_admin']);
  for (const row of lowStock.results || []) add(notices, 'low_stock', `low_stock:${row.id}`, 'Inventory below minimum stock', `${row.name}: ${row.current_stock} ${row.unit} remaining (minimum ${row.min_stock_threshold}).`, '/modules/inventory', ['super_admin','finance_manager']);
  for (const row of expiringStock.results || []) add(notices, 'stock_expiry', `stock_expiry:${row.id}:${row.expiry_date}`, 'Stock batch expiring soon', `${row.item_name}${row.batch_number ? ' · Batch ' + row.batch_number : ''} expires on ${row.expiry_date}.`, '/modules/inventory', ['super_admin','vet_staff']);
  for (const row of expiringDocs.results || []) add(notices, 'doc_expiry', `doc_expiry:${row.id}:${row.expiry_date}`, 'Document expiry approaching', `${row.title} (${row.doc_category}) expires on ${row.expiry_date}.`, '/modules/finance', ['super_admin']);
  for (const row of rescues.results || []) add(notices, 'new_rescue', `new_rescue:${row.id}`, 'Rescue case needs attention', `${row.case_code}: ${row.location_address}.`, '/modules/rescue', ['rescue_coord','super_admin']);
  for (const row of adoptions.results || []) add(notices, 'new_adoption', `new_adoption:${row.id}`, 'Adoption application awaiting review', `${row.application_code}: ${row.applicant_name}.`, '/modules/adoptions', ['adoption_coord','super_admin']);
  for (const row of pendingFinance.results || []) add(notices, 'approval_needed', `expense_approval:${row.id}`, 'Expense awaiting approval', `${row.expense_code}: ${row.vendor_payee} (₹${(Number(row.amount_paise || 0) / 100).toFixed(2)}).`, '/modules/finance', ['finance_manager','super_admin']);
  for (const row of pendingDonations.results || []) add(notices, 'approval_needed', `donation_verification:${row.id}`, 'Donation awaiting verification', `Donation of ₹${(Number(row.amount_paise || 0) / 100).toFixed(2)} received on ${row.donation_date} needs verification.`, '/modules/finance', ['finance_manager','super_admin']);
  for (const row of pendingStock.results || []) add(notices, 'approval_needed', `stock_approval:${row.id}`, 'Stock movement awaiting approval', `${row.item_name}: ${row.movement_type.replaceAll('_',' ')} (${row.quantity_delta}).`, '/modules/inventory', ['super_admin']);

  const statements = notices.flatMap((notice) => notice.roles.map((role) =>
    db.prepare(`INSERT OR IGNORE INTO notifications (id, target_role_code, dedupe_key, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), role, `${notice.dedupeKey}:${role}`, notice.type, notice.title, notice.message, notice.link)
  ));
  for (let i = 0; i < statements.length; i += 80) {
    await db.batch(statements.slice(i, i + 80));
  }
  return { createdCandidates: statements.length };
}
