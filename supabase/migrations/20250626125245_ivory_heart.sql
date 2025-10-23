/*
  # Endüstriyel Bakım-Onarım Takip Sistemi - Veritabanı Şeması

  1. Yeni Tablolar
    - `departments` - Bölümler tablosu
    - `users` - Kullanıcılar tablosu (auth.users ile bağlantılı)
    - `machines` - Makineler tablosu
    - `fault_reports` - Arıza bildirimler tablosu
    - `assignments` - Atamalar tablosu
    - `maintenance_actions` - Bakım işlemleri tablosu

  2. Güvenlik
    - Tüm tablolar için RLS etkinleştirildi
    - Kullanıcı rollerine göre erişim politikaları oluşturuldu
    - Bölüm bazlı yetkilendirme sistemi kuruldu

  3. Özellikler
    - Otomatik güncelleme zamanı trigger'ı
    - Performans için indeksler
    - Veri bütünlüğü için foreign key kısıtlamaları
*/

-- Bölümler tablosu
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Kullanıcılar tablosu
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'department_manager', 'maintenance_personnel', 'operator')),
  department_id uuid REFERENCES departments(id),
  created_at timestamptz DEFAULT now()
);

-- Makineler tablosu
CREATE TABLE IF NOT EXISTS machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Arıza bildirimler tablosu
CREATE TABLE IF NOT EXISTS fault_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fault_type text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('düşük', 'orta', 'yüksek', 'acil')),
  description text NOT NULL,
  photo_url text,
  status text NOT NULL DEFAULT 'açık' CHECK (status IN ('açık', 'atandı', 'devam_ediyor', 'tamamlandı', 'kapatıldı')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Atamalar tablosu
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fault_report_id uuid NOT NULL REFERENCES fault_reports(id) ON DELETE CASCADE,
  assigned_to_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Bakım işlemleri tablosu
CREATE TABLE IF NOT EXISTS maintenance_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fault_report_id uuid NOT NULL REFERENCES fault_reports(id) ON DELETE CASCADE,
  personnel_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description text NOT NULL,
  spare_parts text DEFAULT '',
  cost numeric DEFAULT 0,
  action_time integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS'yi etkinleştir
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fault_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_actions ENABLE ROW LEVEL SECURITY;

-- Departments için güvenlik politikaları
CREATE POLICY "Users can view all departments"
  ON departments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage departments"
  ON departments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Users için güvenlik politikaları
CREATE POLICY "Users can view their own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view colleagues in same department"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        u.role IN ('admin', 'manager') OR
        (u.role = 'department_manager' AND u.department_id = users.department_id)
      )
    )
  );

CREATE POLICY "Admins can manage users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Machines için güvenlik politikaları
CREATE POLICY "Users can view machines"
  ON machines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        u.role IN ('admin', 'manager') OR
        (u.role = 'department_manager' AND u.department_id = machines.department_id) OR
        u.role IN ('maintenance_personnel', 'operator')
      )
    )
  );

CREATE POLICY "Admins and managers can manage machines"
  ON machines
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'manager')
    )
  );

-- Fault reports için güvenlik politikaları
CREATE POLICY "Users can view fault reports"
  ON fault_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        u.role IN ('admin', 'manager') OR
        (u.role = 'department_manager' AND u.department_id = fault_reports.department_id) OR
        u.id = fault_reports.reporter_id OR
        u.role = 'maintenance_personnel'
      )
    )
  );

CREATE POLICY "Users can create fault reports"
  ON fault_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id AND
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'manager', 'department_manager', 'operator')
    )
  );

CREATE POLICY "Authorized users can update fault reports"
  ON fault_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        u.role IN ('admin', 'manager') OR
        (u.role = 'department_manager' AND u.department_id = fault_reports.department_id) OR
        u.role = 'maintenance_personnel'
      )
    )
  );

-- Assignments için güvenlik politikaları
CREATE POLICY "Users can view assignments"
  ON assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        u.role IN ('admin', 'manager') OR
        u.id = assignments.assigned_to_id OR
        u.id = assignments.assigned_by_id OR
        (u.role = 'department_manager' AND 
         EXISTS (
           SELECT 1 FROM fault_reports fr 
           WHERE fr.id = assignments.fault_report_id 
           AND fr.department_id = u.department_id
         ))
      )
    )
  );

CREATE POLICY "Authorized users can create assignments"
  ON assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = assigned_by_id AND
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'manager', 'department_manager')
    )
  );

CREATE POLICY "Authorized users can update assignments"
  ON assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        u.role IN ('admin', 'manager') OR
        u.id = assignments.assigned_to_id OR
        (u.role = 'department_manager' AND 
         EXISTS (
           SELECT 1 FROM fault_reports fr 
           WHERE fr.id = assignments.fault_report_id 
           AND fr.department_id = u.department_id
         ))
      )
    )
  );

-- Maintenance actions için güvenlik politikaları
CREATE POLICY "Users can view maintenance actions"
  ON maintenance_actions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        u.role IN ('admin', 'manager') OR
        u.id = maintenance_actions.personnel_id OR
        (u.role = 'department_manager' AND 
         EXISTS (
           SELECT 1 FROM fault_reports fr 
           WHERE fr.id = maintenance_actions.fault_report_id 
           AND fr.department_id = u.department_id
         ))
      )
    )
  );

CREATE POLICY "Maintenance personnel can create actions"
  ON maintenance_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = personnel_id AND
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'manager', 'maintenance_personnel')
    )
  );

-- Güncellenme zamanı için trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fault_reports_updated_at 
    BEFORE UPDATE ON fault_reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_machines_department ON machines(department_id);
CREATE INDEX IF NOT EXISTS idx_fault_reports_status ON fault_reports(status);
CREATE INDEX IF NOT EXISTS idx_fault_reports_priority ON fault_reports(priority);
CREATE INDEX IF NOT EXISTS idx_fault_reports_department ON fault_reports(department_id);
CREATE INDEX IF NOT EXISTS idx_fault_reports_created_at ON fault_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_assignments_fault_report ON assignments(fault_report_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON assignments(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_actions_fault_report ON maintenance_actions(fault_report_id);