export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'department_manager' | 'maintenance_personnel';
  department_id?: string;
  department?: Department;
  specialization?: string;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Machine {
  id: string;
  name: string;
  department_id: string;
  department?: Department;
  created_at: string;
}

export interface FaultReport {
  id: string;
  machine_id: string;
  machine?: Machine;
  department_id: string;
  department?: Department;
  reporter_id: string;
  reporter?: User;
  fault_type: string;
  priority: 'düşük' | 'orta' | 'yüksek' | 'acil';
  description: string;
  photo_url?: string;
  status: 'açık' | 'atandı' | 'devam_ediyor' | 'tamamlandı' | 'kapatıldı';
  created_at: string;
  updated_at: string;
  assignments?: Assignment[];
  maintenance_actions?: MaintenanceAction[];
}

export interface Assignment {
  id: string;
  fault_report_id: string;
  fault_report?: FaultReport;
  assigned_to_id: string;
  assigned_to?: User;
  assigned_by_id: string;
  assigned_by?: User;
  assigned_at: string;
  completed_at?: string;
}

export interface MaintenanceAction {
  id: string;
  fault_report_id: string;
  personnel_id: string;
  personnel?: User;
  description: string;
  spare_parts: string;
  cost: number;
  action_time: number;
  created_at: string;
}

export interface MaintenanceSchedule {
  id: string;
  machine_id: string;
  machine?: Machine;
  department_id: string;
  department?: Department;
  created_by_id: string;
  created_by?: User;
  title: string;
  description?: string;
  maintenance_type: 'Önleyici' | 'Periyodik' | 'Kalibrasyon' | 'Temizlik' | 'Yağlama' | 'Kontrol' | 'Diğer';
  priority: 'düşük' | 'orta' | 'yüksek' | 'kritik';
  start_date: string;
  end_date: string;
  estimated_duration: number;
  assigned_to_id?: string;
  assigned_to?: User;
  status: 'planlandı' | 'atandı' | 'devam_ediyor' | 'tamamlandı' | 'ertelendi' | 'iptal_edildi';
  recurrence_type?: 'günlük' | 'haftalık' | 'aylık' | 'üç_aylık' | 'altı_aylık' | 'yıllık';
  recurrence_interval?: number;
  next_occurrence?: string;
  completion_notes?: string;
  actual_duration?: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FaultType {
  id: string;
  name: string;
  description?: string;
}