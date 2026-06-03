// Centralized PT-BR labels for backend enums
export const ORDER_STATUS_PT = {
  WAITING: "Aguardando",
  PAID: "Pago",
  IN_ANALYSIS: "Em análise",
  DECLINED: "Recusado",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado",
  COURTESY: "Cortesia",
};

export const PAYMENT_METHOD_PT = {
  pix: "PIX",
  credit_card: "Cartão de Crédito",
  courtesy: "Cortesia",
  boleto: "Boleto",
};

export const ROLE_PT = {
  admin: "Administrador",
  comercial: "Comercial",
  financeiro: "Financeiro",
  credenciadora: "Credenciadora",
  lider: "Líder",
  participante: "Participante",
};

export const GENDER_PT = {
  masculino: "Masculino",
  feminino: "Feminino",
  outro: "Outro",
  prefiro_nao_dizer: "Prefiro não dizer",
};

export const statusLabel = (s) => ORDER_STATUS_PT[s] || s;
export const methodLabel = (m) => PAYMENT_METHOD_PT[m] || (m || "—");
export const roleLabel = (r) => ROLE_PT[r] || r;
export const genderLabel = (g) => GENDER_PT[g] || g;
