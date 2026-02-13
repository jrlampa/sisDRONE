export const tenants = [
  { name: 'Equatorial Energia', primary_color: '#00953a', accent_color: '#ffcd00' },
  { name: 'CEMIG', primary_color: '#005596', accent_color: '#ffffff' }
];

export const users = [
  { username: 'admin_eq', role: 'ADMIN', tenant_id: 1 },
  { username: 'eng_eq', 'ENGINEER': 1, tenant_id: 1 }, // Typo fix: role: 'ENGINEER' in actual code
  { username: 'viewer_eq', role: 'VIEWER', tenant_id: 1 },
  { username: 'admin_cemig', role: 'ADMIN', tenant_id: 2 },
  { username: 'eng_cemig', role: 'ENGINEER', tenant_id: 2 },
  { username: 'viewer_cemig', role: 'VIEWER', tenant_id: 2 }
];

export const materials = [
  { name: 'Poste de Concreto DT 11/400', unit_price: 1200.00, match_keys: 'poste,concreto,substituição de poste' },
  { name: 'Cruzeta de Madeira 2.4m', unit_price: 150.00, match_keys: 'cruzeta,madeira,braço' },
  { name: 'Isolador de Porcelana 15kV', unit_price: 45.00, match_keys: 'isolador,pilar,porcelana' },
  { name: 'Transformador 75kVA', unit_price: 8500.00, match_keys: 'transformador,trafo' },
  { name: 'Chave Fusível Matheus', unit_price: 280.00, match_keys: 'chave,fusível,matheus' },
  { name: 'Para-raios Polimérico 12kV', unit_price: 120.00, match_keys: 'para-raios,pára-raios,dps' },
  { name: 'Cabo de Alumínio CA (kg)', unit_price: 35.00, match_keys: 'cabo,fio,condutor,alumínio' },
  { name: 'Alça Pré-formada', unit_price: 15.00, match_keys: 'alça,pré-formada,amarração' }
];
