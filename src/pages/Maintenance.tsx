import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FaultReport, MaintenanceAction } from '../types';
import { Wrench, Clock, DollarSign, Package, Check, X } from 'lucide-react';

export default function Maintenance() {
  const { appUser } = useAuth();
  const [assignedFaults, setAssignedFaults] = useState<FaultReport[]>([]);
  const [selectedFault, setSelectedFault] = useState<FaultReport | null>(null);
  const [actionForm, setActionForm] = useState({
    description: '',
    spare_parts: '',
    cost: 0,
    action_time: 0
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAssignedFaults();
  }, [appUser]);

  const fetchAssignedFaults = async () => {
    if (!appUser) return;

    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          fault_report:fault_reports(
            *,
            machine:machines(*),
            department:departments(*),
            reporter:users(*),
            maintenance_actions:maintenance_actions(
              *,
              personnel:users(*)
            )
          )
        `)
        .eq('assigned_to_id', appUser.id)
        .is('completed_at', null);

      if (error) throw error;
      
      const faults = data?.map(assignment => assignment.fault_report).filter(Boolean) || [];
      setAssignedFaults(faults);
    } catch (error) {
      console.error('Error fetching assigned faults:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWork = async (faultId: string) => {
    try {
      const { error } = await supabase
        .from('fault_reports')
        .update({ status: 'devam_ediyor' })
        .eq('id', faultId);

      if (error) throw error;
      await fetchAssignedFaults();
    } catch (error) {
      console.error('Error starting work:', error);
    }
  };

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFault || !appUser) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('maintenance_actions')
        .insert({
          fault_report_id: selectedFault.id,
          personnel_id: appUser.id,
          description: actionForm.description,
          spare_parts: actionForm.spare_parts,
          cost: actionForm.cost,
          action_time: actionForm.action_time
        });

      if (error) throw error;

      setActionForm({
        description: '',
        spare_parts: '',
        cost: 0,
        action_time: 0
      });

      await fetchAssignedFaults();
    } catch (error) {
      console.error('Error adding action:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteFault = async (faultId: string) => {
    if (!appUser) return;

    try {
      // Update fault status
      const { error: faultError } = await supabase
        .from('fault_reports')
        .update({ status: 'tamamlandı' })
        .eq('id', faultId);

      if (faultError) throw faultError;

      // Complete assignment
      const { error: assignmentError } = await supabase
        .from('assignments')
        .update({ completed_at: new Date().toISOString() })
        .eq('fault_report_id', faultId)
        .eq('assigned_to_id', appUser.id);

      if (assignmentError) throw assignmentError;

      await fetchAssignedFaults();
      setSelectedFault(null);
    } catch (error) {
      console.error('Error completing fault:', error);
    }
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
      case 'atandı': return 'text-blue-600 bg-blue-100';
      case 'devam_ediyor': return 'text-yellow-600 bg-yellow-100';
      case 'tamamlandı': return 'text-green-600 bg-green-100';
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
        <Wrench className="h-8 w-8 text-orange-600" />
        <h1 className="text-3xl font-bold text-gray-900">Bakım İşlemleri</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Faults List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Atanan İşlerim</h2>
          </div>
          
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {assignedFaults.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                Atanan iş bulunmamaktadır.
              </div>
            ) : (
              assignedFaults.map((fault) => (
                <div 
                  key={fault.id} 
                  className={`px-6 py-4 cursor-pointer hover:bg-gray-50 ${
                    selectedFault?.id === fault.id ? 'bg-orange-50' : ''
                  }`}
                  onClick={() => setSelectedFault(fault)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{fault.machine?.name}</h3>
                    <div className="flex space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(fault.priority)}`}>
                        {fault.priority}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(fault.status)}`}>
                        {fault.status}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{fault.description}</p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{fault.department?.name}</span>
                    <span>{new Date(fault.created_at).toLocaleDateString('tr-TR')}</span>
                  </div>

                  {fault.status === 'atandı' && (
                    <div className="mt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartWork(fault.id);
                        }}
                        className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700 transition-colors"
                      >
                        İşe Başla
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fault Details and Actions */}
        <div className="space-y-6">
          {selectedFault ? (
            <>
              {/* Fault Details */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">İş Detayları</h3>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Makine:</span>
                    <p className="text-gray-900">{selectedFault.machine?.name}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-500">Bölüm:</span>
                    <p className="text-gray-900">{selectedFault.department?.name}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-500">Arıza Tipi:</span>
                    <p className="text-gray-900">{selectedFault.fault_type}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-500">Açıklama:</span>
                    <p className="text-gray-900">{selectedFault.description}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-500">Bildiren:</span>
                    <p className="text-gray-900">{selectedFault.reporter?.name}</p>
                  </div>
                </div>

                {selectedFault.status === 'devam_ediyor' && (
                  <div className="mt-6 flex space-x-3">
                    <button
                      onClick={() => handleCompleteFault(selectedFault.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center"
                    >
                      <Check size={16} className="mr-2" />
                      İş Tamamlandı
                    </button>
                  </div>
                )}
              </div>

              {/* Add Action Form */}
              {selectedFault.status === 'devam_ediyor' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">İşlem Kaydet</h3>
                  
                  <form onSubmit={handleAddAction} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Yapılan İşlem
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={actionForm.description}
                        onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="Yapılan işlemi detaylandırın..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kullanılan Yedek Parça/Malzeme
                      </label>
                      <textarea
                        rows={2}
                        value={actionForm.spare_parts}
                        onChange={(e) => setActionForm({ ...actionForm, spare_parts: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="Kullanılan malzemeleri listeleyin..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Maliyet (₺)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={actionForm.cost}
                          onChange={(e) => setActionForm({ ...actionForm, cost: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Süre (dakika)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={actionForm.action_time}
                          onChange={(e) => setActionForm({ ...actionForm, action_time: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? 'Kaydediliyor...' : 'İşlem Kaydet'}
                    </button>
                  </form>
                </div>
              )}

              {/* Previous Actions */}
              {selectedFault.maintenance_actions && selectedFault.maintenance_actions.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Yapılan İşlemler</h3>
                  
                  <div className="space-y-4">
                    {selectedFault.maintenance_actions.map((action) => (
                      <div key={action.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {action.personnel?.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(action.created_at).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-700 mb-2">{action.description}</p>
                        
                        {action.spare_parts && (
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Package size={14} className="mr-1" />
                            {action.spare_parts}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center">
                            <DollarSign size={12} className="mr-1" />
                            {action.cost} ₺
                          </div>
                          <div className="flex items-center">
                            <Clock size={12} className="mr-1" />
                            {action.action_time} dakika
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-center text-gray-500">
                <Wrench size={48} className="mx-auto mb-4 text-gray-300" />
                <p>Detayları görmek için soldan bir iş seçin</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}