import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FaultReport, User, Machine, Department } from '../types';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  AlertTriangle,
  Users,
  Building,
  Wrench,
  Calendar,
  Download,
  Filter,
  Search
} from 'lucide-react';

interface ReportStats {
  totalFaults: number;
  completedFaults: number;
  avgResolutionTime: number;
  totalCost: number;
  faultsByPriority: { [key: string]: number };
  faultsByStatus: { [key: string]: number };
  faultsByType: { [key: string]: number };
  faultsByDepartment: { [key: string]: number };
  monthlyTrends: { month: string; count: number }[];
}

interface PersonnelPerformance {
  id: string;
  name: string;
  completedTasks: number;
  avgResolutionTime: number;
  totalCost: number;
  efficiency: number;
}

interface MachineReport {
  id: string;
  name: string;
  department: string;
  totalFaults: number;
  openFaults: number;
  avgDowntime: number;
  totalCost: number;
  lastFaultDate: string;
}

export default function Reports() {
  const { appUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'personnel' | 'machines'>('overview');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');

  const [stats, setStats] = useState<ReportStats>({
    totalFaults: 0,
    completedFaults: 0,
    avgResolutionTime: 0,
    totalCost: 0,
    faultsByPriority: {},
    faultsByStatus: {},
    faultsByType: {},
    faultsByDepartment: {},
    monthlyTrends: []
  });

  const [personnelPerformance, setPersonnelPerformance] = useState<PersonnelPerformance[]>([]);
  const [machineReports, setMachineReports] = useState<MachineReport[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    fetchReportData();
    fetchDepartments();
  }, [appUser, dateRange]);

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

  const fetchReportData = async () => {
    if (!appUser) return;

    try {
      setLoading(true);
      
      // Base query for fault reports
      let faultsQuery = supabase
        .from('fault_reports')
        .select(`
          *,
          machine:machines(*),
          department:departments(*),
          reporter:users(*),
          assignments:assignments(*),
          maintenance_actions:maintenance_actions(*)
        `)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end + 'T23:59:59');

      // Filter by department for department managers
      if (appUser.role === 'department_manager' && appUser.department_id) {
        faultsQuery = faultsQuery.eq('department_id', appUser.department_id);
      }

      const { data: faults, error } = await faultsQuery;
      if (error) throw error;

      // Calculate overview statistics
      await calculateOverviewStats(faults || []);
      
      // Calculate personnel performance
      await calculatePersonnelPerformance(faults || []);
      
      // Calculate machine reports
      await calculateMachineReports(faults || []);

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateOverviewStats = async (faults: FaultReport[]) => {
    const totalFaults = faults.length;
    const completedFaults = faults.filter(f => f.status === 'tamamlandı').length;
    
    // Calculate average resolution time
    const completedWithTime = faults.filter(f => 
      f.status === 'tamamlandı' && f.maintenance_actions && f.maintenance_actions.length > 0
    );
    
    const totalResolutionTime = completedWithTime.reduce((sum, fault) => {
      const created = new Date(fault.created_at);
      const lastAction = fault.maintenance_actions?.reduce((latest, action) => {
        const actionDate = new Date(action.created_at);
        return actionDate > latest ? actionDate : latest;
      }, new Date(0));
      
      if (lastAction) {
        return sum + (lastAction.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
      }
      return sum;
    }, 0);
    
    const avgResolutionTime = completedWithTime.length > 0 ? totalResolutionTime / completedWithTime.length : 0;
    
    // Calculate total cost
    const totalCost = faults.reduce((sum, fault) => {
      return sum + (fault.maintenance_actions?.reduce((actionSum, action) => actionSum + (action.cost || 0), 0) || 0);
    }, 0);

    // Group by priority
    const faultsByPriority = faults.reduce((acc, fault) => {
      acc[fault.priority] = (acc[fault.priority] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // Group by status
    const faultsByStatus = faults.reduce((acc, fault) => {
      acc[fault.status] = (acc[fault.status] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // Group by type
    const faultsByType = faults.reduce((acc, fault) => {
      acc[fault.fault_type] = (acc[fault.fault_type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // Group by department
    const faultsByDepartment = faults.reduce((acc, fault) => {
      const deptName = fault.department?.name || 'Bilinmeyen';
      acc[deptName] = (acc[deptName] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // Monthly trends
    const monthlyTrends = [];
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    
    for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      
      const monthFaults = faults.filter(f => {
        const faultDate = new Date(f.created_at);
        return faultDate >= monthStart && faultDate <= monthEnd;
      });
      
      monthlyTrends.push({
        month: monthStart.toLocaleDateString('tr-TR', { year: 'numeric', month: 'short' }),
        count: monthFaults.length
      });
    }

    setStats({
      totalFaults,
      completedFaults,
      avgResolutionTime,
      totalCost,
      faultsByPriority,
      faultsByStatus,
      faultsByType,
      faultsByDepartment,
      monthlyTrends
    });
  };

  const calculatePersonnelPerformance = async (faults: FaultReport[]) => {
    try {
      // Get maintenance personnel
      let personnelQuery = supabase
        .from('users')
        .select('*')
        .eq('role', 'maintenance_personnel');

      if (appUser?.role === 'department_manager' && appUser.department_id) {
        personnelQuery = personnelQuery.eq('department_id', appUser.department_id);
      }

      const { data: personnel, error } = await personnelQuery;
      if (error) throw error;

      const performance = personnel?.map(person => {
        const personFaults = faults.filter(f => 
          f.maintenance_actions?.some(action => action.personnel_id === person.id)
        );

        const completedTasks = personFaults.filter(f => f.status === 'tamamlandı').length;
        
        const totalTime = personFaults.reduce((sum, fault) => {
          return sum + (fault.maintenance_actions?.reduce((actionSum, action) => 
            action.personnel_id === person.id ? actionSum + (action.action_time || 0) : actionSum, 0) || 0);
        }, 0);

        const avgResolutionTime = completedTasks > 0 ? totalTime / completedTasks : 0;

        const totalCost = personFaults.reduce((sum, fault) => {
          return sum + (fault.maintenance_actions?.reduce((actionSum, action) => 
            action.personnel_id === person.id ? actionSum + (action.cost || 0) : actionSum, 0) || 0);
        }, 0);

        const efficiency = completedTasks > 0 ? (completedTasks / personFaults.length) * 100 : 0;

        return {
          id: person.id,
          name: person.name,
          completedTasks,
          avgResolutionTime,
          totalCost,
          efficiency
        };
      }) || [];

      setPersonnelPerformance(performance);
    } catch (error) {
      console.error('Error calculating personnel performance:', error);
    }
  };

  const calculateMachineReports = async (faults: FaultReport[]) => {
    try {
      // Get machines
      let machinesQuery = supabase
        .from('machines')
        .select(`
          *,
          department:departments(*)
        `);

      if (appUser?.role === 'department_manager' && appUser.department_id) {
        machinesQuery = machinesQuery.eq('department_id', appUser.department_id);
      }

      const { data: machines, error } = await machinesQuery;
      if (error) throw error;

      const reports = machines?.map(machine => {
        const machineFaults = faults.filter(f => f.machine_id === machine.id);
        const openFaults = machineFaults.filter(f => f.status !== 'tamamlandı' && f.status !== 'kapatıldı').length;
        
        const totalCost = machineFaults.reduce((sum, fault) => {
          return sum + (fault.maintenance_actions?.reduce((actionSum, action) => actionSum + (action.cost || 0), 0) || 0);
        }, 0);

        const completedFaults = machineFaults.filter(f => f.status === 'tamamlandı');
        const avgDowntime = completedFaults.length > 0 ? 
          completedFaults.reduce((sum, fault) => {
            return sum + (fault.maintenance_actions?.reduce((actionSum, action) => actionSum + (action.action_time || 0), 0) || 0);
          }, 0) / completedFaults.length : 0;

        const lastFault = machineFaults.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        return {
          id: machine.id,
          name: machine.name,
          department: machine.department?.name || 'Bilinmeyen',
          totalFaults: machineFaults.length,
          openFaults,
          avgDowntime,
          totalCost,
          lastFaultDate: lastFault ? lastFault.created_at : ''
        };
      }) || [];

      setMachineReports(reports);
    } catch (error) {
      console.error('Error calculating machine reports:', error);
    }
  };

  const exportToCSV = () => {
    let csvContent = '';
    let filename = '';

    if (activeTab === 'overview') {
      csvContent = 'Metrik,Değer\n';
      csvContent += `Toplam Arıza,${stats.totalFaults}\n`;
      csvContent += `Tamamlanan Arıza,${stats.completedFaults}\n`;
      csvContent += `Ortalama Çözüm Süresi (saat),${stats.avgResolutionTime.toFixed(2)}\n`;
      csvContent += `Toplam Maliyet (₺),${stats.totalCost.toFixed(2)}\n`;
      filename = 'genel-rapor.csv';
    } else if (activeTab === 'personnel') {
      csvContent = 'Personel,Tamamlanan İş,Ortalama Süre (dk),Toplam Maliyet (₺),Verimlilik (%)\n';
      filteredPersonnel.forEach(person => {
        csvContent += `${person.name},${person.completedTasks},${person.avgResolutionTime.toFixed(2)},${person.totalCost.toFixed(2)},${person.efficiency.toFixed(1)}\n`;
      });
      filename = 'personel-performans.csv';
    } else if (activeTab === 'machines') {
      csvContent = 'Makine,Bölüm,Toplam Arıza,Açık Arıza,Ortalama Duruş (dk),Toplam Maliyet (₺),Son Arıza\n';
      filteredMachines.forEach(machine => {
        csvContent += `${machine.name},${machine.department},${machine.totalFaults},${machine.openFaults},${machine.avgDowntime.toFixed(2)},${machine.totalCost.toFixed(2)},${machine.lastFaultDate ? new Date(machine.lastFaultDate).toLocaleDateString('tr-TR') : 'Yok'}\n`;
      });
      filename = 'makine-raporu.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const filteredPersonnel = personnelPerformance.filter(person =>
    person.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMachines = machineReports.filter(machine => {
    const matchesSearch = machine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         machine.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = !selectedDepartment || machine.department === selectedDepartment;
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
          <BarChart3 className="h-8 w-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900">Raporlar</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar size={16} className="text-gray-500" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
            />
          </div>
          
          <button
            onClick={exportToCSV}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex items-center space-x-2"
          >
            <Download size={16} />
            <span>Dışa Aktar</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp size={16} className="inline mr-2" />
              Genel Bakış
            </button>
            <button
              onClick={() => setActiveTab('personnel')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'personnel'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users size={16} className="inline mr-2" />
              Personel Performansı
            </button>
            <button
              onClick={() => setActiveTab('machines')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'machines'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Building size={16} className="inline mr-2" />
              Makine Raporları
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Toplam Arıza</p>
                      <p className="text-3xl font-bold">{stats.totalFaults}</p>
                    </div>
                    <AlertTriangle size={32} className="text-blue-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">Tamamlanan</p>
                      <p className="text-3xl font-bold">{stats.completedFaults}</p>
                    </div>
                    <Wrench size={32} className="text-green-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-100 text-sm">Ort. Çözüm Süresi</p>
                      <p className="text-3xl font-bold">{stats.avgResolutionTime.toFixed(1)}h</p>
                    </div>
                    <Clock size={32} className="text-yellow-200" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm">Toplam Maliyet</p>
                      <p className="text-3xl font-bold">₺{stats.totalCost.toLocaleString('tr-TR')}</p>
                    </div>
                    <DollarSign size={32} className="text-purple-200" />
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Priority Distribution */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Öncelik Dağılımı</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.faultsByPriority).map(([priority, count]) => (
                      <div key={priority} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 capitalize">{priority}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                priority === 'acil' ? 'bg-red-500' :
                                priority === 'yüksek' ? 'bg-orange-500' :
                                priority === 'orta' ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${(count / stats.totalFaults) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Distribution */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Durum Dağılımı</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.faultsByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{status}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                status === 'açık' ? 'bg-red-500' :
                                status === 'atandı' ? 'bg-blue-500' :
                                status === 'devam_ediyor' ? 'bg-yellow-500' :
                                status === 'tamamlandı' ? 'bg-green-500' : 'bg-gray-500'
                              }`}
                              style={{ width: `${(count / stats.totalFaults) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fault Types */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Arıza Tipleri</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.faultsByType).slice(0, 5).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{type}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full bg-orange-500"
                              style={{ width: `${(count / stats.totalFaults) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Monthly Trends */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Aylık Trend</h3>
                  <div className="space-y-2">
                    {stats.monthlyTrends.map((trend, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{trend.month}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full bg-blue-500"
                              style={{ 
                                width: `${Math.max((trend.count / Math.max(...stats.monthlyTrends.map(t => t.count))) * 100, 5)}%` 
                              }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{trend.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Personnel Tab */}
          {activeTab === 'personnel' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Personel ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredPersonnel.length === 0 ? (
                  <div className="text-center py-12">
                    <Users size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Personel Bulunamadı</h3>
                    <p className="text-gray-600">Seçilen tarih aralığında veri bulunamadı.</p>
                  </div>
                ) : (
                  filteredPersonnel.map((person) => (
                    <div key={person.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">{person.name}</h3>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            person.efficiency >= 80 ? 'bg-green-100 text-green-800' :
                            person.efficiency >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            %{person.efficiency.toFixed(1)} Verimlilik
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">{person.completedTasks}</p>
                          <p className="text-sm text-gray-600">Tamamlanan İş</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-yellow-600">{person.avgResolutionTime.toFixed(1)}dk</p>
                          <p className="text-sm text-gray-600">Ortalama Süre</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">₺{person.totalCost.toLocaleString('tr-TR')}</p>
                          <p className="text-sm text-gray-600">Toplam Maliyet</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Machines Tab */}
          {activeTab === 'machines' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Makine ara..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <select
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none"
                    >
                      <option value="">Tüm Bölümler</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.name}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredMachines.length === 0 ? (
                  <div className="text-center py-12">
                    <Building size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Makine Bulunamadı</h3>
                    <p className="text-gray-600">Seçilen kriterlere uygun makine bulunamadı.</p>
                  </div>
                ) : (
                  filteredMachines.map((machine) => (
                    <div key={machine.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{machine.name}</h3>
                          <p className="text-sm text-gray-600">{machine.department}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {machine.openFaults > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {machine.openFaults} Açık Arıza
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <p className="text-xl font-bold text-blue-600">{machine.totalFaults}</p>
                          <p className="text-xs text-gray-600">Toplam Arıza</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-yellow-600">{machine.avgDowntime.toFixed(1)}dk</p>
                          <p className="text-xs text-gray-600">Ort. Duruş</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-green-600">₺{machine.totalCost.toLocaleString('tr-TR')}</p>
                          <p className="text-xs text-gray-600">Toplam Maliyet</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-gray-600">
                            {machine.lastFaultDate ? new Date(machine.lastFaultDate).toLocaleDateString('tr-TR') : 'Yok'}
                          </p>
                          <p className="text-xs text-gray-600">Son Arıza</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}