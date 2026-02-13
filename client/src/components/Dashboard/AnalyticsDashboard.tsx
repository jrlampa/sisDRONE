import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { api } from '../../services/api';
import { Activity, Zap, Box } from 'lucide-react';
import type { DashboardData } from '../../types';



const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await api.getStats();
        setData(res.data);
      } catch (error) {
        console.error('Failed to load stats', error);
      }
    };
    loadStats();
  }, []);

  if (!data) return <div className="p-8 text-center">Carregando Analytics...</div>;

  return (
    <div className="analytics-dashboard p-6 animate-fade-in text-light">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Activity className="text-accent" /> Painel de Analytics Corporativo
      </h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card bg-darker p-4 rounded-lg border border-light/10">
          <div className="flex-between">
            <h3 className="text-muted text-sm uppercase">Total de Ativos</h3>
            <Zap className="text-primary" />
          </div>
          <p className="text-3xl font-bold mt-2">{data.totalPoles}</p>
        </div>
        <div className="card bg-darker p-4 rounded-lg border border-light/10">
          <div className="flex-between">
            <h3 className="text-muted text-sm uppercase">Inspeções Realizadas</h3>
            <Box className="text-secondary" />
          </div>
          <p className="text-3xl font-bold mt-2">{data.totalInspections}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Condition Distribution (Pie) */}
        <div className="card bg-darker p-6 rounded-lg border border-light/10">
          <h3 className="text-lg font-bold mb-4">Saúde da Rede (Condição)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.conditionStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="condition"
                >
                  {data.conditionStats.map((entry, index) => (
                    // Custom color mapping based on condition name
                    <Cell key={`cell-${index}`} fill={
                      entry.condition === 'Crítico' ? '#ef4444' :
                        entry.condition === 'Atenção' ? '#f59e0b' : '#10b981'
                    } />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Material Distribution (Bar) */}
        <div className="card bg-darker p-6 rounded-lg border border-light/10">
          <h3 className="text-lg font-bold mb-4">Distribuição por Material</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.materialStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="material" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AHI Histogram (Area) */}
        <div className="card bg-darker p-6 rounded-lg border border-light/10 col-span-1 lg:col-span-2">
          <h3 className="text-lg font-bold mb-4">Histograma de Índice de Saúde (AHI)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.ahiHistogram}>
                <defs>
                  <linearGradient id="colorAhi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="range" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                />
                <Area type="monotone" dataKey="count" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorAhi)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AnalyticsDashboard;
