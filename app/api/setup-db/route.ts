import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// POST /api/setup-db
// Body: { secret: "your-setup-secret" }
// Creates the nh360 database and all tables from scratch.

export async function POST(_req: NextRequest) {
  try {
    // Connect WITHOUT specifying a database so we can create it
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      charset: 'utf8mb4',
      multipleStatements: true,
    });

    const results: { table: string; status: string }[] = [];

    const run = async (label: string, sql: string) => {
      await conn.query(sql);
      results.push({ table: label, status: 'ok' });
    };

    // 1. Create database
    await run('database:nh360', `
      CREATE DATABASE IF NOT EXISTS nh360
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
    `);

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // 2. Core tables
    await run('users', `
      CREATE TABLE IF NOT EXISTS nh360.users (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        name            VARCHAR(255) NOT NULL,
        email           VARCHAR(255) NULL,
        phone           VARCHAR(32)  NULL,
        role            VARCHAR(64)  NOT NULL,
        status          VARCHAR(32)  DEFAULT 'Active',
        password        VARCHAR(255) NULL,
        dashboard       VARCHAR(32)  NULL,
        parent_user_id  INT          NULL,
        pincode         VARCHAR(16)  NULL,
        area            VARCHAR(255) NULL,
        notes           TEXT         NULL,
        created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_users_email (email),
        KEY idx_users_phone (phone),
        KEY idx_users_parent (parent_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('suppliers', `
      CREATE TABLE IF NOT EXISTS nh360.suppliers (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        name          VARCHAR(255) NOT NULL,
        contact_name  VARCHAR(255) NULL,
        phone         VARCHAR(32)  NULL,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('fastags', `
      CREATE TABLE IF NOT EXISTS nh360.fastags (
        id                    INT AUTO_INCREMENT PRIMARY KEY,
        tag_serial            VARCHAR(255)  NOT NULL,
        fastag_class          VARCHAR(32)   NULL,
        bank_name             VARCHAR(255)  NULL,
        batch_number          VARCHAR(255)  NULL,
        purchase_price        DECIMAL(10,2) NULL,
        purchase_type         VARCHAR(32)   NULL,
        purchase_date         DATE          NULL,
        status                ENUM('in_stock','assigned','sold','deactivated') NOT NULL DEFAULT 'in_stock',
        supplier_id           INT           NULL,
        assigned_to_agent_id  INT           NULL,
        assigned_to           INT           NULL,
        sold_by_user_id       INT           NULL,
        assigned_date         DATE          NULL,
        assigned_at           DATETIME      NULL,
        vehicle_reg_no        VARCHAR(64)   NULL,
        bank_mapping_status   ENUM('pending','done') NULL,
        mapping_done          TINYINT(1)    NULL,
        bank_login_user_id    INT           NULL,
        created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_fastags_serial (tag_serial),
        KEY idx_fastags_status (status),
        KEY idx_fastags_owner (assigned_to_agent_id),
        KEY idx_fastags_supplier (supplier_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('agent_bank_ids', `
      CREATE TABLE IF NOT EXISTS nh360.agent_bank_ids (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        agent_id          INT          NOT NULL,
        bank_name         VARCHAR(255) NOT NULL,
        bank_reference_id VARCHAR(255) NOT NULL,
        created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_agent_bank_ids_agent (agent_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('tickets_nh', `
      CREATE TABLE IF NOT EXISTS nh360.tickets_nh (
        id                     INT AUTO_INCREMENT PRIMARY KEY,
        ticket_no              VARCHAR(64)   NULL,
        parent_ticket_id       INT           NULL,
        vehicle_reg_no         VARCHAR(64)   NULL,
        alt_vehicle_reg_no     VARCHAR(64)   NULL,
        subject                VARCHAR(255)  NULL,
        details                TEXT          NULL,
        phone                  VARCHAR(32)   NULL,
        alt_phone              VARCHAR(32)   NULL,
        assigned_to            INT           NULL,
        lead_received_from     VARCHAR(255)  NULL,
        lead_by                VARCHAR(255)  NULL,
        status                 VARCHAR(64)   NULL,
        kyv_status             VARCHAR(64)   NULL,
        customer_name          VARCHAR(255)  NULL,
        comments               TEXT          NULL,
        payment_to_collect     DECIMAL(10,2) NULL,
        payment_to_send        DECIMAL(10,2) NULL,
        net_value              DECIMAL(10,2) NULL,
        commission_amount      DECIMAL(10,2) NULL,
        fastag_serial          VARCHAR(255)  NULL,
        fastag_bank            VARCHAR(64)   NULL,
        fastag_class           VARCHAR(32)   NULL,
        fastag_owner           VARCHAR(64)   NULL,
        paid_via               VARCHAR(64)   DEFAULT 'Pending',
        payment_nil            TINYINT(1)    DEFAULT 0,
        delivery_nil           TINYINT(1)    DEFAULT 0,
        payment_received       TINYINT(1)    NULL,
        delivery_done          TINYINT(1)    NULL,
        commission_done        TINYINT(1)    NULL,
        lead_commission        DECIMAL(10,2) NULL,
        lead_commission_paid   TINYINT(1)    DEFAULT 0,
        lead_commission_nil    TINYINT(1)    DEFAULT 0,
        pickup_commission      DECIMAL(10,2) NULL,
        pickup_commission_paid TINYINT(1)    DEFAULT 0,
        pickup_commission_nil  TINYINT(1)    DEFAULT 0,
        pickup_point_name      VARCHAR(255)  NULL,
        npci_status            VARCHAR(64)   NULL,
        rc_front_url           VARCHAR(255)  NULL,
        rc_back_url            VARCHAR(255)  NULL,
        pan_url                VARCHAR(255)  NULL,
        aadhaar_front_url      VARCHAR(255)  NULL,
        aadhaar_back_url       VARCHAR(255)  NULL,
        vehicle_front_url      VARCHAR(255)  NULL,
        vehicle_side_url       VARCHAR(255)  NULL,
        sticker_pasted_url     VARCHAR(255)  NULL,
        created_by             INT           NULL,
        created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at             DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_tickets_parent (parent_ticket_id),
        KEY idx_tickets_assigned (assigned_to),
        KEY idx_tickets_fastag (fastag_serial),
        KEY idx_tickets_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('fastag_sales', `
      CREATE TABLE IF NOT EXISTS nh360.fastag_sales (
        id                 INT AUTO_INCREMENT PRIMARY KEY,
        tag_serial         VARCHAR(255)  NOT NULL,
        ticket_id          INT           NULL,
        vehicle_reg_no     VARCHAR(64)   NULL,
        bank_name          VARCHAR(255)  NULL,
        fastag_class       VARCHAR(32)   NULL,
        supplier_id        INT           NULL,
        bank_login_user_id INT           NULL,
        sold_by_user_id    INT           NULL,
        sold_by_agent_id   INT           NULL,
        payment_to_collect DECIMAL(10,2) NULL,
        payment_to_send    DECIMAL(10,2) NULL,
        net_value          DECIMAL(10,2) NULL,
        commission_amount  DECIMAL(10,2) NULL,
        created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sales_seller (sold_by_user_id),
        KEY idx_sales_agent (sold_by_agent_id),
        KEY idx_sales_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('money_ledger', `
      CREATE TABLE IF NOT EXISTS nh360.money_ledger (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        ref_type   ENUM('ticket','fastag_sale') NOT NULL,
        ref_id     INT           NOT NULL,
        entry_type ENUM('collect','payout','commission') NOT NULL,
        amount     DECIMAL(10,2) NOT NULL,
        created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_ledger_ref (ref_type, ref_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 3. Feature tables
    await run('user_sessions', `
      CREATE TABLE IF NOT EXISTS nh360.user_sessions (
        id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id      INT UNSIGNED NOT NULL,
        user_type    VARCHAR(20)  NOT NULL,
        started_at   DATETIME     NOT NULL,
        last_seen_at DATETIME     NOT NULL,
        ended_at     DATETIME     NULL,
        KEY idx_user_started (user_id, started_at),
        KEY idx_user_last_seen (user_id, last_seen_at),
        KEY idx_open_sessions (user_id, ended_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('chat_messages', `
      CREATE TABLE IF NOT EXISTS nh360.chat_messages (
        id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        from_user_id         INT UNSIGNED    NOT NULL,
        to_user_id           INT UNSIGNED    NOT NULL,
        ticket_id            BIGINT UNSIGNED NULL,
        text                 TEXT            NOT NULL,
        created_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        read_at              DATETIME        NULL,
        cleared_by_sender    TINYINT(1)      DEFAULT 0,
        cleared_by_recipient TINYINT(1)      DEFAULT 0,
        KEY idx_chat_users (from_user_id, to_user_id, created_at),
        KEY idx_chat_to (to_user_id, created_at),
        KEY idx_chat_ticket (ticket_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('dispatch_orders', `
      CREATE TABLE IF NOT EXISTS nh360.dispatch_orders (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        request_number VARCHAR(64)  NOT NULL,
        requester_type VARCHAR(32)  NOT NULL,
        requester_name VARCHAR(255) NOT NULL,
        packed_state   VARCHAR(64)  NOT NULL,
        dispatch_via   VARCHAR(64)  NOT NULL,
        tracking_id    VARCHAR(128) NULL,
        status         VARCHAR(32)  NOT NULL,
        packed_by      VARCHAR(255) NULL,
        created_by     VARCHAR(255) NULL,
        requested_at   DATETIME     NOT NULL,
        eta            DATETIME     NULL,
        created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_request_number (request_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('dispatch_order_items', `
      CREATE TABLE IF NOT EXISTS nh360.dispatch_order_items (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        order_id   INT          NOT NULL,
        bank       VARCHAR(128) NOT NULL,
        class_type VARCHAR(32)  NOT NULL,
        qty        INT          NOT NULL,
        CONSTRAINT fk_doi_order FOREIGN KEY (order_id)
          REFERENCES nh360.dispatch_orders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('ecom_leads', `
      CREATE TABLE IF NOT EXISTS nh360.ecom_leads (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        name         VARCHAR(255) NULL,
        phone        VARCHAR(64)  NULL,
        email        VARCHAR(255) NULL,
        message      TEXT         NULL,
        source       VARCHAR(128) NULL,
        utm_source   VARCHAR(128) NULL,
        utm_medium   VARCHAR(128) NULL,
        utm_campaign VARCHAR(128) NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('ecom_orders', `
      CREATE TABLE IF NOT EXISTS nh360.ecom_orders (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        external_order_id VARCHAR(128)  NULL,
        customer_name     VARCHAR(255)  NULL,
        phone             VARCHAR(64)   NULL,
        email             VARCHAR(255)  NULL,
        items_summary     TEXT          NULL,
        amount            DECIMAL(12,2) NULL,
        currency          VARCHAR(8)    NULL,
        payment_status    VARCHAR(32)   NULL,
        payment_provider  VARCHAR(64)   NULL,
        created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('fastag_transfers', `
      CREATE TABLE IF NOT EXISTS nh360.fastag_transfers (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        tag_serial   VARCHAR(255) NOT NULL,
        from_role    VARCHAR(64)  NULL,
        from_user_id INT          NULL,
        to_role      VARCHAR(64)  NULL,
        to_user_id   INT          NULL,
        bank_name    VARCHAR(255) NULL,
        fastag_class VARCHAR(64)  NULL,
        prefix       VARCHAR(64)  NULL,
        note         TEXT         NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await run('supplier_orders', `
      CREATE TABLE IF NOT EXISTS nh360.supplier_orders (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        supplier_name VARCHAR(255) NOT NULL,
        class_type    VARCHAR(32)  NOT NULL,
        qty_ordered   INT          NOT NULL,
        date_ordered  DATETIME     NOT NULL,
        date_received DATETIME     NULL,
        qty_delivered INT          NULL,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // 4. Seed admin user
    await conn.query(`
      INSERT IGNORE INTO nh360.users (name, email, phone, role, status, password, dashboard)
      VALUES (
        'Admin',
        'admin@nh360fastag.com',
        NULL,
        'admin',
        'Active',
        '$2b$10$DVCjCvm2n7C2yvBNAihFq.FMUANuUJETV7A5RCysDZu2Es4eVwyJe',
        'admin'
      )
    `);
    results.push({ table: 'seed:admin_user', status: 'ok' });

    await conn.end();

    return NextResponse.json({
      success: true,
      message: 'Database nh360 created with all 14 tables.',
      tables_created: results.length - 2, // exclude db + seed
      details: results,
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: 500 }
    );
  }
}
