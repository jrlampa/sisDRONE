import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { Pole, Stats, Tenant } from '../../types';

// Define styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  section: {
    margin: 10,
    padding: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#334155',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#f1f5f9',
    padding: 15,
    borderRadius: 5,
    width: '30%',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 5,
  },
  table: {
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    minHeight: 25,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 10,
    padding: 5,
    flex: 1,
    color: '#334155',
  },
  statusCritical: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  statusWarning: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },
  statusGood: {
    color: '#10b981',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
});

interface ReportProps {
  tenant: Tenant;
  stats: Stats;
  poles: Pole[];
  filters: {
    status: string;
    search: string;
  };
}

const InspectionReport: React.FC<ReportProps> = ({ tenant, stats, poles, filters }) => {
  const getStatusStyle = (status: string) => {
    const s = status.toUpperCase();
    if (s.includes('CRITIC') || s === 'CRITICAL') return styles.statusCritical;
    if (s.includes('WARN') || s === 'WARNING' || s === 'ATENÇÃO') return styles.statusWarning;
    return styles.statusGood;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={{ ...styles.title, color: tenant.primary_color }}>{tenant.name.toUpperCase()}</Text>
            <Text style={styles.subtitle}>Relatório de Inspeção de Rede</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={{ fontSize: 10, color: '#64748b' }}>Data de Emissão</Text>
            <Text style={{ fontSize: 12 }}>{new Date().toLocaleDateString('pt-BR')}</Text>
          </View>
        </View>

        {/* Filters Summary */}
        <View style={{ marginBottom: 20, backgroundColor: '#f8fafc', padding: 10, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: '#475569' }}>
            Filtros Aplicados: Status={filters.status} | Busca="{filters.search || 'Nenhuma'}"
          </Text>
        </View>

        {/* Statistics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo Operacional</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total de Ativos</Text>
            </View>
            <View style={{ ...styles.statCard, backgroundColor: '#fef2f2' }}>
              <Text style={{ ...styles.statValue, color: '#ef4444' }}>{stats.critical}</Text>
              <Text style={styles.statLabel}>Críticos</Text>
            </View>
            <View style={{ ...styles.statCard, backgroundColor: '#f0fdf4' }}>
              <Text style={{ ...styles.statValue, color: '#10b981' }}>{stats.healthy}</Text>
              <Text style={styles.statLabel}>Saudáveis</Text>
            </View>
          </View>
        </View>

        {/* Assets Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalhamento de Ativos ({poles.length})</Text>

          {/* Table Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { flex: 0.5 }]}>ID</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>Nome / Identificação</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>Material</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Localização (Lat/Lng)</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>Status</Text>
          </View>

          {/* Table Rows */}
          {poles.map((pole, index) => (
            <View key={pole.id} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? '#fff' : '#f8fafc' }]}>
              <Text style={[styles.tableCell, { flex: 0.5 }]}>{pole.id}</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>{pole.name}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{pole.material || 'N/A'}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{pole.lat.toFixed(5)}, {pole.lng.toFixed(5)}</Text>
              <Text style={[styles.tableCell, { flex: 1 }, getStatusStyle(pole.status || 'good')]}>
                {pole.status?.toUpperCase() || 'OK'}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
          `sisDRONE Enterprise Analytics • Página ${pageNumber} de ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export default InspectionReport;
