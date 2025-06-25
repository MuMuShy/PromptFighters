export const environment = {
  production: false,
  backendBaseUrl: 'http://localhost:8000',
  googleClientId: '950693364773-f8v3kpslccvtt645k13adlh661fpma6a.apps.googleusercontent.com',
  
  // thirdweb 配置
  thirdwebClientId: '8e42d9fe5ba38fdb11d156d20d032dcf', // 需要從 thirdweb dashboard 取得
  
  // WalletConnect 配置
  walletConnectProjectId: 'your_walletconnect_project_id', // 需要從 WalletConnect 取得
  
  // Mantle 鏈配置
  mantleChainId: 5000,
  mantleRpcUrl: 'https://rpc.mantle.xyz',
  mantleExplorerUrl: 'https://explorer.mantle.xyz',
  
  // 應用程式元數據
  appName: 'Prompt Fighters',
  appDescription: 'AI Hero Battle Game',
  appUrl: 'https://promptfighters.com',
  appIcon: 'https://promptfighters.com/icon.png',
};