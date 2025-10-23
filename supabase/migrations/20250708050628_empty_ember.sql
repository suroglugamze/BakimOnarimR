/*
  # Bakım Takvimi Sistemi

  1. Yeni Tablolar
    - `maintenance_schedules` - Planlı bakım programları tablosu

  2. Güvenlik
    - RLS etkinleştirildi
    - Bölüm bazlı erişim politikaları oluşturuldu

  3. Özellikler
    - Tekrarlayan bakım programları
    - Durum takibi
    - Otomatik bildirimler için hazırlık
*/

-- Planlı bakım programları tablosu
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  maintenance_type text NOT NULL CHECK (maintenance_type IN ('Önleyici', 'Periyodik', 'Kalibrasyon', 'Temizlik', 'Yağlama', 'Kontrol', 'Diğer')),
  priority text NOT NULL DEFAULT 'orta' CHECK (priority IN ('düşük', 'orta', 'yüksek', 'kritik')),
  scheduled_date date NOT NULL,
  estimated_duration integer DEFAULT 60, -- dakika cinsinden
  assigned_to_id uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'planlandı' CHECK (status IN ('planlandı', 'atandı', 'devam_ediyor', 'tamamlandı', 'ertelendi', 'iptal_edildi')),
  recurrence_type text CHECK (recurrence_type IN ('günlük', 'haftalık', 'aylık', 'üç_aylık', 'altı_aylık', 'yıllık')),
  recurrence_interval integer DEFAULT 1,
  next_occurrence date,
  completion_notes text,
  actual_duration integer,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS'yi etkinleştir
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;

-- Güvenlik politikaları
CREATE POLICY "Users can view maintenance schedules"
  ON maintenance_schedules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        u.role IN ('admin', 'manager') OR
        (u.role = 'department_manager' AND u.department_id = maintenance_schedules.department_id) OR
        u.id = maintenance_schedules.assigned_to_id OR
        u.role = 'maintenance_personnel'
      )
    )
  );

CREATE POLICY "Authorized users can create maintenance schedules"
  ON maintenance_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by_id AND
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'manager', 'department_manager')
    )
  );

CREATE POLICY "Authorized users can update maintenance schedules"
  ON maintenance_schedules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        u.role IN ('admin', 'manager') OR
        (u.role = 'department_manager' AND u.department_id = maintenance_schedules.department_id) OR
        u.id = maintenance_schedules.assigned_to_id
      )
    )
  );

CREATE POLICY "Admins can delete maintenance schedules"
  ON maintenance_schedules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Güncellenme zamanı için trigger
CREATE TRIGGER update_maintenance_schedules_updated_at 
    BEFORE UPDATE ON maintenance_schedules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_machine ON maintenance_schedules(machine_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_department ON maintenance_schedules(department_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_assigned_to ON maintenance_schedules(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_scheduled_date ON maintenance_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_status ON maintenance_schedules(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_next_occurrence ON maintenance_schedules(next_occurrence);