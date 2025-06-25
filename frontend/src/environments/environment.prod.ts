export const environment = {
  production: true,
  backendBaseUrl: 'https://api.promptfighters.app', // 部署後請替換成你 Render.com 的後端 URL
  googleClientId: '950693364773-f8v3kpslccvtt645k13adlh661fpma6a.apps.googleusercontent.com',
  
  // thirdweb 配置
  thirdwebClientId: '8e42d9fe5ba38fdb11d156d20d032dcf',
  
  // WalletConnect 配置
  walletConnectProjectId: process.env['WALLETCONNECT_PROJECT_ID'] || 'your_walletconnect_project_id',
  
  // Mantle 鏈配置
  mantleChainId: 5000,
  mantleRpcUrl: 'https://rpc.mantle.xyz',
  mantleExplorerUrl: 'https://explorer.mantle.xyz',
  
  // 應用程式元數據
  appName: 'Prompt Fighters',
  appDescription: 'AI Hero Battle Game',
  appUrl: 'https://promptfighters.app',
  appIcon: 'https://promptfighters.app/icon.png',
};