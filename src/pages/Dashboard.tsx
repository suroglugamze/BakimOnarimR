import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FaultReport } from '../types';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Users, 
  Wrench,
  TrendingUp,
  AlertCircle,
  Activity,
  Trash2,
  X,
  Search,
  Filter,
  Eye,
  Settings
} from 'lucide-react';

export default function Dashboard() {
  const { appUser } = useAuth();
  const [stats, setStats] = useState({
    totalFaults: 0,
    openFaults: 0,
    inProgressFaults: 0,
    completedFaults: 0,
    myAssignedFaults: 0,
    urgentFaults: 0
  });
  const [recentFaults, setRecentFaults] = useState<FaultReport[]>([]);
  const [allFaults, setAllFaults] = useState<FaultReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedFault, setSelectedFault] = useState<FaultReport | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [appUser]);

  const fetchDashboardData = async () => {
    if (!appUser) return;

    try {
      let faultsQuery = supabase
        .from('fault_reports')
        .select(`
          *,
          machine:machines(*),
          department:departments(*),
          reporter:users(*),
          assignments:assignments(
            *,
            assigned_to:users!assignments_assigned_to_id_fkey(*)
          ),
          maintenance_actions:maintenance_actions(
            *,
            personnel:users(*)
          )
        `)
        .order('created_at', { ascending: false });

      // Filter by department for department managers
      if (appUser.role === 'department_manager' && appUser.department_id) {
        faultsQuery = faultsQuery.eq('department_id', appUser.department_id);
      }

      // Get all faults
      const { data: faults, error } = await faultsQuery;
      if (error) throw error;

      // Calculate stats
      const totalFaults = faults?.length || 0;
      const openFaults = faults?.filter(f => f.status === 'açık').length || 0;
      const inProgressFaults = faults?.filter(f => f.status === 'devam_ediyor').length || 0;
      const completedFaults = faults?.filter(f => f.status === 'tamamlandı').length || 0;
      const urgentFaults = faults?.filter(f => f.priority === 'acil').length || 0;

      // Get assigned faults for maintenance personnel
      let myAssignedFaults = 0;
      if (appUser.role === 'maintenance_personnel') {
        const { data: assignments } = await supabase
          .from('assignments')
          .select('fault_report_id')
          .eq('assigned_to_id', appUser.id)
          .is('completed_at', null);
        
        myAssignedFaults = assignments?.length || 0;
      }

      setStats({
        totalFaults,
        openFaults,
        inProgressFaults,
        completedFaults,
        myAssignedFaults,
        urgentFaults
      });

      // Set recent faults (last 5) and all faults for admin
      setRecentFaults(faults?.slice(0, 5) || []);
      setAllFaults(faults || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFault = async (faultId: string) => {
    try {
      const { error } = await supabase
        .from('fault_reports')
        .delete()
        .eq('id', faultId);

      if (error) throw error;
      
      await fetchDashboardData();
      setDeleteConfirm(null);
      setSelectedFault(null);
    } catch (error) {
      console.error('Error deleting fault:', error);
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
      case 'açık': return 'text-red-600 bg-red-100';
      case 'atandı': return 'text-blue-600 bg-blue-100';
      case 'devam_ediyor': return 'text-yellow-600 bg-yellow-100';
      case 'tamamlandı': return 'text-green-600 bg-green-100';
      case 'kapatıldı': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredFaults = allFaults.filter(fault => {
    const matchesSearch = fault.machine?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fault.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fault.department?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fault.reporter?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || fault.status === statusFilter;
    const matchesPriority = !priorityFilter || fault.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Ana Sayfa</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Hoş geldiniz, {appUser?.name}
          </div>
          {appUser?.role === 'admin' && (
            <button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors flex items-center space-x-2"
            >
              <Settings size={16} />
              <span>{showAdminPanel ? 'Normal Görünüm' : 'Arıza Yönetimi'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Fault Management Panel */}
      {appUser?.role === 'admin' && showAdminPanel && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                  Arıza Yönetim Paneli
                </h2>
                <p className="text-sm text-red-700 mt-1">
                  ⚠️ Bu panel ile tüm arızaları görüntüleyebilir ve silebilirsiniz. Silme işlemi geri alınamaz!
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Makine, açıklama, bölüm veya bildiren ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none"
                >
                  <option value="">Tüm Durumlar</option>
                  <option value="açık">Açık</option>
                  <option value="atandı">Atandı</option>
                  <option value="devam_ediyor">Devam Ediyor</option>
                  <option value="tamamlandı">Tamamlandı</option>
                  <option value="kapatıldı">Kapatıldı</option>
                </select>
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none"
                >
                  <option value="">Tüm Öncelikler</option>
                  <option value="düşük">Düşük</option>
                  <option value="orta">Orta</option>
                  <option value="yüksek">Yüksek</option>
                  <option value="acil">Acil</option>
                </select>
              </div>
            </div>
          </div>

          {/* Faults List */}
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {filteredFaults.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                {searchTerm || statusFilter || priorityFilter 
                  ? 'Filtrelere uygun arıza bulunamadı.' 
                  : 'Henüz arıza bildirimi bulunmamaktadır.'
                }
              </div>
            ) : (
              filteredFaults.map((fault) => (
                <div key={fault.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-sm font-medium text-gray-900">
                          {fault.machine?.name}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(fault.priority)}`}>
                          {fault.priority}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(fault.status)}`}>
                          {fault.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{fault.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{fault.department?.name}</span>
                        <span>{fault.fault_type}</span>
                        <span>Bildiren: {fault.reporter?.name}</span>
                        <span>{new Date(fault.created_at).toLocaleDateString('tr-TR')}</span>
                      </div>
                      {fault.assignments && fault.assignments.length > 0 && (
                        <div className="mt-1 text-xs text-blue-600">
                          Atanan: {fault.assignments[0].assigned_to?.name}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedFault(fault)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Detayları Görüntüle"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(fault.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Arızayı Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Toplam Arıza</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalFaults}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Açık Arızalar</p>
              <p className="text-2xl font-bold text-gray-900">{stats.openFaults}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Devam Eden</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inProgressFaults}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Tamamlanan</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedFaults}</p>
            </div>
          </div>
        </div>

        {appUser?.role === 'maintenance_personnel' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <Wrench className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Atanan İşlerim</p>
                <p className="text-2xl font-bold text-gray-900">{stats.myAssignedFaults}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Acil Arızalar</p>
              <p className="text-2xl font-bold text-gray-900">{stats.urgentFaults}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Faults - Only show if not in admin panel */}
      {(!showAdminPanel || appUser?.role !== 'admin') && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Son Arıza Bildirimler</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentFaults.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                Henüz arıza bildirimi bulunmamaktadır.
              </div>
            ) : (
              recentFaults.map((fault) => (
                <div key={fault.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-sm font-medium text-gray-900">
                          {fault.machine?.name}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(fault.priority)}`}>
                          {fault.priority}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(fault.status)}`}>
                          {fault.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{fault.description}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>{fault.department?.name}</span>
                        <span>{fault.fault_type}</span>
                        <span>{new Date(fault.created_at).toLocaleDateString('tr-TR')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Fault Detail Modal */}
      {selectedFault && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Arıza Detayları</h2>
              <button
                onClick={() => setSelectedFault(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <span className="text-sm font-medium text-gray-500">Öncelik:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedFault.priority)}`}>
                    {selectedFault.priority}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Durum:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedFault.status)}`}>
                    {selectedFault.status}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Bildiren:</span>
                  <p className="text-gray-900">{selectedFault.reporter?.name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Oluşturulma:</span>
                  <p className="text-gray-900">{new Date(selectedFault.created_at).toLocaleString('tr-TR')}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Güncellenme:</span>
                  <p className="text-gray-900">{new Date(selectedFault.updated_at).toLocaleString('tr-TR')}</p>
                </div>
              </div>
              
              <div>
                <span className="text-sm font-medium text-gray-500">Açıklama:</span>
                <p className="text-gray-900 mt-1">{selectedFault.description}</p>
              </div>

              {selectedFault.assignments && selectedFault.assignments.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Atamalar:</span>
                  <div className="mt-2 space-y-2">
                    {selectedFault.assignments.map((assignment, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm">
                          <strong>Atanan:</strong> {assignment.assigned_to?.name}
                        </p>
                        <p className="text-xs text-gray-600">
                          Atanma: {new Date(assignment.assigned_at).toLocaleString('tr-TR')}
                          {assignment.completed_at && (
                            <span> | Tamamlanma: {new Date(assignment.completed_at).toLocaleString('tr-TR')}</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedFault.maintenance_actions && selectedFault.maintenance_actions.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Bakım İşlemleri:</span>
                  <div className="mt-2 space-y-2">
                    {selectedFault.maintenance_actions.map((action, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm"><strong>Personel:</strong> {action.personnel?.name}</p>
                        <p className="text-sm"><strong>İşlem:</strong> {action.description}</p>
                        {action.spare_parts && (
                          <p className="text-sm"><strong>Yedek Parça:</strong> {action.spare_parts}</p>
                        )}
                        <div className="flex items-center space-x-4 text-xs text-gray-600 mt-1">
                          <span>Maliyet: ₺{action.cost}</span>
                          <span>Süre: {action.action_time} dk</span>
                          <span>Tarih: {new Date(action.created_at).toLocaleString('tr-TR')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <AlertCircle className="h-6 w-6 text-red-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">Arızayı Sil</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Bu arızayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve 
                arızaya ait tüm atamalar, bakım işlemleri ve veriler kalıcı olarak silinecektir.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={() => handleDeleteFault(deleteConfirm)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                >
                  Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}