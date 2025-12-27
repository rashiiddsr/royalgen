-- RGI NexaProc MySQL schema
CREATE DATABASE IF NOT EXISTS `rgi_nexaproc`;
USE `rgi_nexaproc`;

-- Users with fixed roles
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `username` VARCHAR(120) DEFAULT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `password_reset_required` TINYINT(1) NOT NULL DEFAULT 0,
  `role` ENUM('superadmin','admin','manager','staff') NOT NULL DEFAULT 'staff',
  `title` VARCHAR(150) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `photo_url` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO `users` (`full_name`, `username`, `email`, `password`, `password_reset_required`, `role`, `title`, `phone`)
VALUES ('Mhd Zidane Alparizi', 'zidanist', 'zidanalfarizi321@gmail.com', 'scrypt$55bfb64956e76e8a298867897d5d47d6:5067c8b96e780777ddff0dc873790293c1725ecd460e1facb4d708d7a419d1587a87c9be8a62465eb67f09eefd124b9e54e2d69458f90052f862883f1f219adf', 0, 'superadmin', 'Superadmin', '82170179410')
ON DUPLICATE KEY UPDATE `role` = VALUES(`role`), `password` = VALUES(`password`), `phone` = VALUES(`phone`), `full_name` = VALUES(`full_name`), `username` = VALUES(`username`), `password_reset_required` = VALUES(`password_reset_required`);

CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `used_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_password_resets_user` (`user_id`),
  INDEX `idx_password_resets_token` (`token_hash`),
  CONSTRAINT `fk_password_resets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- Suppliers
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `contact_person` VARCHAR(255) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(100) DEFAULT NULL,
  `address` TEXT,
  `city` VARCHAR(150) DEFAULT NULL,
  `country` VARCHAR(150) DEFAULT NULL,
  `tax_id` VARCHAR(150) DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'active',
  `payment_terms` VARCHAR(150) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Goods / products
CREATE TABLE IF NOT EXISTS `goods` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sku` VARCHAR(120) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `category` ENUM('consumable','instrument','electrical','piping','other') DEFAULT 'other',
  `unit` VARCHAR(50) DEFAULT 'pcs',
  `price` DECIMAL(12,2) DEFAULT 0,
  `stock_quantity` INT DEFAULT 0,
  `minimum_order_quantity` INT DEFAULT 1,
  `status` VARCHAR(50) DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Goods & Suppliers relationship
CREATE TABLE IF NOT EXISTS `goods_suppliers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `good_id` INT NOT NULL,
  `supplier_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_good_supplier` (`good_id`, `supplier_id`),
  CONSTRAINT `fk_good` FOREIGN KEY (`good_id`) REFERENCES `goods` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE
);

-- RFQs
CREATE TABLE IF NOT EXISTS `rfqs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rfq_number` VARCHAR(120) NOT NULL,
  `company_name` VARCHAR(255) NOT NULL,
  `pic_name` VARCHAR(255) NOT NULL,
  `pic_email` VARCHAR(255) NOT NULL,
  `pic_phone` VARCHAR(100) NOT NULL,
  `goods` JSON DEFAULT NULL,
  `attachment_url` VARCHAR(500) DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'draft',
  `performed_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quotations
CREATE TABLE IF NOT EXISTS `quotations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `quotation_number` VARCHAR(120) NOT NULL,
  `rfq_id` INT DEFAULT NULL,
  `company_name` VARCHAR(255) DEFAULT NULL,
  `pic_name` VARCHAR(255) DEFAULT NULL,
  `pic_email` VARCHAR(255) DEFAULT NULL,
  `pic_phone` VARCHAR(100) DEFAULT NULL,
  `payment_time` VARCHAR(120) DEFAULT NULL,
  `goods` JSON DEFAULT NULL,
  `total_amount` DECIMAL(12,2) DEFAULT 0,
  `tax_amount` DECIMAL(12,2) DEFAULT 0,
  `grand_total` DECIMAL(12,2) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'waiting',
  `negotiation_round` INT DEFAULT 0,
  `performed_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales Orders
CREATE TABLE IF NOT EXISTS `sales_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_number` VARCHAR(120) NOT NULL,
  `po_number` VARCHAR(120) DEFAULT NULL,
  `project_name` VARCHAR(255) DEFAULT NULL,
  `order_date` DATE DEFAULT NULL,
  `quotation_id` INT DEFAULT NULL,
  `company_name` VARCHAR(255) DEFAULT NULL,
  `pic_name` VARCHAR(255) DEFAULT NULL,
  `pic_email` VARCHAR(255) DEFAULT NULL,
  `pic_phone` VARCHAR(100) DEFAULT NULL,
  `payment_time` VARCHAR(120) DEFAULT NULL,
  `goods` JSON DEFAULT NULL,
  `documents` JSON DEFAULT NULL,
  `total_amount` DECIMAL(12,2) DEFAULT 0,
  `tax_amount` DECIMAL(12,2) DEFAULT 0,
  `grand_total` DECIMAL(12,2) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'ongoing',
  `created_by` INT DEFAULT NULL,
  `last_edited_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delivery Orders
CREATE TABLE IF NOT EXISTS `delivery_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `delivery_number` VARCHAR(120) NOT NULL,
  `delivery_date` DATE NOT NULL,
  `sales_order_id` INT NOT NULL,
  `company_name` VARCHAR(255) DEFAULT NULL,
  `goods` JSON DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_number` VARCHAR(120) NOT NULL,
  `customer_name` VARCHAR(255) DEFAULT NULL,
  `order_reference` VARCHAR(120) DEFAULT NULL,
  `total_amount` DECIMAL(12,2) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'draft',
  `due_date` DATE DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Financing records
CREATE TABLE IF NOT EXISTS `financing` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_id` VARCHAR(120) NOT NULL,
  `partner` VARCHAR(255) DEFAULT NULL,
  `amount` DECIMAL(12,2) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'review',
  `funding_date` DATE DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User activity logs
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `entity_type` VARCHAR(100) NOT NULL,
  `entity_id` INT NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_action` (`user_id`, `entity_type`, `entity_id`),
  CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
