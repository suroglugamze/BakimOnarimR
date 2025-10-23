import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Machine, Department } from '../types';
import { AlertTriangle, Upload, Check } from 'lucide-react';

export default function FaultReport() {
  const { appUser } = useAuth();
  const [formData, setFormData] = useState({
    machine_id: '',
    fault_type: '',
    priority: 'orta' as 'düşük' | 'orta' | 'yüksek' | 'acil',
    description: '',
  });
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const faultTypes = [
    'Mekanik',
    'Elektrik',
    'Bilgi İşlem',
    'Pnömatik',
    'Hidrolik',
    'Yazılım',
    'Diğer'
  ];

  useEffect(() => {
    fetchMachines();
    fetchDepartments();
  }, [appUser]);

  const fetchMachines = async () => {
    try {
      let query = supabase
        .from('machines')
        .select(`
          *,
          department:departments(*)
        `)
        .order('name');

      // Department managers can see machines from their department
      if (appUser?.role === 'department_manager' && appUser.department_id) {
        query = query.eq('department_id', appUser.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMachines(data || []);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;

    setLoading(true);
    setSuccess(false);

    try {
      const selectedMachine = machines.find(m => m.id === formData.machine_id);
      
      const { error } = await supabase
        .from('fault_reports')
        .insert({
          machine_id: formData.machine_id,
          department_id: selectedMachine?.department_id,
          reporter_id: appUser.id,
          fault_type: formData.fault_type,
          priority: formData.priority,
          description: formData.description,
          status: 'açık'
        });

      if (error) throw error;

      setSuccess(true);
      setFormData({
        machine_id: '',
        fault_type: '',
        priority: 'orta',
        description: '',
      });

      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error creating fault report:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user can report faults
  const canReportFaults = appUser && ['admin', 'manager', 'department_manager'].includes(appUser.role);

  if (!canReportFaults) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="h-8 w-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900">Arıza Bildirimi</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center py-8">
            <AlertTriangle size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Erişim Reddedildi</h3>
            <p className="text-gray-600">Arıza bildirimi yapma yetkiniz bulunmamaktadır.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <AlertTriangle className="h-8 w-8 text-orange-600" />
        <h1 className="text-3xl font-bold text-gray-900">Arıza Bildirimi</h1>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center">
          <Check size={20} className="text-green-600 mr-2" />
          <span className="text-green-800">Arıza bildirimi başarıyla oluşturuldu!</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Info for department managers */}
        {appUser?.role === 'department_manager' && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Bilgi:</strong> {appUser.department?.name || 'Bölümünüz'} kapsamındaki makineler için arıza bildirimi yapabilirsiniz.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Makine Seçimi *
              </label>
              <select
                required
                value={formData.machine_id}
                onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">Makine seçiniz</option>
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.name} - {machine.department?.name}
                  </option>
                ))}
              </select>
              {machines.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  {appUser?.role === 'department_manager' 
                    ? 'Bölümünüzde kayıtlı makine bulunmamaktadır.'
                    : 'Henüz makine kaydı bulunmamaktadır.'
                  }
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Arıza Tipi *
              </label>
              <select
                required
                value={formData.fault_type}
                onChange={(e) => setFormData({ ...formData, fault_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">Arıza tipi seçiniz</option>
                {faultTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Öncelik Seviyesi *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'düşük', label: 'Düşük', color: 'bg-green-100 text-green-800 border-green-300' },
                { value: 'orta', label: 'Orta', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                { value: 'yüksek', label: 'Yüksek', color: 'bg-orange-100 text-orange-800 border-orange-300' },
                { value: 'acil', label: 'Acil', color: 'bg-red-100 text-red-800 border-red-300' },
              ].map((priority) => (
                <label key={priority.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    value={priority.value}
                    checked={formData.priority === priority.value}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="sr-only"
                  />
                  <div className={`p-3 rounded-lg border-2 text-center font-medium transition-all ${
                    formData.priority === priority.value 
                      ? priority.color 
                      : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
                  }`}>
                    {priority.label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Arıza Açıklaması *
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Arıza detaylarını açıklayınız..."
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-gray-500">
              <p>Bildirimi yapan: {appUser?.name}</p>
              <p>Rol: {
                appUser?.role === 'admin' ? 'Ana Yönetici' :
                appUser?.role === 'manager' ? 'Yönetici' :
                appUser?.role === 'department_manager' ? 'Birim Yöneticisi' : appUser?.role
              }</p>
              {appUser?.department && (
                <p>Bölüm: {appUser.department.name}</p>
              )}
              <p>Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
            </div>
            
            <button
              type="submit"
              disabled={loading || machines.length === 0}
              className="bg-orange-600 text-white px-6 py-2 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Kaydediliyor...' : 'Arıza Bildir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}