/*
  # Ana yöneticinin arızaları silebilmesi için politika ekleme

  1. Güvenlik
    - Ana yöneticiler için DELETE politikası eklendi
    - Mevcut politikalar korundu

  2. Değişiklikler
    - fault_reports tablosuna DELETE politikası eklendi
    - Sadece admin rolündeki kullanıcılar silebilir
*/

-- Ana yöneticilerin arızaları silebilmesi için DELETE politikası ekle
CREATE POLICY "Admins can delete fault reports"
  ON fault_reports
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );