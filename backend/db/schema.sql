-- Expense Tracker database schema (MySQL 8.0+)
-- Run with: npm run db:migrate   (or: mysql -u root -p expense_tracker < db/schema.sql)

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  currency      CHAR(3)       NOT NULL DEFAULT 'INR',
  timezone      VARCHAR(64)   NOT NULL DEFAULT 'Asia/Kolkata',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS accounts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED  NOT NULL,
  name            VARCHAR(100)  NOT NULL,
  type            ENUM('cash','bank','credit_card','wallet','investment','loan') NOT NULL DEFAULT 'bank',
  opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  color           CHAR(7)       NOT NULL DEFAULT '#6366f1',
  archived        TINYINT(1)    NOT NULL DEFAULT 0,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_accounts_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(100) NOT NULL,
  kind       ENUM('income','expense') NOT NULL,
  color      CHAR(7)      NOT NULL DEFAULT '#64748b',
  icon       VARCHAR(40)  NOT NULL DEFAULT '🏷️',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_category (user_id, name, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recurring (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED  NOT NULL,
  type           ENUM('expense','income','transfer') NOT NULL,
  amount         DECIMAL(14,2) NOT NULL,
  account_id     INT UNSIGNED  NOT NULL,
  to_account_id  INT UNSIGNED  NULL,
  category_id    INT UNSIGNED  NULL,
  payee          VARCHAR(200)  NOT NULL DEFAULT '',
  notes          VARCHAR(1000) NOT NULL DEFAULT '',
  frequency      ENUM('daily','weekly','monthly','yearly') NOT NULL DEFAULT 'monthly',
  interval_count INT UNSIGNED  NOT NULL DEFAULT 1,
  next_date      DATE          NOT NULL,
  end_date       DATE          NULL,
  active         TINYINT(1)    NOT NULL DEFAULT 1,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recurring_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_to_account FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_recurring_due (user_id, active, next_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED  NOT NULL,
  type          ENUM('expense','income','transfer') NOT NULL,
  -- Always positive; `type` decides the direction of the money.
  amount        DECIMAL(14,2) NOT NULL,
  date          DATE          NOT NULL,
  account_id    INT UNSIGNED  NOT NULL,
  -- Destination account, only for transfers.
  to_account_id INT UNSIGNED  NULL,
  category_id   INT UNSIGNED  NULL,
  payee         VARCHAR(200)  NOT NULL DEFAULT '',
  notes         VARCHAR(1000) NOT NULL DEFAULT '',
  recurring_id  INT UNSIGNED  NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tx_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_tx_to_account FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_tx_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_tx_recurring FOREIGN KEY (recurring_id) REFERENCES recurring(id) ON DELETE SET NULL,
  INDEX idx_tx_user_date (user_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS budgets (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED  NOT NULL,
  category_id INT UNSIGNED  NOT NULL,
  -- Monthly spending limit.
  amount      DECIMAL(14,2) NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE KEY uq_budget (user_id, category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS goals (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED  NOT NULL,
  name          VARCHAR(100)  NOT NULL,
  target_amount DECIMAL(14,2) NOT NULL,
  saved_amount  DECIMAL(14,2) NOT NULL DEFAULT 0,
  target_date   DATE          NULL,
  color         CHAR(7)       NOT NULL DEFAULT '#10b981',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
