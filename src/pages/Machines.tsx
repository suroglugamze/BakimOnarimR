import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Machine, Department } from '../types';
import { 
  Building, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  X,
  Check,
  AlertCircle
} from 'lucide-react';

export default function Machines() {
  const { appUser } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    department_name: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchMachines();
    fetchDepartments();
  }, []);

  const fetchMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select(`
          *,
          department:departments(*)
        `)
        .order('name');

      if (error) throw error;
      setMachines(data || []);
    } catch (error) {
      console.error('Error fetching machines:', error);
    } finally {
      setLoading(false);
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

  const findOrCreateDepartment = async (departmentName: string) => {
    // First, try to find existing department
    const { data: existingDept, error: findError } = await supabase
      .from('departments')
      .select('id')
      .ilike('name', departmentName)
      .single();

    if (existingDept) {
      return existingDept.id;
    }

    // If not found, create new department
    const { data: newDept, error: createError } = await supabase
      .from('departments')
      .insert({ name: departmentName })
      .select('id')
      .single();

    if (createError) throw createError;
    return newDept.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Find or create department
      const departmentId = await findOrCreateDepartment(formData.department_name);

      if (editingMachine) {
        // Update existing machine
        const { error } = await supabase
          .from('machines')
          .update({
            name: formData.name,
            department_id: departmentId
          })
          .eq('id', editingMachine.id);

        if (error) throw error;
      } else {
        // Create new machine
        const { error } = await supabase
          .from('machines')
          .insert({
            name: formData.name,
            department_id: departmentId
          });

        if (error) throw error;
      }

      await fetchMachines();
      await fetchDepartments(); // Refresh departments list
      handleCloseModal();
    } catch (error) {
      console.error('Error saving machine:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (machineId: string) => {
    try {
      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', machineId);

      if (error) throw error;
      
      await fetchMachines();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting machine:', error);
    }
  };

  const handleEdit = (machine: Machine) => {
    setEditingMachine(machine);
    setFormData({
      name: machine.name,
      department_name: machine.department?.name || ''
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingMachine(null);
    setFormData({
      name: '',
      department_name: ''
    });
  };

  const filteredMachines = machines.filter(machine => {
    const matchesSearch = machine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         machine.department?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = !selectedDepartment || machine.department_id === selectedDepartment;
    
    return matchesSearch && matchesDepartment;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Building className="h-8 w-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900">Makine Yönetimi</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Yeni Makine</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Makine adı veya bölüm ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none"
            >
              <option value="">Tüm Bölümler</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Machines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMachines.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Building size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Makine Bulunamadı</h3>
            <p className="text-gray-600">
              {searchTerm || selectedDepartment 
                ? 'Arama kriterlerinize uygun makine bulunamadı.' 
                : 'Henüz makine eklenmemiş.'}
            </p>
          </div>
        ) : (
          filteredMachines.map((machine) => (
            <div key={machine.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{machine.name}</h3>
                    <div className="flex items-center text-sm text-gray-600">
                      <Building size={16} className="mr-2" />
                      {machine.department?.name}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(machine)}
                      className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      title="Düzenle"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(machine.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500">
                  Oluşturulma: {new Date(machine.created_at).toLocaleDateString('tr-TR')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingMachine ? 'Makine Düzenle' : 'Yeni Makine Ekle'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Makine Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Makine adını giriniz"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bölüm Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.department_name}
                  onChange={(e) => setFormData({ ...formData, department_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Bölüm adını giriniz (örn: Mekanik, Elektrik)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Mevcut değilse otomatik olarak yeni bölüm oluşturulacaktır.
                </p>
              </div>
              
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
                      {editingMachine ? 'Güncelle' : 'Ekle'}
                    </>
                  )}
                </button>
              </div>
            </form>
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
                <h3 className="text-lg font-semibold text-gray-900">Makine Sil</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Bu makineyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve 
                makineye ait tüm arıza kayıtları da silinecektir.
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