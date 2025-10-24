/*
  # Bakım Takvimi - Başlangıç ve Bitiş Tarihi Güncellemesi

  1. Değişiklikler
    - `scheduled_date` alanı `start_date` olarak değiştirildi
    - `end_date` alanı eklendi
    - Mevcut veriler korundu
    - İndeksler güncellendi

  2. Özellikler
    - Başlangıç ve bitiş tarihi ile daha detaylı planlama
    - Bakım süresi tarih aralığı ile belirlenir
    - Mevcut veriler otomatik olarak dönüştürülür
*/

-- Yeni end_date alanını ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_schedules' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE maintenance_schedules ADD COLUMN end_date date;
  END IF;
END $$;

-- Mevcut scheduled_date verilerini start_date olarak kopyala ve end_date'i aynı gün olarak ayarla
UPDATE maintenance_schedules 
SET end_date = scheduled_date 
WHERE end_date IS NULL;

-- scheduled_date alanını start_date olarak yeniden adlandır
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_schedules' AND column_name = 'scheduled_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_schedules' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE maintenance_schedules RENAME COLUMN scheduled_date TO start_date;
  END IF;
END $$;

-- end_date alanını NOT NULL yap
ALTER TABLE maintenance_schedules ALTER COLUMN end_date SET NOT NULL;

-- Eski indeksi sil ve yenilerini oluştur
DROP INDEX IF EXISTS idx_maintenance_schedules_scheduled_date;
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_start_date ON maintenance_schedules(start_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_end_date ON maintenance_schedules(end_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_date_range ON maintenance_schedules(start_date, end_date);

-- next_occurrence alanını da start_date olarak güncelle (tekrarlayan bakımlar için)
-- Bu alan zaten nullable olduğu için ek işlem gerekmiyor