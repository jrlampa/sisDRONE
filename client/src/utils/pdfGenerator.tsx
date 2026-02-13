import { pdf } from '@react-pdf/renderer';

import InspectionReport from '../components/Reports/InspectionReport';
import type { Pole, Stats, Tenant } from '../types';

interface ReportData {
  tenant: Tenant;
  stats: Stats;
  poles: Pole[];
  filters: {
    status: string;
    search: string;
  };
}

export const generateInspectionReport = async (data: ReportData) => {
  const blob = await pdf(<InspectionReport {...data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sisdrone_relatorio_${data.tenant.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
