import os
import json
from pathlib import Path

from web3 import Web3
from eth_account import Account
from solcx import compile_standard, install_solc, set_solc_version


def load_solidity(source_path: Path) -> str:
    with open(source_path, 'r', encoding='utf-8') as f:
        return f.read()


def compile_contract(sol_source: str, contract_name: str = "BattleRegistry", solc_ver: str = "0.8.20"):
    # 安裝並設定指定版本編譯器
    try:
        set_solc_version(solc_ver)
    except Exception:
        install_solc(solc_ver)
        set_solc_version(solc_ver)

    input_json = {
        "language": "Solidity",
        "sources": {
            "BattleRegistry.sol": {"content": sol_source}
        },
        "settings": {
            "outputSelection": {
                "*": {
                    "*": ["abi", "metadata", "evm.bytecode", "evm.deployedBytecode"]
                }
            }
        }
    }

    compiled = compile_standard(input_json)
    contract = compiled["contracts"]["BattleRegistry.sol"][contract_name]
    abi = contract["abi"]
    bytecode = contract["evm"]["bytecode"]["object"]
    return abi, bytecode, compiled


def deploy(abi, bytecode, rpc_url: str, private_key: str, chain_id: int):
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise RuntimeError("RPC 連線失敗：" + rpc_url)

    account = Account.from_key(private_key)
    contract = w3.eth.contract(abi=abi, bytecode=bytecode)

    nonce = w3.eth.get_transaction_count(account.address)
    tx = contract.constructor().build_transaction({
        'from': account.address,
        'nonce': nonce,
        'chainId': chain_id,
        'gasPrice': w3.eth.gas_price,
    })

    # 預估 gas 並加 buffer
    try:
        gas_estimate = w3.eth.estimate_gas(tx)
    except Exception:
        gas_estimate = 1_200_000
    tx['gas'] = int(gas_estimate * 1.2)

    signed = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print("📤 發送交易:", tx_hash.hex())
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    if receipt.status != 1:
        raise RuntimeError("部署失敗，receipt.status != 1")

    address = receipt.contractAddress
    print("✅ 部署成功: ", address)
    return address, receipt


def write_artifacts(abi, address: str, network: str = "mantleSepolia"):
    root = Path(__file__).resolve().parent
    artifacts_dir = root / "artifacts"
    deployments_dir = root / "deployments"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    deployments_dir.mkdir(parents=True, exist_ok=True)

    abi_path = artifacts_dir / "BattleRegistry.abi.json"
    with open(abi_path, 'w', encoding='utf-8') as f:
        json.dump(abi, f, ensure_ascii=False, indent=2)

    dep_path = deployments_dir / f"{network}.json"
    with open(dep_path, 'w', encoding='utf-8') as f:
        json.dump({"address": address}, f, ensure_ascii=False, indent=2)

    print("📝 已輸出:")
    print(" - ABI:", abi_path)
    print(" - 部署記錄:", dep_path)


def main():
    rpc_url = os.getenv('RPC_URL', 'https://rpc.sepolia.mantle.xyz')
    private_key = os.getenv('WALLET_PRIVATE_KEY')
    chain_id = int(os.getenv('CHAIN_ID', '5003'))

    if not private_key:
        raise RuntimeError("請設定 WALLET_PRIVATE_KEY 環境變數")

    sol_path = Path(__file__).resolve().parent / 'contracts' / 'BattleRegistry.sol'
    source = load_solidity(sol_path)
    abi, bytecode, _ = compile_contract(source)

    address, receipt = deploy(abi, bytecode, rpc_url, private_key, chain_id)
    write_artifacts(abi, address)

    # 給後端 .env 使用的輸出
    abi_json = json.dumps(abi, ensure_ascii=False)
    print("\n========= 將以下內容加入 .env =========")
    print(f"BATTLE_REGISTRY_ADDRESS={address}")
    print(f"BATTLE_REGISTRY_ABI_JSON='{abi_json}'")
    print("=====================================\n")


if __name__ == '__main__':
    main()


