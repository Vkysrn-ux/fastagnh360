-- DANGER: This script DROPs and recreates core tables used by the app.
-- Make a backup before running in production.

SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS money_ledger;
DROP TABLE IF EXISTS fastag_sales;
DROP TABLE IF EXISTS tickets_nh;
DROP TABLE IF EXISTS agent_bank_ids;
DROP TABLE IF EXISTS fastags;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS=1;

-- users
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(32) NULL,
  role VARCHAR(64) NOT NULL,
  status VARCHAR(32) DEFAULT 'Active',
  password VARCHAR(255) NULL,
  dashboard VARCHAR(32) NULL,
  parent_user_id INT NULL,
  pincode VARCHAR(16) NULL,
  area VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_users_email (email),
  KEY idx_users_phone (phone),
  KEY idx_users_parent (parent_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- suppliers (minimal)
CREATE TABLE suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NULL,
  phone VARCHAR(32) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- fastags (inventory)
CREATE TABLE fastags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tag_serial VARCHAR(255) NOT NULL,
  fastag_class VARCHAR(32) NULL,
  bank_name VARCHAR(255) NULL,
  batch_number VARCHAR(255) NULL,
  purchase_price DECIMAL(10,2) NULL,
  purchase_type VARCHAR(32) NULL,
  purchase_date DATE NULL,
  status ENUM('in_stock','assigned','sold','deactivated') NOT NULL DEFAULT 'in_stock',
  supplier_id INT NULL,
  assigned_to_agent_id INT NULL,
  assigned_to INT NULL,
  sold_by_user_id INT NULL,
  assigned_date DATE NULL,
  assigned_at DATETIME NULL,
  vehicle_reg_no VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_fastags_serial (tag_serial),
  KEY idx_fastags_status (status),
  KEY idx_fastags_owner (assigned_to_agent_id),
  KEY idx_fastags_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- agent bank ids (for toll-agents)
CREATE TABLE agent_bank_ids (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  bank_reference_id VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_agent_bank_ids_agent (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- tickets (parent + sub-tickets)
CREATE TABLE tickets_nh (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_no VARCHAR(64) NULL,
  parent_ticket_id INT NULL,
  vehicle_reg_no VARCHAR(64) NULL,
  subject VARCHAR(255) NULL,
  details TEXT NULL,
  phone VARCHAR(32) NULL,
  alt_phone VARCHAR(32) NULL,
  assigned_to INT NULL,
  lead_received_from VARCHAR(255) NULL,
  lead_by VARCHAR(255) NULL,
  status VARCHAR(64) NULL,
  kyv_status VARCHAR(64) NULL,
  customer_name VARCHAR(255) NULL,
  comments TEXT NULL,
  payment_to_collect DECIMAL(10,2) NULL,
  payment_to_send DECIMAL(10,2) NULL,
  net_value DECIMAL(10,2) NULL,
  commission_amount DECIMAL(10,2) NULL,
  fastag_serial VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_tickets_parent (parent_ticket_id),
  KEY idx_tickets_assigned (assigned_to),
  KEY idx_tickets_fastag (fastag_serial)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sales snapshot (used across dashboards)
CREATE TABLE fastag_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tag_serial VARCHAR(255) NOT NULL,
  ticket_id INT NULL,
  vehicle_reg_no VARCHAR(64) NULL,
  bank_name VARCHAR(255) NULL,
  fastag_class VARCHAR(32) NULL,
  supplier_id INT NULL,
  sold_by_user_id INT NULL,
  sold_by_agent_id INT NULL,
  payment_to_collect DECIMAL(10,2) NULL,
  payment_to_send DECIMAL(10,2) NULL,
  net_value DECIMAL(10,2) NULL,
  commission_amount DECIMAL(10,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sales_seller (sold_by_user_id),
  KEY idx_sales_agent (sold_by_agent_id),
  KEY idx_sales_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- simple money ledger (best-effort entries)
CREATE TABLE money_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ref_type ENUM('ticket','fastag_sale') NOT NULL,
  ref_id INT NOT NULL,
  entry_type ENUM('collect','payout','commission') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ledger_ref (ref_type, ref_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

