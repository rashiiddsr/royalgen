/*
  # Royal General Indonesia Procurement System Schema

  ## Overview
  Complete procurement management system with role-based access control

  ## New Tables

  ### 1. `user_profiles`
  - `id` (uuid, references auth.users)
  - `full_name` (text)
  - `role` (text) - admin, procurement, sales, finance, warehouse
  - `division` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `suppliers`
  - `id` (uuid, primary key)
  - `name` (text)
  - `contact_person` (text)
  - `email` (text)
  - `phone` (text)
  - `address` (text)
  - `city` (text)
  - `country` (text)
  - `tax_id` (text)
  - `payment_terms` (text)
  - `status` (text) - active, inactive
  - `created_by` (uuid)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `goods`
  - `id` (uuid, primary key)
  - `sku` (text, unique)
  - `name` (text)
  - `description` (text)
  - `category` (text)
  - `unit` (text) - pcs, kg, liter, etc
  - `price` (decimal)
  - `stock_quantity` (integer)
  - `minimum_order_quantity` (integer)
  - `status` (text) - active, inactive
  - `created_by` (uuid)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. `rfqs` (Request for Quotation)
  - `id` (uuid, primary key)
  - `rfq_number` (text, unique)
  - `title` (text)
  - `description` (text)
  - `supplier_id` (uuid)
  - `status` (text) - draft, sent, quoted, accepted, rejected
  - `due_date` (date)
  - `created_by` (uuid)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. `rfq_items`
  - `id` (uuid, primary key)
  - `rfq_id` (uuid)
  - `goods_id` (uuid)
  - `quantity` (integer)
  - `notes` (text)
  - `created_at` (timestamptz)

  ### 6. `quotations`
  - `id` (uuid, primary key)
  - `quotation_number` (text, unique)
  - `rfq_id` (uuid)
  - `supplier_id` (uuid)
  - `total_amount` (decimal)
  - `tax_amount` (decimal)
  - `grand_total` (decimal)
  - `status` (text) - draft, submitted, approved, rejected
  - `valid_until` (date)
  - `notes` (text)
  - `created_by` (uuid)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. `quotation_items`
  - `id` (uuid, primary key)
  - `quotation_id` (uuid)
  - `goods_id` (uuid)
  - `quantity` (integer)
  - `unit_price` (decimal)
  - `subtotal` (decimal)
  - `created_at` (timestamptz)

  ### 8. `sales_orders`
  - `id` (uuid, primary key)
  - `order_number` (text, unique)
  - `quotation_id` (uuid)
  - `supplier_id` (uuid)
  - `total_amount` (decimal)
  - `tax_amount` (decimal)
  - `grand_total` (decimal)
  - `status` (text) - pending, confirmed, completed, cancelled
  - `delivery_date` (date)
  - `delivery_address` (text)
  - `notes` (text)
  - `created_by` (uuid)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 9. `sales_order_items`
  - `id` (uuid, primary key)
  - `order_id` (uuid)
  - `goods_id` (uuid)
  - `quantity` (integer)
  - `unit_price` (decimal)
  - `subtotal` (decimal)
  - `created_at` (timestamptz)

  ### 10. `invoices`
  - `id` (uuid, primary key)
  - `invoice_number` (text, unique)
  - `order_id` (uuid)
  - `supplier_id` (uuid)
  - `total_amount` (decimal)
  - `tax_amount` (decimal)
  - `grand_total` (decimal)
  - `status` (text) - draft, sent, paid, overdue, cancelled
  - `due_date` (date)
  - `paid_date` (date)
  - `payment_method` (text)
  - `notes` (text)
  - `created_by` (uuid)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 11. `financing`
  - `id` (uuid, primary key)
  - `financing_number` (text, unique)
  - `invoice_id` (uuid)
  - `financing_type` (text) - bank_loan, credit_line, factoring, leasing
  - `amount` (decimal)
  - `interest_rate` (decimal)
  - `term_months` (integer)
  - `status` (text) - pending, approved, active, completed, rejected
  - `start_date` (date)
  - `end_date` (date)
  - `notes` (text)
  - `created_by` (uuid)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies for role-based access control
  - Users can only access data relevant to their role
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'procurement', 'sales', 'finance', 'warehouse')),
  division text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  city text,
  country text DEFAULT 'Indonesia',
  tax_id text,
  payment_terms text DEFAULT 'Net 30',
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create goods table
CREATE TABLE IF NOT EXISTS goods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  unit text DEFAULT 'pcs',
  price decimal(15,2) DEFAULT 0,
  stock_quantity integer DEFAULT 0,
  minimum_order_quantity integer DEFAULT 1,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create rfqs table
CREATE TABLE IF NOT EXISTS rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  supplier_id uuid REFERENCES suppliers(id),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'quoted', 'accepted', 'rejected')),
  due_date date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create rfq_items table
CREATE TABLE IF NOT EXISTS rfq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid REFERENCES rfqs(id) ON DELETE CASCADE,
  goods_id uuid REFERENCES goods(id),
  quantity integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create quotations table
CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number text UNIQUE NOT NULL,
  rfq_id uuid REFERENCES rfqs(id),
  supplier_id uuid REFERENCES suppliers(id),
  total_amount decimal(15,2) DEFAULT 0,
  tax_amount decimal(15,2) DEFAULT 0,
  grand_total decimal(15,2) DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  valid_until date,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quotation_items table
CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE,
  goods_id uuid REFERENCES goods(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(15,2) NOT NULL,
  subtotal decimal(15,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create sales_orders table
CREATE TABLE IF NOT EXISTS sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  quotation_id uuid REFERENCES quotations(id),
  supplier_id uuid REFERENCES suppliers(id),
  total_amount decimal(15,2) DEFAULT 0,
  tax_amount decimal(15,2) DEFAULT 0,
  grand_total decimal(15,2) DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  delivery_date date,
  delivery_address text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sales_order_items table
CREATE TABLE IF NOT EXISTS sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES sales_orders(id) ON DELETE CASCADE,
  goods_id uuid REFERENCES goods(id),
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(15,2) NOT NULL,
  subtotal decimal(15,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  order_id uuid REFERENCES sales_orders(id),
  supplier_id uuid REFERENCES suppliers(id),
  total_amount decimal(15,2) DEFAULT 0,
  tax_amount decimal(15,2) DEFAULT 0,
  grand_total decimal(15,2) DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date date,
  paid_date date,
  payment_method text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create financing table
CREATE TABLE IF NOT EXISTS financing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financing_number text UNIQUE NOT NULL,
  invoice_id uuid REFERENCES invoices(id),
  financing_type text CHECK (financing_type IN ('bank_loan', 'credit_line', 'factoring', 'leasing')),
  amount decimal(15,2) NOT NULL,
  interest_rate decimal(5,2) DEFAULT 0,
  term_months integer DEFAULT 12,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'completed', 'rejected')),
  start_date date,
  end_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- RLS Policies for suppliers
CREATE POLICY "Authenticated users can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Procurement and admin can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement', 'sales')
    )
  );

CREATE POLICY "Procurement and admin can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement', 'sales')
    )
  );

-- RLS Policies for goods
CREATE POLICY "Authenticated users can view goods"
  ON goods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Procurement, warehouse, and admin can manage goods"
  ON goods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement', 'warehouse')
    )
  );

CREATE POLICY "Procurement, warehouse, and admin can update goods"
  ON goods FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement', 'warehouse')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement', 'warehouse')
    )
  );

-- RLS Policies for rfqs
CREATE POLICY "Authenticated users can view RFQs"
  ON rfqs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Procurement and admin can create RFQs"
  ON rfqs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement')
    )
  );

CREATE POLICY "Procurement and admin can update RFQs"
  ON rfqs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement')
    )
  );

-- RLS Policies for rfq_items
CREATE POLICY "Authenticated users can view RFQ items"
  ON rfq_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Procurement and admin can manage RFQ items"
  ON rfq_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement')
    )
  );

CREATE POLICY "Procurement and admin can delete RFQ items"
  ON rfq_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement')
    )
  );

-- RLS Policies for quotations
CREATE POLICY "Authenticated users can view quotations"
  ON quotations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales, procurement, and admin can create quotations"
  ON quotations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement', 'sales')
    )
  );

CREATE POLICY "Sales, procurement, and admin can update quotations"
  ON quotations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement', 'sales')
    )
  );

-- RLS Policies for quotation_items
CREATE POLICY "Authenticated users can view quotation items"
  ON quotation_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales, procurement, and admin can manage quotation items"
  ON quotation_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement', 'sales')
    )
  );

CREATE POLICY "Sales, procurement, and admin can delete quotation items"
  ON quotation_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'procurement', 'sales')
    )
  );

-- RLS Policies for sales_orders
CREATE POLICY "Authenticated users can view sales orders"
  ON sales_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and admin can create orders"
  ON sales_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Sales and admin can update orders"
  ON sales_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'sales')
    )
  );

-- RLS Policies for sales_order_items
CREATE POLICY "Authenticated users can view order items"
  ON sales_order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and admin can manage order items"
  ON sales_order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Sales and admin can delete order items"
  ON sales_order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'sales')
    )
  );

-- RLS Policies for invoices
CREATE POLICY "Authenticated users can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Finance and admin can create invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'finance')
    )
  );

CREATE POLICY "Finance and admin can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'finance')
    )
  );

-- RLS Policies for financing
CREATE POLICY "Finance and admin can view financing"
  ON financing FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'finance')
    )
  );

CREATE POLICY "Finance and admin can create financing"
  ON financing FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'finance')
    )
  );

CREATE POLICY "Finance and admin can update financing"
  ON financing FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'finance')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_goods_sku ON goods(sku);
CREATE INDEX IF NOT EXISTS idx_goods_status ON goods(status);
CREATE INDEX IF NOT EXISTS idx_rfqs_status ON rfqs(status);
CREATE INDEX IF NOT EXISTS idx_rfqs_supplier ON rfqs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_items_rfq ON rfq_items(rfq_id);
CREATE INDEX IF NOT EXISTS idx_quotations_rfq ON quotations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_financing_invoice ON financing(invoice_id);
CREATE INDEX IF NOT EXISTS idx_financing_status ON financing(status);