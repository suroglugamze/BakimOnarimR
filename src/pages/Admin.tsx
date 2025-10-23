import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User, Department } from '../types';
import { 
  Settings, 
  Users, 
  Building, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  X,
  Check,
  AlertCircle,
  UserPlus,
  Shield,
  Wrench
} from 'lucide-react';

export default function Admin() {
  const { appUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'departments'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [userForm, setUserForm] = useState({
    email: '',
    name: '',
    role: 'maintenance_personnel' as User['role'],
    department_id: '',
    specialization: 'Genel',
    password: ''
  });

  const [deptForm, setDeptForm] = useState({
    name: '',
    description: ''
  });

  const roles = [
    { value: 'admin', label: 'Ana Yönetici' },
    { value: 'manager', label: 'Yönetici' },
    { value: 'department_manager', label: 'Birim Yöneticisi' },
    { value: 'maintenance_personnel', label: 'Bakım Personeli' }
  ];

  const specializations = [
    'Genel',
    'Mekanik',
    'Elektrik',
    'Bilgi İşlem',
    'Pnömatik',
    'Hidrolik',
    'Yazılım'
  ];

  useEffect(() => {
    if (appUser?.role === 'admin') {
      fetchUsers();
      fetchDepartments();
    }
  }, [appUser]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          department:departments(*)
        `)
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
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

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingUser) {
        // Update existing user
        const updateData: any = {
          name: userForm.name,
          role: userForm.role,
          department_id: userForm.department_id || null
        };

        // Only add specialization for maintenance personnel
        if (userForm.role === 'maintenance_personnel') {
          updateData.specialization = userForm.specialization;
        } else {
          updateData.specialization = null;
        }

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) throw error;
      } else {
        // Create new user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: userForm.email,
          password: userForm.password,
        });

        if (authError) throw authError;

        if (authData.user) {
          const insertData: any = {
            id: authData.user.id,
            email: userForm.email,
            name: userForm.name,
            role: userForm.role,
            department_id: userForm.department_id || null
          };

          // Only add specialization for maintenance personnel
          if (userForm.role === 'maintenance_personnel') {
            insertData.specialization = userForm.specialization;
          }

          const { error: userError } = await supabase
            .from('users')
            .insert(insertData);

          if (userError) throw userError;
        }
      }

      await fetchUsers();
      handleCloseUserModal();
    } catch (error) {
      console.error('Error saving user:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingDept) {
        // Update existing department
        const { error } = await supabase
          .from('departments')
          .update({
            name: deptForm.name,
            description: deptForm.description
          })
          .eq('id', editingDept.id);

        if (error) throw error;
      } else {
        // Create new department
        const { error } = await supabase
          .from('departments')
          .insert({
            name: deptForm.name,
            description: deptForm.description
          });

        if (error) throw error;
      }

      await fetchDepartments();
      handleCloseDeptModal();
    } catch (error) {
      console.error('Error saving department:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
      
      await fetchUsers();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleDeleteDept = async (deptId: string) => {
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', deptId);

      if (error) throw error;
      
      await fetchDepartments();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting department:', error);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      name: user.name,
      role: user.role,
      department_id: user.department_id || '',
      specialization: user.specialization || 'Genel',
      password: ''
    });
    setShowUserModal(true);
  };

  const handleEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.name,
      description: dept.description || ''
    });
    setShowDeptModal(true);
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
    setUserForm({
      email: '',
      name: '',
      role: 'maintenance_personnel',
      department_id: '',
      specialization: 'Genel',
      password: ''
    });
  };

  const handleCloseDeptModal = () => {
    setShowDeptModal(false);
    setEditingDept(null);
    setDeptForm({
      name: '',
      description: ''
    });
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

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.specialization && user.specialization.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredDepartments = departments.filter(dept => 
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.description && dept.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (appUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Erişim Reddedildi</h3>
          <p className="text-gray-600">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
        </div>
      </div>
    );
  }

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
          <Settings className="h-8 w-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900">Sistem Yönetimi</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users size={16} className="inline mr-2" />
              Kullanıcı Yönetimi
            </button>
            <button
              onClick={() => setActiveTab('departments')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'departments'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Building size={16} className="inline mr-2" />
              Bölüm Yönetimi
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Search and Add Button */}
          <div className="flex items-center justify-between mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder={activeTab === 'users' ? 'Kullanıcı ara...' : 'Bölüm ara...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            
            <button
              onClick={() => activeTab === 'users' ? setShowUserModal(true) : setShowDeptModal(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>{activeTab === 'users' ? 'Yeni Kullanıcı' : 'Yeni Bölüm'}</span>
            </button>
          </div>

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Kullanıcı Bulunamadı</h3>
                  <p className="text-gray-600">
                    {searchTerm ? 'Arama kriterlerinize uygun kullanıcı bulunamadı.' : 'Henüz kullanıcı eklenmemiş.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{user.name}</h3>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {roles.find(r => r.value === user.role)?.label}
                          </span>
                          {user.role === 'maintenance_personnel' && user.specialization && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSpecializationColor(user.specialization)}`}>
                              <Wrench size={12} className="mr-1" />
                              {user.specialization}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{user.email}</p>
                        {user.department && (
                          <p className="text-xs text-gray-500">{user.department.name}</p>
                        )}
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(user.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Departments Tab */}
          {activeTab === 'departments' && (
            <div className="space-y-4">
              {filteredDepartments.length === 0 ? (
                <div className="text-center py-12">
                  <Building size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Bölüm Bulunamadı</h3>
                  <p className="text-gray-600">
                    {searchTerm ? 'Arama kriterlerinize uygun bölüm bulunamadı.' : 'Henüz bölüm eklenmemiş.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredDepartments.map((dept) => (
                    <div key={dept.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditDept(dept)}
                            className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="Düzenle"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(dept.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Sil"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {dept.description && (
                        <p className="text-sm text-gray-600 mb-2">{dept.description}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Oluşturulma: {new Date(dept.created_at).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}
              </h2>
              <button
                onClick={handleCloseUserModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-posta *
                </label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder="kullanici@email.com"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Şifre *
                  </label>
                  <input
                    type="password"
                    required
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ad Soyad *
                </label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ad Soyad"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rol *
                </label>
                <select
                  required
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as User['role'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {userForm.role === 'maintenance_personnel' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Uzmanlık Alanı *
                  </label>
                  <select
                    required
                    value={userForm.specialization}
                    onChange={(e) => setUserForm({ ...userForm, specialization: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {specializations.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Uzmanlık alanı, hangi tür arızalara atanabileceğini belirler. "Genel" seçeneği tüm arıza tiplerine atanabilir.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bölüm
                </label>
                <select
                  value={userForm.department_id}
                  onChange={(e) => setUserForm({ ...userForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Bölüm seçiniz</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseUserModal}
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
                      {editingUser ? 'Güncelle' : 'Ekle'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingDept ? 'Bölüm Düzenle' : 'Yeni Bölüm Ekle'}
              </h2>
              <button
                onClick={handleCloseDeptModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleDeptSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bölüm Adı *
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Bölüm adını giriniz"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama
                </label>
                <textarea
                  rows={3}
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Bölüm açıklaması (isteğe bağlı)"
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseDeptModal}
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
                      {editingDept ? 'Güncelle' : 'Ekle'}
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
                <h3 className="text-lg font-semibold text-gray-900">
                  {activeTab === 'users' ? 'Kullanıcı Sil' : 'Bölüm Sil'}
                </h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                {activeTab === 'users' 
                  ? 'Bu kullanıcıyı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.'
                  : 'Bu bölümü silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve bölüme ait tüm veriler silinecektir.'
                }
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={() => activeTab === 'users' ? handleDeleteUser(deleteConfirm) : handleDeleteDept(deleteConfirm)}
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