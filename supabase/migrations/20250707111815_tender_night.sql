/*
  # Uzmanlık Alanı Sistemi

  1. Yeni Özellikler
    - `users` tablosuna `specialization` alanı eklendi
    - Arıza tipi ile uzmanlık alanı eşleştirmesi
    - Atama sisteminde uzmanlık kontrolü

  2. Uzmanlık Alanları
    - Mekanik
    - Elektrik
    - Bilgi İşlem
    - Pnömatik
    - Hidrolik
    - Yazılım
    - Genel (tüm alanlarda çalışabilir)

  3. Güvenlik
    - Mevcut politikalar korundu
    - Yeni alan için varsayılan değer eklendi
*/

-- Users tablosuna specialization alanı ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'specialization'
  ) THEN
    ALTER TABLE users ADD COLUMN specialization text DEFAULT 'Genel';
  END IF;
END $$;

-- Specialization alanı için check constraint ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'users_specialization_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_specialization_check 
    CHECK (specialization IN ('Mekanik', 'Elektrik', 'Bilgi İşlem', 'Pnömatik', 'Hidrolik', 'Yazılım', 'Genel'));
  END IF;
END $$;

-- Mevcut bakım personeli için varsayılan uzmanlık alanı ayarla
UPDATE users 
SET specialization = 'Genel' 
WHERE role = 'maintenance_personnel' 
AND (specialization IS NULL OR specialization = '');

-- Specialization alanı için indeks ekle
CREATE INDEX IF NOT EXISTS idx_users_specialization ON users(specialization);