import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FaultReport, User } from '../types';
import { Users, Clock, AlertTriangle, UserCheck, Edit, X, Check, Wrench } from 'lucide-react';

export default function Assignment() {
  const { appUser } = useAuth();
  const [faults, setFaults] = useState<FaultReport[]>([]);
  const [personnel, setPersonnel] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFault, setSelectedFault] = useState<string>('');
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>('');
  const [editingFault, setEditingFault] = useState<FaultReport | null>(null);
  const [editForm, setEditForm] = useState({
    fault_type: '',
    priority: 'orta' as 'düşük' | 'orta' | 'yüksek' | 'acil',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const faultTypes = [
    'Mekanik',
    'Elektrik',
    'Bilgi İşlem',
    'Pnömatik',
    'Hidrolik',
    'Yazılım',
    'Diğer'
  ];

  // Arıza tipi ile uzmanlık alanı eşleştirmesi
  const getSpecializationForFaultType = (faultType: string): string[] => {
    const mapping: { [key: string]: string[] } = {
      'Mekanik': ['Mekanik', 'Genel'],
      'Elektrik': ['Elektrik', 'Genel'],
      'Bilgi İşlem': ['Bilgi İşlem', 'Genel'],
      'Pnömatik': ['Pnömatik', 'Mekanik', 'Genel'],
      'Hidrolik': ['Hidrolik', 'Mekanik', 'Genel'],
      'Yazılım': ['Yazılım', 'Bilgi İşlem', 'Genel'],
      'Diğer': ['Genel']
    };
    return mapping[faultType] || ['Genel'];
  };

  useEffect(() => {
    fetchOpenFaults();
    fetchMaintenancePersonnel();
  }, [appUser]);

  const fetchOpenFaults = async () => {
    try {
      let query = supabase
        .from('fault_reports')
        .select(`
          *,
          machine:machines(*),
          department:departments(*),
          reporter:users(*),
          assignments:assignments(
            *,
            assigned_to:users!assignments_assigned_to_id_fkey(*)
          )
        `)
        .in('status', ['açık', 'atandı'])
        .order('created_at', { ascending: false });

      // Filter by department for department managers
      if (appUser?.role === 'department_manager' && appUser.department_id) {
        query = query.eq('department_id', appUser.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setFaults(data || []);
    } catch (error) {
      console.error('Error fetching faults:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenancePersonnel = async () => {
    try {
      let query = supabase
        .from('users')
        .select('*')
        .eq('role', 'maintenance_personnel')
        .order('name');

      // Filter by department for department managers - only show personnel from same department
      if (appUser?.role === 'department_manager' && appUser.department_id) {
        query = query.eq('department_id', appUser.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPersonnel(data || []);
    } catch (error) {
      console.error('Error fetching personnel:', error);
    }
  };

  const getCompatiblePersonnel = (faultType: string) => {
    const requiredSpecializations = getSpecializationForFaultType(faultType);
    return personnel.filter(person => 
      requiredSpecializations.includes(person.specialization || 'Genel')
    );
  };

  const handleAssign = async (faultId: string, personnelId: string) => {
    if (!appUser) return;

    try {
      // Create assignment
      const { error: assignmentError } = await supabase
        .from('assignments')
        .insert({
          fault_report_id: faultId,
          assigned_to_id: personnelId,
          assigned_by_id: appUser.id,
          assigned_at: new Date().toISOString()
        });

      if (assignmentError) throw assignmentError;

      // Update fault status
      const { error: faultError } = await supabase
        .from('fault_reports')
        .update({ status: 'atandı' })
        .eq('id', faultId);

      if (faultError) throw faultError;

      // Refresh data
      await fetchOpenFaults();
      setSelectedFault('');
      setSelectedPersonnel('');
    } catch (error) {
      console.error('Error assigning fault:', error);
    }
  };

  const handleEditFault = (fault: FaultReport) => {
    setEditingFault(fault);
    setEditForm({
      fault_type: fault.fault_type,
      priority: fault.priority,
      description: fault.description
    });
  };

  const handleUpdateFault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFault) return;

    setSubmitting(true);
    try {
      // Start a transaction to update fault and remove assignments
      const { error: faultError } = await supabase
        .from('fault_reports')
        .update({
          fault_type: editForm.fault_type,
          priority: editForm.priority,
          description: editForm.description,
          status: 'açık', // Reset status to 'açık' when edited
          updated_at: new Date().toISOString()
        })
        .eq('id', editingFault.id);

      if (faultError) throw faultError;

      // Remove any existing assignments for this fault since it's being reset
      const { error: assignmentError } = await supabase
        .from('assignments')
        .delete()
        .eq('fault_report_id', editingFault.id)
        .is('completed_at', null); // Only remove incomplete assignments

      if (assignmentError) throw assignmentError;

      await fetchOpenFaults();
      setEditingFault(null);
      
      // Reset selection states
      setSelectedFault('');
      setSelectedPersonnel('');
    } catch (error) {
      console.error('Error updating fault:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const canEditFault = (fault: FaultReport) => {
    if (!appUser) return false;
    
    // Admin and managers can edit all faults
    if (appUser.role === 'admin' || appUser.role === 'manager') return true;
    
    // Department managers can edit faults in their department
    if (appUser.role === 'department_manager' && appUser.department_id === fault.department_id) return true;
    
    return false;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'acil': return 'text-red-600 bg-red-100';
      case 'yüksek': return 'text-orange-600 bg-orange-100';
      case 'orta': return 'text-yellow-600 bg-yellow-100';
      case 'düşük': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'açık': return 'text-red-600 bg-red-100';
      case 'atandı': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSpecializationColor = (specialization: string) => {
    switch (specialization) {
      case 'Mekanik': return 'text-blue-600 bg-blue-100';
      case 'Elektrik': return 'text-yellow-600 bg-yellow-100';
      case 'Bilgi İşlem': return 'text-purple-600 bg-purple-100';
      case 'Pnömatik': return 'text-green-600 bg-green-100';
      case 'Hidrolik': return 'text-indigo-600 bg-indigo-100';
      case 'Yazılım': return 'text-pink-600 bg-pink-100';
      case 'Genel': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Users className="h-8 w-8 text-orange-600" />
        <h1 className="text-3xl font-bold text-gray-900">Atama Paneli</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Açık Arızalar</h2>
          <p className="text-sm text-gray-600 mt-1">
            Bakım personeline atanmayı bekleyen arızalar
            {appUser?.role === 'department_manager' && (
              <span className="ml-2 text-orange-600 font-medium">
                (Sadece {appUser.department?.name || 'kendi bölümünüz'} personeline atama yapabilirsiniz)
              </span>
            )}
          </p>
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <Wrench size={14} className="inline mr-1" />
              <strong>Uzmanlık Sistemi:</strong> Personel sadece uzmanlık alanına uygun arızalara atanabilir. 
              Örneğin elektrik arızasına sadece elektrik uzmanı veya genel uzmanlığa sahip personel atanabilir.
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Arıza bilgilerini düzenlediğinizde, arıza yeniden "açık" duruma geçer ve atama işlemi tekrar yapılabilir.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {faults.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Atama bekleyen arıza bulunmamaktadır.
            </div>
          ) : (
            faults.map((fault) => {
              const compatiblePersonnel = getCompatiblePersonnel(fault.fault_type);
              const requiredSpecializations = getSpecializationForFaultType(fault.fault_type);
              
              return (
                <div key={fault.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {fault.machine?.name}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(fault.priority)}`}>
                          {fault.priority}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(fault.status)}`}>
                          {fault.status}
                        </span>
                        {canEditFault(fault) && (
                          <button
                            onClick={() => handleEditFault(fault)}
                            className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="Arıza Bilgilerini Düzenle (Arıza yeniden açık duruma geçer)"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                      </div>
                      
                      <p className="text-gray-600 mb-2">{fault.description}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                        <span className="flex items-center">
                          <AlertTriangle size={16} className="mr-1" />
                          {fault.fault_type}
                        </span>
                        <span className="flex items-center">
                          <Clock size={16} className="mr-1" />
                          {new Date(fault.created_at).toLocaleDateString('tr-TR')}
                        </span>
                        <span>{fault.department?.name}</span>
                        <span>Bildiren: {fault.reporter?.name}</span>
                      </div>

                      {/* Required Specializations */}
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-xs text-gray-500">Gerekli uzmanlık:</span>
                        {requiredSpecializations.map((spec, index) => (
                          <span key={index} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSpecializationColor(spec)}`}>
                            {spec}
                          </span>
                        ))}
                      </div>

                      {fault.assignments && fault.assignments.length > 0 && (
                        <div className="mt-2 flex items-center text-sm text-blue-600">
                          <UserCheck size={16} className="mr-1" />
                          Atanan: {fault.assignments[0].assigned_to?.name}
                          {fault.assignments[0].assigned_to?.specialization && (
                            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSpecializationColor(fault.assignments[0].assigned_to.specialization)}`}>
                              {fault.assignments[0].assigned_to.specialization}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {fault.status === 'açık' && (
                      <div className="flex items-center space-x-3">
                        <select
                          value={selectedFault === fault.id ? selectedPersonnel : ''}
                          onChange={(e) => {
                            setSelectedFault(fault.id);
                            setSelectedPersonnel(e.target.value);
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        >
                          <option value="">
                            {compatiblePersonnel.length === 0 
                              ? 'Uygun uzman yok' 
                              : 'Personel seçiniz'
                            }
                          </option>
                          {compatiblePersonnel.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name} ({person.specialization || 'Genel'})
                            </option>
                          ))}
                        </select>
                        
                        <button
                          onClick={() => handleAssign(fault.id, selectedPersonnel)}
                          disabled={!selectedPersonnel || selectedFault !== fault.id || compatiblePersonnel.length === 0}
                          className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Ata
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Show warning if no compatible personnel */}
                  {fault.status === 'açık' && compatiblePersonnel.length === 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        ⚠️ Bu arıza tipi ({fault.fault_type}) için uygun uzmanlığa sahip personel bulunamadı. 
                        Gerekli uzmanlık alanları: {requiredSpecializations.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Personnel Workload */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            {appUser?.role === 'department_manager' 
              ? `${appUser.department?.name || 'Bölüm'} Personel İş Yükü`
              : 'Personel İş Yükü'
            }
          </h2>
        </div>
        
        <div className="p-6">
          {personnel.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {appUser?.role === 'department_manager' 
                ? 'Bölümünüzde bakım personeli bulunmamaktadır.'
                : 'Bakım personeli bulunmamaktadır.'
              }
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personnel.map((person) => {
                const assignedFaults = faults.filter(f => 
                  f.assignments && f.assignments.some(a => a.assigned_to_id === person.id)
                ).length;
                
                return (
                  <div key={person.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{person.name}</h3>
                        <p className="text-sm text-gray-600">{person.email}</p>
                        {person.department && (
                          <p className="text-xs text-gray-500">{person.department.name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-600">{assignedFaults}</p>
                        <p className="text-xs text-gray-500">Atanan İş</p>
                      </div>
                    </div>
                    
                    {/* Specialization Badge */}
                    <div className="flex items-center justify-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getSpecializationColor(person.specialization || 'Genel')}`}>
                        <Wrench size={14} className="mr-1" />
                        {person.specialization || 'Genel'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Fault Modal */}
      {editingFault && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Arıza Bilgilerini Düzenle</h2>
              <button
                onClick={() => setEditingFault(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-200">
              <p className="text-sm text-yellow-800">
                ⚠️ Bu arızayı düzenlediğinizde, mevcut atamalar kaldırılacak ve arıza yeniden "açık" duruma geçecektir.
              </p>
            </div>
            
            <form onSubmit={handleUpdateFault} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arıza Tipi *
                </label>
                <select
                  required
                  value={editForm.fault_type}
                  onChange={(e) => setEditForm({ ...editForm, fault_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {faultTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {editForm.fault_type && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Bu arıza tipi için uygun uzmanlık alanları:</p>
                    <div className="flex flex-wrap gap-1">
                      {getSpecializationForFaultType(editForm.fault_type).map((spec, index) => (
                        <span key={index} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSpecializationColor(spec)}`}>
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Öncelik Seviyesi *
                </label>
                <div className="grid grid-cols-2 gap-3">
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
                        checked={editForm.priority === priority.value}
                        onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as any })}
                        className="sr-only"
                      />
                      <div className={`p-3 rounded-lg border-2 text-center font-medium transition-all text-sm ${
                        editForm.priority === priority.value 
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
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Arıza detaylarını açıklayınız..."
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingFault(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Check size={16} className="mr-2" />
                      Güncelle ve Sıfırla
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}