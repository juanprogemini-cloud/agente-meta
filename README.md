# Reporte Diario Meta Ads a Google Sheets

Este proyecto automatiza la extracción de datos de campañas de Meta Ads y los sincroniza en una hoja de cálculo de Google.

## Estructura del Proyecto

- `index.js`: Script principal de sincronización.
- `google_creds.json`: Credenciales de la Cuenta de Servicio de Google.
- `.env`: Configuración de variables de entorno (Tokens y IDs).

## Configuración Final

1.  Asegúrate de tener un **Token de Acceso** válido de Meta en el archivo `.env`. (El anterior ha expirado).
2.  Pon el **ID de tu Google Sheet** en el archivo `.env`.
3.  Asegúrate de haber **compartido** el Google Sheet con el email: `ads-reporting@meta-ads-reports-491117.iam.gserviceaccount.com` (Permiso Editor).

## Cómo Ejecutar (Local)

1.  Instala dependencias: `npm install`
2.  Ejecuta el script: `node index.js`

## Métricas Extraídas (Ayer)

El script genera automáticamente **dos pestañas** en tu Google Sheet:

1.  **Detalle por Campaña**: Información desglosada (AÑADE FILAS DIARIAMENTE).
2.  **Resumen por Cuenta**: Información agregada (AÑADE FILAS DIARIAMENTE).

El script **no borra los datos anteriores**, sino que añade los del día anterior al final de la lista, permitiéndote tener un **historial completo**.

En ambas hojas se incluyen:
- **Gasto Total**: Importe invertido.
- **ROAS**: Retorno de la inversión en compras.
- **Impresiones, Clicks, CPC, CTR**.
- **Compras**: Conversiones de compra registradas.
- **Fecha**: Fecha de actualización.

---
> [!NOTE]
> Una vez que valides que funciona localmente, podemos configurar **GitHub Actions** para que el reporte se genere solo todos los días.
