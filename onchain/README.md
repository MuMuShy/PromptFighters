# BattleRegistry 合約（Mantle Testnet）

## 合約路徑
- `onchain/contracts/BattleRegistry.sol`

## 快速部署（Hardhat）
1. 初始化（若尚未有）：
```bash
npm init -y
npm i -D hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
```
2. 新增網路設定（`hardhat.config.ts/js`）：
```ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    mantleSepolia: {
      url: process.env.RPC_URL || "https://rpc.sepolia.mantle.xyz",
      accounts: [process.env.WALLET_PRIVATE_KEY!],
      chainId: 5003,
    },
  },
};
export default config;
```
3. 建立部署腳本（`scripts/deploy.ts`）：
```ts
import { ethers } from "hardhat";

async function main() {
  const Factory = await ethers.getContractFactory("BattleRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();
  console.log("BattleRegistry deployed:", await registry.getAddress());
}
main().catch((e) => { console.error(e); process.exit(1); });
```
4. 部署：
```bash
RPC_URL=... WALLET_PRIVATE_KEY=... npx hardhat run scripts/deploy.ts --network mantleSepolia
```

## 後端環境變數
- `BATTLE_REGISTRY_ADDRESS=0x...`
- `BATTLE_REGISTRY_ABI_JSON='[...]'`（部署後由 `artifacts/contracts/BattleRegistry.sol/BattleRegistry.json` 取 `abi` 陣列貼入）
- `RPC_URL=https://rpc.sepolia.mantle.xyz`
- `CHAIN_ID=5003`
- `WALLET_PRIVATE_KEY=你的後端錢包私鑰`

## 校驗
- 鏈上事件：`BattleRecorded(battleId, fighter1, fighter2, winner, resultHash, ipfsCid, timestamp)`
- 後端會把 `battle_result` 上傳 IPFS、計算 `keccak256(JSON)`，再呼叫 `recordBattle`。
- 前端可顯示 Explorer / IPFS 連結並支援本地驗證（下載 JSON 計 hash 對比）。
