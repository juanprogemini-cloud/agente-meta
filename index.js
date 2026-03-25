import 'dotenv/config';
import adsSdk from 'facebook-nodejs-business-sdk';
const { FacebookAdsApi, User, AdAccount, Campaign } = adsSdk;
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';

// Configuración de Meta
const accessToken = process.env.ACCESS_TOKEN;
FacebookAdsApi.init(accessToken);

// Configuración de Google Sheets
const sheetId = process.env.GOOGLE_SHEET_ID;
const creds = JSON.parse(fs.readFileSync('./google_creds.json'));

const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);

async function getOrCreateSheet(title, headers) {
  let sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    sheet = await doc.addSheet({ title, headerValues: headers });
  } else {
    await sheet.setHeaderRow(headers);
  }
  return sheet;
}

// Traduce el objetivo de la campaña a un tipo de resultado legible
function getResultType(objective = '') {
  const obj = objective.toUpperCase();
  if (obj.includes('OUTCOME_SALES') || obj.includes('CONVERSIONS')) return 'Compras';
  if (obj.includes('OUTCOME_LEADS') || obj.includes('LEAD')) return 'Clientes potenciales';
  if (obj.includes('OUTCOME_TRAFFIC') || obj.includes('LINK_CLICKS')) return 'Clics en el enlace';
  if (obj.includes('REACH')) return 'Alcance';
  if (obj.includes('ENGAGEMENT')) return 'Interacciones';
  if (obj.includes('VIDEO_VIEWS')) return 'Reproducciones de video';
  return 'Conversiones';
}

// Traduce el estado de entrega al español
function translateStatus(status = '') {
  const map = {
    'ACTIVE': 'Activo',
    'PAUSED': 'En pausa',
    'DELETED': 'Eliminado',
    'ARCHIVED': 'Archivado',
    'IN_PROCESS': 'En proceso',
    'WITH_ISSUES': 'Con problemas',
  };
  return map[status.toUpperCase()] || status;
}

async function syncReports() {
  try {
    console.log('Iniciando sincronización (MODO HISTÓRICO)...');
    await doc.loadInfo();

    const HEADERS = [
      'Fecha Reporte',
      'Cuenta',
      'Campaña',
      'Estado de la entrega',
      'CTR (tasa de clics en el enlace)',
      'Tipo de resultado',
      'Resultados',
      'Coste por resultado',
      'Importe gastado (COP)',
      'ROAS de compras',
      'Compras',
      'Coste por compra',
      'Valor de conversión de compras',
      'CPM (coste por 1000 impresiones)',
      'Alcance',
      'Impresiones',
      'Tasa de conversión (%)',
      'Ejecución Script',
    ];

    const ACCOUNT_HEADERS = [
      'Fecha Reporte',
      'Cuenta',
      'Estado de la entrega',
      'Importe gastado (COP)',
      'ROAS de compras',
      'Compras',
      'Coste por compra',
      'Valor de conversión de compras',
      'CPM (coste por 1000 impresiones)',
      'Alcance',
      'Impresiones',
      'CTR (tasa de clics en el enlace)',
      'Tasa de conversión (%)',
      'Ejecución Script',
    ];

    const campaignSheet = await getOrCreateSheet('Detalle por Campaña', HEADERS);
    const accountSheet = await getOrCreateSheet('Resumen por Cuenta', ACCOUNT_HEADERS);

    console.log('Obteniendo cuentas publicitarias...');
    const me = new User('me');
    const accounts = await me.getAdAccounts(['name', 'id', 'currency']);

    const reportData = [];
    const accountReportData = [];
    const executionTime = new Date().toLocaleString('es-CO');

    for (const account of accounts) {
      console.log(`Procesando cuenta: ${account.name}...`);

      // Resumen a nivel de CUENTA
      const accountInsights = await new AdAccount(account.id).getInsights(
        ['spend', 'purchase_roas', 'impressions', 'reach', 'cpm', 'outbound_clicks_ctr', 'actions', 'action_values', 'cost_per_action_type', 'date_start'],
        { date_preset: 'yesterday', level: 'account' }
      );

      if (accountInsights.length > 0 && parseFloat(accountInsights[0].spend || 0) > 0) {
        const ai = accountInsights[0];
        const accPurchases = parseFloat(ai.actions?.find(a => a.action_type === 'purchase')?.value || 0);
        const accCostPerPurchase = parseFloat(ai.cost_per_action_type?.find(a => a.action_type === 'purchase')?.value || 0);
        const accPurchaseValue = parseFloat(ai.action_values?.find(a => a.action_type === 'purchase')?.value || 0);
        const accRoas = ai.purchase_roas ? parseFloat(ai.purchase_roas[0].value).toFixed(2) : '0.00';
        const accCtr = ai.outbound_clicks_ctr ? parseFloat(ai.outbound_clicks_ctr[0]?.value || 0).toFixed(2) : '0.00';
        const accImpressions = parseFloat(ai.impressions || 0);
        const accConvRate = accImpressions > 0 ? ((accPurchases / accImpressions) * 100).toFixed(4) : '0.0000';

        accountReportData.push({
          'Fecha Reporte': ai.date_start,
          'Cuenta': account.name,
          'Estado de la entrega': 'Activo',
          'Importe gastado (COP)': parseFloat(ai.spend).toFixed(0),
          'ROAS de compras': accRoas,
          'Compras': accPurchases,
          'Coste por compra': accCostPerPurchase.toFixed(0),
          'Valor de conversión de compras': accPurchaseValue.toFixed(0),
          'CPM (coste por 1000 impresiones)': parseFloat(ai.cpm || 0).toFixed(0),
          'Alcance': ai.reach || 0,
          'Impresiones': accImpressions,
          'CTR (tasa de clics en el enlace)': accCtr + '%',
          'Tasa de conversión (%)': accConvRate,
          'Ejecución Script': executionTime,
        });
      }

      // Obtener campañas con su estado y objetivo
      const campaigns = await new AdAccount(account.id).getCampaigns(
        ['name', 'id', 'effective_status', 'objective'],
        {}
      );

      for (const campaign of campaigns) {
        // Obtener insights por campaña
        const insights = await new Campaign(campaign.id).getInsights(
          [
            'spend',
            'purchase_roas',
            'impressions',
            'reach',
            'cpm',
            'outbound_clicks_ctr',
            'actions',
            'action_values',
            'cost_per_action_type',
            'date_start',
          ],
          { date_preset: 'yesterday' }
        );

        if (insights.length === 0) continue;
        const insight = insights[0];
        if (parseFloat(insight.spend || 0) <= 0) continue;

        // Extraer métricas de compras
        const purchases = parseFloat(
          insight.actions?.find(a => a.action_type === 'purchase')?.value || 0
        );
        const costPerPurchase = parseFloat(
          insight.cost_per_action_type?.find(a => a.action_type === 'purchase')?.value || 0
        );
        const purchaseValue = parseFloat(
          insight.action_values?.find(a => a.action_type === 'purchase')?.value || 0
        );
        const roas = insight.purchase_roas
          ? parseFloat(insight.purchase_roas[0].value).toFixed(2)
          : '0.00';

        // CTR de clics en el enlace (outbound)
        const ctr = insight.outbound_clicks_ctr
          ? parseFloat(insight.outbound_clicks_ctr[0]?.value || 0).toFixed(2)
          : '0.00';

        // Tipo de resultado y métricas según objetivo
        const objective = campaign.objective || '';
        const resultType = getResultType(objective);

        // Para campañas de compras, el resultado es la compra
        let results = purchases;
        let costPerResult = costPerPurchase.toFixed(0);

        // Tasa de conversión = (compras / impresiones) * 100
        const impressions = parseFloat(insight.impressions || 0);
        const conversionRate = impressions > 0
          ? ((purchases / impressions) * 100).toFixed(4)
          : '0.0000';

        reportData.push({
          'Fecha Reporte': insight.date_start,
          'Cuenta': account.name,
          'Campaña': campaign.name,
          'Estado de la entrega': translateStatus(campaign.effective_status),
          'CTR (tasa de clics en el enlace)': ctr + '%',
          'Tipo de resultado': resultType,
          'Resultados': results,
          'Coste por resultado': costPerResult,
          'Importe gastado (COP)': parseFloat(insight.spend).toFixed(0),
          'ROAS de compras': roas,
          'Compras': purchases,
          'Coste por compra': costPerPurchase.toFixed(0),
          'Valor de conversión de compras': purchaseValue.toFixed(0),
          'CPM (coste por 1000 impresiones)': parseFloat(insight.cpm || 0).toFixed(0),
          'Alcance': insight.reach || 0,
          'Impresiones': impressions,
          'Tasa de conversión (%)': conversionRate,
          'Ejecución Script': executionTime,
        });
      }
    }

    if (reportData.length > 0) {
      await campaignSheet.addRows(reportData);
      console.log(`✅ ${reportData.length} campañas añadidas al histórico.`);
    } else {
      console.log('ℹ️ No se encontraron datos de campañas con gasto para ayer.');
    }

    if (accountReportData.length > 0) {
      await accountSheet.addRows(accountReportData);
      console.log(`✅ ${accountReportData.length} cuentas añadidas al resumen.`);
    } else {
      console.log('ℹ️ No se encontraron datos de cuentas con gasto para ayer.');
    }

    console.log('✅ Sincronización completada con éxito.');

  } catch (error) {
    console.error('❌ Error durante la sincronización:', error);
    if (error.response?.message) {
      console.error('Detalle de Meta:', error.response.message);
    }
  }
}

if (!sheetId || !accessToken) {
  console.error('❌ Faltan variables de entorno en .env (ACCESS_TOKEN o GOOGLE_SHEET_ID)');
} else {
  syncReports();
}
