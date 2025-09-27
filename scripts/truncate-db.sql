-- Safe data reset: keeps tables, drops ALL rows, resets AUTO_INCREMENT
-- Edit the sections below depending on what you want to keep.

SET FOREIGN_KEY_CHECKS=0;

-- 1) Always safe to clear transactional/snapshot tables
TRUNCATE TABLE money_ledger;
TRUNCATE TABLE fastag_sales;
TRUNCATE TABLE tickets_nh;

-- 2) Inventory and mappings (clear if you want to start inventory fresh)
TRUNCATE TABLE agent_bank_ids;
TRUNCATE TABLE fastags;

-- 3) Master data (optional)
-- If you want to keep suppliers, comment the next line
TRUNCATE TABLE suppliers;

-- 4) Users (optional)
-- Option A: wipe all users
-- TRUNCATE TABLE users;

-- Option B: keep admins, delete the rest (uncomment this if you prefer)
DELETE FROM users WHERE COALESCE(LOWER(role), '') <> 'admin';
ALTER TABLE users AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS=1;

