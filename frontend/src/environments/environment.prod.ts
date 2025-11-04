export const environment = {
  production: true,
  backendBaseUrl: 'https://api.promptfighters.app', // 部署後請替換成你 Render.com 的後端 URL
  googleClientId: '950693364773-f8v3kpslccvtt645k13adlh661fpma6a.apps.googleusercontent.com',
  
  // thirdweb 配置
  thirdwebClientId: '8e42d9fe5ba38fdb11d156d20d032dcf',
  
  // WalletConnect 配置
  walletConnectProjectId: 'your_walletconnect_project_id',
  
  // Mantle 鏈配置
  mantleChainId: 5003,
  mantleRpcUrl: 'https://rpc.sepolia.mantle.xyz',
  mantleExplorerUrl: 'https://explorer.sepolia.mantle.xyz',

  // 智能合約地址
  marketplaceContractAddress: '0xb29Bd79b4Df92BBb0A718cE45ADe1f3096a145d0', // 部署後填入 MarketplaceV3 合約地址
  nftContractAddress: '0x68785e6460200e22Af7F41121d4B29D7cA7aF4e3', // 填入 NFT Collection 合約地址
  
  
  // 應用程式元數據
  appName: 'Prompt Fighters',
  appDescription: 'AI Hero Battle Game',
  appUrl: 'https://promptfighters.app',
  appIcon: 'https://promptfighters.app/icon.png',
};