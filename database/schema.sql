-- RGI NexaProc MySQL schema
CREATE DATABASE IF NOT EXISTS `rgi_nexaproc`;
USE `rgi_nexaproc`;

-- Users with fixed roles
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('owner','admin','manager','staff') NOT NULL DEFAULT 'staff',
  `title` VARCHAR(150) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `photo_url` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO `users` (`full_name`, `email`, `password`, `role`, `title`)
VALUES ('System Owner', 'admin@gmail.com', 'admin', 'owner', 'Owner')
ON DUPLICATE KEY UPDATE `role` = VALUES(`role`), `password` = VALUES(`password`);

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
  `project_name` VARCHAR(255) NOT NULL,
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
  `rfq_reference` VARCHAR(120) DEFAULT NULL,
  `supplier` VARCHAR(255) DEFAULT NULL,
  `valid_until` DATE DEFAULT NULL,
  `total_amount` DECIMAL(12,2) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'draft',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales Orders
CREATE TABLE IF NOT EXISTS `sales_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_number` VARCHAR(120) NOT NULL,
  `quotation_id` VARCHAR(120) DEFAULT NULL,
  `supplier_id` VARCHAR(120) DEFAULT NULL,
  `total_amount` DECIMAL(12,2) DEFAULT 0,
  `tax_amount` DECIMAL(12,2) DEFAULT 0,
  `grand_total` DECIMAL(12,2) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'pending',
  `delivery_date` DATE DEFAULT NULL,
  `delivery_address` TEXT,
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
