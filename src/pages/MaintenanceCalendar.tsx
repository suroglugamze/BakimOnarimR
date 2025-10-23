import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MaintenanceSchedule, Machine, Department, User } from '../types';
import { 
  Calendar, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  X,
  Check,
  AlertCircle,
  Clock,
  User as UserIcon,
  Building,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Eye,
  Play,
  Pause,
  CheckCircle,
  XCircle
} from 'lucide-react';

export default function MaintenanceCalendar() {
  const { appUser } = useAuth();
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceSchedule | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    machine_id: '',
    title: '',
    description: '',
    maintenance_type: 'Önleyici' as MaintenanceSchedule['maintenance_type'],
    priority: 'orta' as MaintenanceSchedule['priority'],
    start_date: '',
    end_date: '',
    assigned_to_id: '',
    recurrence_type: '' as MaintenanceSchedule['recurrence_type'] | '',
    recurrence_interval: 1
  });

  const maintenanceTypes = [
    'Önleyici',
    'Periyodik', 
    'Kalibrasyon',
    'Temizlik',
    'Yağlama',
    'Kontrol',
    'Diğer'
  ];

  const recurrenceTypes = [
    { value: '', label: 'Tekrar Yok' },
    { value: 'günlük', label: 'Günlük' },
    { value: 'haftalık', label: 'Haftalık' },
    { value: 'aylık', label: 'Aylık' },
    { value: 'üç_aylık', label: 'Üç Aylık' },
    { value: 'altı_aylık', label: 'Altı Aylık' },
    { value: 'yıllık', label: 'Yıllık' }
  ];

  useEffect(() => {
    fetchSchedules();
    fetchMachines();
    fetchDepartments();
    fetchPersonnel();
  }, [appUser]);

  const fetchSchedules = async () => {
    try {
      let query = supabase
        .from('maintenance_schedules')
        .select(`
          *,
          machine:machines(*),
          department:departments(*),
          created_by:users!maintenance_schedules_created_by_id_fkey(*),
          assigned_to:users!maintenance_schedules_assigned_to_id_fkey(*)
        `)
        .order('start_date', { ascending: true });

      // Filter by department for department managers
      if (appUser?.role === 'department_manager' && appUser.department_id) {
        query = query.eq('department_id', appUser.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMachines = async () => {
    try {
      let query = supabase
        .from('machines')
        .select(`
          *,
          department:departments(*)
        `)
        .order('name');

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

  const fetchPersonnel = async () => {
    try {
      let query = supabase
        .from('users')
        .select('*')
        .eq('role', 'maintenance_personnel')
        .order('name');

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

  const calculateNextOccurrence = (date: string, type: string, interval: number): string | null => {
    if (!type) return null;
    
    const baseDate = new Date(date);
    
    switch (type) {
      case 'günlük':
        baseDate.setDate(baseDate.getDate() + interval);
        break;
      case 'haftalık':
        baseDate.setDate(baseDate.getDate() + (interval * 7));
        break;
      case 'aylık':
        baseDate.setMonth(baseDate.getMonth() + interval);
        break;
      case 'üç_aylık':
        baseDate.setMonth(baseDate.getMonth() + (interval * 3));
        break;
      case 'altı_aylık':
        baseDate.setMonth(baseDate.getMonth() + (interval * 6));
        break;
      case 'yıllık':
        baseDate.setFullYear(baseDate.getFullYear() + interval);
        break;
      default:
        return null;
    }
    
    return baseDate.toISOString().split('T')[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;

    setSubmitting(true);
    try {
      const selectedMachine = machines.find(m => m.id === formData.machine_id);
      const nextOccurrence = calculateNextOccurrence(
        formData.scheduled_date, 
        formData.recurrence_type || '', 
        formData.recurrence_interval
      );

      const scheduleData = {
        machine_id: formData.machine_id,
        department_id: selectedMachine?.department_id,
        created_by_id: appUser.id,
        title: formData.title,
        description: formData.description,
        maintenance_type: formData.maintenance_type,
        priority: formData.priority,
        start_date: formData.start_date,
        end_date: formData.end_date,
        assigned_to_id: formData.assigned_to_id || null,
        recurrence_type: formData.recurrence_type || null,
        recurrence_interval: formData.recurrence_type ? formData.recurrence_interval : null,
        next_occurrence: nextOccurrence,
        status: formData.assigned_to_id ? 'atandı' : 'planlandı'
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from('maintenance_schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('maintenance_schedules')
          .insert(scheduleData);

        if (error) throw error;
      }

      await fetchSchedules();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (scheduleId: string, newStatus: MaintenanceSchedule['status'], notes?: string, duration?: number) => {
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'tamamlandı') {
        updateData.completed_at = new Date().toISOString();
        if (notes) updateData.completion_notes = notes;
        if (duration) updateData.actual_duration = duration;
        
        // Create next occurrence if recurring
        const schedule = schedules.find(s => s.id === scheduleId);
        if (schedule?.recurrence_type && schedule.next_occurrence) {
          const nextOccurrence = calculateNextOccurrence(
            schedule.next_occurrence,
            schedule.recurrence_type,
            schedule.recurrence_interval || 1
          );
          
          if (nextOccurrence) {
            // Calculate end date for next occurrence (same duration)
            const startDate = new Date(schedule.next_occurrence);
            const endDate = new Date(schedule.next_occurrence);
            const originalDuration = new Date(schedule.end_date).getTime() - new Date(schedule.start_date).getTime();
            endDate.setTime(startDate.getTime() + originalDuration);
            
            // Create new schedule for next occurrence
            await supabase
              .from('maintenance_schedules')
              .insert({
                machine_id: schedule.machine_id,
                department_id: schedule.department_id,
                created_by_id: schedule.created_by_id,
                title: schedule.title,
                description: schedule.description,
                maintenance_type: schedule.maintenance_type,
                priority: schedule.priority,
                start_date: schedule.next_occurrence,
                end_date: endDate.toISOString().split('T')[0],
                assigned_to_id: schedule.assigned_to_id,
                recurrence_type: schedule.recurrence_type,
                recurrence_interval: schedule.recurrence_interval,
                next_occurrence: nextOccurrence,
                status: schedule.assigned_to_id ? 'atandı' : 'planlandı'
              });
          }
        }
      }

      const { error } = await supabase
        .from('maintenance_schedules')
        .update(updateData)
        .eq('id', scheduleId);

      if (error) throw error;
      await fetchSchedules();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('maintenance_schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;
      
      await fetchSchedules();
      setDeleteConfirm(null);
      setSelectedSchedule(null);
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  const handleEdit = (schedule: MaintenanceSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      machine_id: schedule.machine_id,
      title: schedule.title,
      description: schedule.description || '',
      maintenance_type: schedule.maintenance_type,
      priority: schedule.priority,
      start_date: schedule.start_date,
      end_date: schedule.end_date,
      assigned_to_id: schedule.assigned_to_id || '',
      recurrence_type: schedule.recurrence_type || '',
      recurrence_interval: schedule.recurrence_interval || 1
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSchedule(null);
    setFormData({
      machine_id: '',
      title: '',
      description: '',
      maintenance_type: 'Önleyici',
      priority: 'orta',
      start_date: '',
      end_date: '',
      assigned_to_id: '',
      recurrence_type: '',
      recurrence_interval: 1
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'kritik': return 'text-red-600 bg-red-100 border-red-300';
      case 'yüksek': return 'text-orange-600 bg-orange-100 border-orange-300';
      case 'orta': return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      case 'düşük': return 'text-green-600 bg-green-100 border-green-300';
      default: return 'text-gray-600 bg-gray-100 border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planlandı': return 'text-blue-600 bg-blue-100';
      case 'atandı': return 'text-purple-600 bg-purple-100';
      case 'devam_ediyor': return 'text-yellow-600 bg-yellow-100';
      case 'tamamlandı': return 'text-green-600 bg-green-100';
      case 'ertelendi': return 'text-orange-600 bg-orange-100';
      case 'iptal_edildi': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Önleyici': return 'text-green-600 bg-green-100';
      case 'Periyodik': return 'text-blue-600 bg-blue-100';
      case 'Kalibrasyon': return 'text-purple-600 bg-purple-100';
      case 'Temizlik': return 'text-cyan-600 bg-cyan-100';
      case 'Yağlama': return 'text-yellow-600 bg-yellow-100';
      case 'Kontrol': return 'text-indigo-600 bg-indigo-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredSchedules = schedules.filter(schedule => {
    const matchesSearch = schedule.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         schedule.machine?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         schedule.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || schedule.status === statusFilter;
    const matchesType = !typeFilter || schedule.maintenance_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getSchedulesForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return filteredSchedules.filter(schedule => {
      const startDate = schedule.start_date;
      const endDate = schedule.end_date;
      return dateStr >= startDate && dateStr <= endDate;
    });
  };

  const canManageSchedules = appUser && ['admin', 'manager', 'department_manager'].includes(appUser.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Calendar className="h-8 w-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900">Bakım Takvimi</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'calendar' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Takvim
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Liste
            </button>
          </div>
          
          {canManageSchedules && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>Yeni Bakım Planı</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Başlık, makine veya açıklama ara..."
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
              <option value="planlandı">Planlandı</option>
              <option value="atandı">Atandı</option>
              <option value="devam_ediyor">Devam Ediyor</option>
              <option value="tamamlandı">Tamamlandı</option>
              <option value="ertelendi">Ertelendi</option>
              <option value="iptal_edildi">İptal Edildi</option>
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none"
            >
              <option value="">Tüm Tipler</option>
              {maintenanceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-xl font-semibold text-gray-900">
                {currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors"
            >
              Bugün
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="p-6">
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before month starts */}
              {Array.from({ length: (getFirstDayOfMonth(currentDate) + 6) % 7 }, (_, i) => (
                <div key={`empty-${i}`} className="h-24 p-1"></div>
              ))}
              
              {/* Days of the month */}
              {Array.from({ length: getDaysInMonth(currentDate) }, (_, i) => {
                const day = i + 1;
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const daySchedules = getSchedulesForDate(date);
                const isToday = date.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={day}
                    className={`h-24 p-1 border border-gray-200 rounded-lg ${
                      isToday ? 'bg-orange-50 border-orange-300' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isToday ? 'text-orange-600' : 'text-gray-900'
                    }`}>
                      {day}
                    </div>
                    
                    <div className="space-y-1">
                      {daySchedules.slice(0, 2).map((schedule) => (
                        <div
                          key={schedule.id}
                          onClick={() => setSelectedSchedule(schedule)}
                          className={`text-xs p-1 rounded cursor-pointer truncate ${getStatusColor(schedule.status)}`}
                          title={schedule.title}
                        >
                          {schedule.title}
                        </div>
                      ))}
                      {daySchedules.length > 2 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{daySchedules.length - 2} daha
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="divide-y divide-gray-200">
            {filteredSchedules.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Bakım Planı Bulunamadı</h3>
                <p className="text-gray-600">
                  {searchTerm || statusFilter || typeFilter 
                    ? 'Filtrelere uygun bakım planı bulunamadı.' 
                    : 'Henüz bakım planı oluşturulmamış.'}
                </p>
              </div>
            ) : (
              filteredSchedules.map((schedule) => (
                <div key={schedule.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">{schedule.title}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(schedule.priority)}`}>
                          {schedule.priority}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(schedule.status)}`}>
                          {schedule.status}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(schedule.maintenance_type)}`}>
                          {schedule.maintenance_type}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        <span className="flex items-center">
                          <Building size={16} className="mr-1" />
                          {schedule.machine?.name}
                        </span>
                        <span className="flex items-center">
                          <Calendar size={16} className="mr-1" />
                          {new Date(schedule.start_date).toLocaleDateString('tr-TR')}
                          {schedule.start_date !== schedule.end_date && (
                            <span> - {new Date(schedule.end_date).toLocaleDateString('tr-TR')}</span>
                          )}
                        </span>
                        {schedule.assigned_to && (
                          <span className="flex items-center">
                            <UserIcon size={16} className="mr-1" />
                            {schedule.assigned_to.name}
                          </span>
                        )}
                      </div>
                      
                      {schedule.description && (
                        <p className="text-sm text-gray-600 mb-2">{schedule.description}</p>
                      )}
                      
                      {schedule.recurrence_type && (
                        <div className="text-xs text-blue-600">
                          🔄 {recurrenceTypes.find(r => r.value === schedule.recurrence_type)?.label} tekrar
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedSchedule(schedule)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Detayları Görüntüle"
                      >
                        <Eye size={16} />
                      </button>
                      
                      {canManageSchedules && (
                        <>
                          <button
                            onClick={() => handleEdit(schedule)}
                            className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Düzenle"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(schedule.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Sil"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      
                      {/* Quick Status Actions */}
                      {schedule.status === 'planlandı' && schedule.assigned_to && (
                        <button
                          onClick={() => handleStatusUpdate(schedule.id, 'devam_ediyor')}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="İşe Başla"
                        >
                          <Play size={16} />
                        </button>
                      )}
                      
                      {schedule.status === 'devam_ediyor' && (
                        <button
                          onClick={() => handleStatusUpdate(schedule.id, 'tamamlandı')}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Tamamla"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingSchedule ? 'Bakım Planını Düzenle' : 'Yeni Bakım Planı'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Makine *
                  </label>
                  <select
                    required
                    value={formData.machine_id}
                    onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Makine seçiniz</option>
                    {machines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name} - {machine.department?.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bakım Tipi *
                  </label>
                  <select
                    required
                    value={formData.maintenance_type}
                    onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value as MaintenanceSchedule['maintenance_type'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {maintenanceTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Başlık *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Bakım işlemi başlığı"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Yapılacak işlemler hakkında detay..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Öncelik *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'düşük', label: 'Düşük', color: 'bg-green-100 text-green-800 border-green-300' },
                      { value: 'orta', label: 'Orta', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                      { value: 'yüksek', label: 'Yüksek', color: 'bg-orange-100 text-orange-800 border-orange-300' },
                      { value: 'kritik', label: 'Kritik', color: 'bg-red-100 text-red-800 border-red-300' },
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
                        <div className={`p-2 rounded-lg border-2 text-center font-medium transition-all text-sm ${
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Başlangıç Tarihi *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => {
                        setFormData({ 
                          ...formData, 
                          start_date: e.target.value,
                          end_date: formData.end_date || e.target.value // End date'i otomatik ayarla
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bitiş Tarihi *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      min={formData.start_date} // Bitiş tarihi başlangıçtan önce olamaz
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Atanan Personel
                  </label>
                  <select
                    value={formData.assigned_to_id}
                    onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Personel seçiniz (isteğe bağlı)</option>
                    {personnel.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} ({person.specialization || 'Genel'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tekrar Sıklığı
                  </label>
                  <select
                    value={formData.recurrence_type}
                    onChange={(e) => setFormData({ ...formData, recurrence_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {recurrenceTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.recurrence_type && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tekrar Aralığı
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.recurrence_interval}
                    onChange={(e) => setFormData({ ...formData, recurrence_interval: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Her kaç dönemde bir tekrarlanacak"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Örnek: 2 haftalık = Her 2 haftada bir, 3 aylık = Her 3 ayda bir
                  </p>
                </div>
              )}
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
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
                      {editingSchedule ? 'Güncelle' : 'Oluştur'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Detail Modal */}
      {selectedSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Bakım Planı Detayları</h2>
              <button
                onClick={() => setSelectedSchedule(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">Başlık:</span>
                  <p className="text-gray-900">{selectedSchedule.title}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Makine:</span>
                  <p className="text-gray-900">{selectedSchedule.machine?.name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Bölüm:</span>
                  <p className="text-gray-900">{selectedSchedule.department?.name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Bakım Tipi:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(selectedSchedule.maintenance_type)}`}>
                    {selectedSchedule.maintenance_type}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Öncelik:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedSchedule.priority)}`}>
                    {selectedSchedule.priority}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Durum:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedSchedule.status)}`}>
                    {selectedSchedule.status}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Başlangıç Tarihi:</span>
                  <p className="text-gray-900">{new Date(selectedSchedule.start_date).toLocaleDateString('tr-TR')}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Bitiş Tarihi:</span>
                  <p className="text-gray-900">{new Date(selectedSchedule.end_date).toLocaleDateString('tr-TR')}</p>
                </div>
                {selectedSchedule.assigned_to && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Atanan Personel:</span>
                    <p className="text-gray-900">{selectedSchedule.assigned_to.name}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium text-gray-500">Oluşturan:</span>
                  <p className="text-gray-900">{selectedSchedule.created_by?.name}</p>
                </div>
                {selectedSchedule.recurrence_type && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Tekrar:</span>
                    <p className="text-gray-900">
                      {recurrenceTypes.find(r => r.value === selectedSchedule.recurrence_type)?.label}
                      {selectedSchedule.recurrence_interval && selectedSchedule.recurrence_interval > 1 && 
                        ` (Her ${selectedSchedule.recurrence_interval})`
                      }
                    </p>
                  </div>
                )}
                {selectedSchedule.next_occurrence && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Sonraki Tekrar:</span>
                    <p className="text-gray-900">{new Date(selectedSchedule.next_occurrence).toLocaleDateString('tr-TR')}</p>
                  </div>
                )}
              </div>
              
              {selectedSchedule.description && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Açıklama:</span>
                  <p className="text-gray-900 mt-1">{selectedSchedule.description}</p>
                </div>
              )}

              {selectedSchedule.completion_notes && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Tamamlanma Notları:</span>
                  <p className="text-gray-900 mt-1">{selectedSchedule.completion_notes}</p>
                </div>
              )}

              {selectedSchedule.actual_duration && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Gerçek Süre:</span>
                  <p className="text-gray-900">{selectedSchedule.actual_duration} dakika</p>
                </div>
              )}

              {/* Status Update Actions */}
              {(appUser?.role === 'maintenance_personnel' && selectedSchedule.assigned_to_id === appUser.id) ||
               canManageSchedules ? (
                <div className="flex space-x-3 pt-4 border-t border-gray-200">
                  {selectedSchedule.status === 'planlandı' && selectedSchedule.assigned_to && (
                    <button
                      onClick={() => {
                        handleStatusUpdate(selectedSchedule.id, 'devam_ediyor');
                        setSelectedSchedule(null);
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <Play size={16} className="mr-2" />
                      İşe Başla
                    </button>
                  )}
                  
                  {selectedSchedule.status === 'devam_ediyor' && (
                    <button
                      onClick={() => {
                        const notes = prompt('Tamamlanma notları (isteğe bağlı):');
                        const duration = prompt('Gerçek süre (dakika):');
                        handleStatusUpdate(
                          selectedSchedule.id, 
                          'tamamlandı', 
                          notes || undefined, 
                          duration ? parseInt(duration) : undefined
                        );
                        setSelectedSchedule(null);
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                    >
                      <CheckCircle size={16} className="mr-2" />
                      Tamamla
                    </button>
                  )}
                  
                  {['planlandı', 'atandı', 'devam_ediyor'].includes(selectedSchedule.status) && (
                    <button
                      onClick={() => {
                        handleStatusUpdate(selectedSchedule.id, 'ertelendi');
                        setSelectedSchedule(null);
                      }}
                      className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors flex items-center"
                    >
                      <Pause size={16} className="mr-2" />
                      Ertele
                    </button>
                  )}
                </div>
              ) : null}
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
                <h3 className="text-lg font-semibold text-gray-900">Bakım Planını Sil</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Bu bakım planını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
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