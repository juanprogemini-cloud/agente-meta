import 'dotenv/config';
import adsSdk from 'facebook-nodejs-business-sdk';
const AdAccount = adsSdk.AdAccount;
const AdsConfig = adsSdk.AdsConfig;
const Business = adsSdk.Business;

const accessToken = process.env.ACCESS_TOKEN;
const api = adsSdk.FacebookAdsApi.init(accessToken);
const showDebugingInfo = true; // Use this to debug the API
if (showDebugingInfo) {
    api.setDebug(true);
}

async function listAdAccounts() {
    try {
        console.log('--- Listando Cuentas Publicitarias ---');
        // Usamos 'me' para referirnos al usuario dueño del token
        const me = await new adsSdk.User('me').getAdAccounts([
            'name',
            'id',
            'account_id',
            'amount_spent',
            'currency'
        ]);
        
        console.log(`Se encontraron ${me.length} cuentas.`);
        
        me.forEach(account => {
            console.log(`- ${account.name} (ID: ${account.id})`);
        });

        return me;
    } catch (error) {
        console.error('Error al listar cuentas:', error);
    }
}

listAdAccounts();
