-- ============================================================================
-- SEED 0002: FUND CATEGORIES, CHART OF ACCOUNTS & COMPLIANCE CHECKLIST
-- ============================================================================

INSERT OR IGNORE INTO fund_categories (id, code, name, is_restricted, description) VALUES
  ('fund_general', 'GENERAL_UNRESTRICTED', 'General Unrestricted Fund', 0, 'General donations usable for any approved NGO rescue, shelter, food, or administrative activity.'),
  ('fund_medical', 'MEDICAL_RESCUE', 'Medical & Emergency Rescue Fund', 1, 'Restricted donations earmarked for veterinary treatments, surgeries, medicines, and emergency rescues.'),
  ('fund_food', 'FOOD_NUTRITION', 'Shelter Food & Nutrition Fund', 1, 'Restricted donations earmarked for daily dog, cat, and rescued wildlife feeding.'),
  ('fund_shelter', 'SHELTER_INFRA', 'Shelter Maintenance & Infrastructure Fund', 1, 'Restricted donations for kennel upkeep, utilities, sanitation, and facility expansion.');

INSERT OR IGNORE INTO accounts (id, code, name, account_type, current_balance_paise) VALUES
  ('acct_cash', '1001', 'Cash in Hand (Shelter Petty Cash)', 'asset', 0),
  ('acct_hdfc_bank', '1002', 'HDFC Bank Primary Account (50200109395706)', 'asset', 0),
  ('acct_razorpay_clearing', '1003', 'Razorpay Settlement Clearing Account', 'asset', 0),
  ('acct_donation_income', '4001', 'Donation & Grant Income', 'income', 0),
  ('acct_operational_expense', '5001', 'Animal Welfare & Operational Expenditure', 'expense', 0);

INSERT OR IGNORE INTO compliance_registrations (id, reg_type, registration_number, issuing_authority, status, notes) VALUES
  ('comp_society', 'society_registration', NULL, 'Registrar of Societies, Uttar Pradesh', 'active', 'Registered Indian Society since 2022 (founded 2020). Upload certificate PDF in Compliance Centre.'),
  ('comp_pan', 'pan', NULL, 'Income Tax Department, Govt. of India', 'active', 'Organizational PAN card for Paws Hopez Society.'),
  ('comp_darpan', 'ngo_darpan', NULL, 'NITI Aayog, Govt. of India', 'not_applied', 'Update Darpan Unique ID once recorded.'),
  ('comp_12a', '12a', NULL, 'Income Tax Department (CPC)', 'not_applied', 'Track 12A registration application/approval separately from 80G.'),
  ('comp_80g', '80g', NULL, 'Income Tax Department (CPC)', 'not_applied', 'IMPORTANT: 80G tax deduction receipts remain disabled until active 80G approval dates are verified.'),
  ('comp_awbi', 'awbi', NULL, 'Animal Welfare Board of India (AWBI)', 'not_applied', 'Track AWBI recognition and annual inspection compliance.'),
  ('comp_csr1', 'csr1', NULL, 'Ministry of Corporate Affairs (MCA)', 'not_applied', 'Required for receiving corporate CSR grants.');
