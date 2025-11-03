import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Web3Service } from './web3.service';
import { 
  getContract, 
  prepareContractCall, 
  sendTransaction, 
  waitForReceipt,
  readContract,
  getContractEvents,
  prepareEvent
} from 'thirdweb';
import { cancelListing as cancelListingExtension } from 'thirdweb/extensions/marketplace';

export interface MarketplaceListing {
  listing_id: string;
  chain_listing_id?: number;
  character: {
    id: string;
    name: string;
    image_url: string;
    rarity: number;
    rarity_name: string;
    level: number;
    strength: number;
    agility: number;
    luck: number;
    win_count: number;
    loss_count: number;
    token_id: number;
    contract_address: string;
  };
  seller: {
    id: string;
    nickname: string;
  };
  price: string; // MNT 格式（用於顯示）
  priceWei?: string; // wei 格式（用於鏈上交易）
  currency: string;
  listed_at: string;
  expires_at?: string;
}

export interface MarketplaceStats {
  total_listings: number;
  total_sold: number;
  price_stats: {
    average: string;
    max: string;
    min: string;
  };
  volume: {
    '24h': string;
    '7d': string;
  };
  rarity_distribution: { [key: string]: number };
}

@Injectable({
  providedIn: 'root'
})
export class MarketplaceService {
  private apiUrl = environment.backendBaseUrl + '/api';
  private marketplaceAddress: string = environment.marketplaceContractAddress || '';
  private nftContractAddress: string = environment.nftContractAddress || '';
  
  // EVM 鏈通用的原生代幣假地址
  // 這個地址在所有 EVM 鏈（包括 Mantle）上都代表鏈的原生代幣
  // 在 Mantle 上代表 MNT，在 Ethereum 上代表 ETH，以此類推
  private readonly NATIVE_CURRENCY_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  
  // Mantle Chain（使用 Web3Service 的配置）
  private get chain() {
    return this.web3Service.getMantleChain();
  }

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private web3Service: Web3Service
  ) {}

  /**
   * 獲取 thirdweb client
   */
  private getClient() {
    return this.web3Service.getClient();
  }

  /**
   * 獲取當前連接的賬戶
   */
  private async getAccount() {
    const wallet = this.web3Service.currentWallet;
    if (!wallet) {
      throw new Error('錢包未連接');
    }
    const account = wallet.getAccount();
    if (!account) {
      throw new Error('無法獲取賬戶');
    }
    return account;
  }

  /**
   * 獲取 Marketplace 合約實例
   * 
   * 注意：thirdweb v5 的 getContract 需要 ABI 或使用 extension 模式
   * 如果沒有 ABI，可以使用 toFunction 或 encodeFunctionData
   */
  private getMarketplaceContract() {
    if (!this.marketplaceAddress) {
      throw new Error('Marketplace 合約地址未配置');
    }
    
    // thirdweb v5: getContract 默認會自動檢測合約支持的擴展
    // 但 MarketplaceV3 可能需要明確指定或提供 ABI
    const contract = getContract({
      client: this.getClient(),
      chain: this.chain,
      address: this.marketplaceAddress,
    });
    
    return contract;
  }

  /**
   * 獲取 NFT 合約實例
   */
  private getNFTContract() {
    if (!this.nftContractAddress) {
      throw new Error('NFT 合約地址未配置');
    }
    return getContract({
      client: this.getClient(),
      chain: this.chain,
      address: this.nftContractAddress,
    });
  }

  /**
   * 讀取 NFT 擁有者
   */
  async ownerOf(tokenId: number): Promise<string | null> {
    try {
      const nftContract = this.getNFTContract();
      const owner = await readContract({
        contract: nftContract,
        method: "function ownerOf(uint256) view returns (address)",
        params: [BigInt(tokenId)],
      });
      return String(owner).toLowerCase();
    } catch (error) {
      console.warn('ownerOf 調用失敗:', error);
      return null;
    }
  }

  /**
   * 嘗試獲取地址持有的所有 tokenId（需要合約支援 ERC721Enumerable）
   */
  async getOwnedTokenIds(ownerAddress: string): Promise<number[] | null> {
    try {
      const nftContract = this.getNFTContract();
      const balance = await readContract({
        contract: nftContract,
        method: "function balanceOf(address) view returns (uint256)",
        params: [ownerAddress],
      }) as bigint;

      const count = Number(balance);
      const tokenIds: number[] = [];
      for (let i = 0; i < count; i++) {
        const tokenId = await readContract({
          contract: nftContract,
          method: "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)",
          params: [ownerAddress, BigInt(i)],
        }) as bigint;
        tokenIds.push(Number(tokenId));
      }
      return tokenIds;
    } catch (error) {
      // 若不支援 Enumerable，返回 null 以便上層退回逐一 ownerOf 檢查
      console.warn('getOwnedTokenIds 調用失敗（可能未支援 Enumerable）:', error);
      return null;
    }
  }

  /**
   * 檢查 NFT 是否已批准 Marketplace
   */
  async checkNFTApproval(tokenId: number, ownerAddress: string): Promise<boolean> {
    try {
      const nftContract = this.getNFTContract();
      const marketplaceContract = this.getMarketplaceContract();
      
      const isApproved = await readContract({
        contract: nftContract,
        method: "function isApprovedForAll(address owner, address operator) view returns (bool)",
        params: [ownerAddress, marketplaceContract.address],
      });
      
      return isApproved as boolean;
    } catch (error) {
      console.error('檢查 NFT 批准失敗:', error);
      return false;
    }
  }

  /**
   * 批准 Marketplace 轉移 NFT
   */
  async approveNFTForMarketplace(tokenId: number): Promise<string> {
    try {
      const account = await this.getAccount();
      const nftContract = this.getNFTContract();
      const marketplaceContract = this.getMarketplaceContract();
      
      const tx = prepareContractCall({
        contract: nftContract,
        method: "function setApprovalForAll(address operator, bool approved)",
        params: [marketplaceContract.address, true],
      });
      
      const result = await sendTransaction({ 
        transaction: tx, 
        account 
      });
      
      const receipt = await waitForReceipt(result);
      return receipt.transactionHash as string;
    } catch (error: any) {
      console.error('批准 NFT 失敗:', error);
      throw new Error(error.message || '批准失敗');
    }
  }

  /**
   * 上架角色（鏈上交易）
   * 
   * @returns {Promise<{txHash: string, listingId?: number}>} 交易哈希和可選的 listing ID
   */
  async listCharacter(
    tokenId: number,
    priceInEth: string,
    expiresAt?: number
  ): Promise<{txHash: string, listingId?: number}> {
    try {
      const account = await this.getAccount();
      const marketplaceContract = this.getMarketplaceContract();
      const nftContract = this.getNFTContract();
      
      // 轉換價格為 wei（MNT）
      const priceWei = BigInt(Math.floor(parseFloat(priceInEth) * 1e18));
      
      // 設置時間
      // uint128 最大值：2^128 - 1 = 340282366920938463463374607431768211455
      // 使用當前時間戳（秒）作為開始時間
      const startTime = Math.floor(Date.now() / 1000);
      // 如果沒有指定過期時間，設置為 100 年後（實際上的無限期）
      // uint128 最大值約為 340 億年，100 年 = 3153600000 秒
      const endTime = expiresAt 
        ? expiresAt 
        : startTime + (100 * 365 * 24 * 60 * 60); // 100 年後
      
      // 構建交易
      // thirdweb v5: 需要檢查合約地址是否配置，並使用正確的方法格式
      if (!this.marketplaceAddress || this.marketplaceAddress === '') {
        throw new Error('Marketplace 合約地址未配置，請在 environment.ts 中設置 marketplaceContractAddress');
      }
      
      // 根據 ABI，createListing 接受一個 struct 參數：ListingParameters
      // struct ListingParameters {
      //   address assetContract;
      //   uint256 tokenId;
      //   uint256 quantity;
      //   address currency;
      //   uint256 pricePerToken;
      //   uint128 startTimestamp;
      //   uint128 endTimestamp;
      //   bool reserved;
      // }
      // thirdweb v5: struct 參數需要展開為數組格式
      // 
      // 使用 EVM 通用的原生代幣地址
      // MarketplaceV3 合約會識別此地址並使用 msg.value 處理原生代幣支付
      const currencyForListing = this.NATIVE_CURRENCY_ADDRESS;
      
      console.log(`📝 上架參數:`, {
        tokenId,
        priceWei: priceWei.toString(),
        currency: currencyForListing,
        note: '使用原生代幣地址 (0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)，合約會使用 msg.value 處理支付'
      });
      
      const tx = prepareContractCall({
        contract: marketplaceContract,
        // 方法簽名：接受一個 struct 參數（展開為元組）
        method: "function createListing((address,uint256,uint256,address,uint256,uint128,uint128,bool)) returns (uint256)",
        params: [
          [
            nftContract.address,              // assetContract
            BigInt(tokenId),                  // tokenId
            BigInt(1),                        // quantity
            currencyForListing,               // currency: 原生代幣地址（MarketplaceV3 會使用 msg.value 處理支付）
            priceWei,                         // pricePerToken (in wei)
            BigInt(startTime),                 // startTimestamp (uint128)
            BigInt(endTime),                   // endTimestamp (uint128) - 使用合理的時間戳
            false                              // reserved
          ]
        ],
      });
      
      const result = await sendTransaction({ 
        transaction: tx, 
        account 
      });
      
      const receipt = await waitForReceipt(result);
      
      // 嘗試從事件中獲取 listing_id
      // 注意：thirdweb 的 receipt 可能包含事件，需要解析
      let listingId: number | undefined;
      try {
        // 可以從 receipt.logs 中解析 NewListing 事件
        // 這裡簡化處理，實際應該解析事件
        // 或者前端可以調用 totalListings() 來獲取最新的 listing ID
        const totalListings = await readContract({
          contract: marketplaceContract,
          method: "function totalListings() view returns (uint256)",
          params: [],
        }) as bigint;
        listingId = Number(totalListings) - 1; // 最新的 listing ID
      } catch (e) {
        console.warn('無法獲取 listing ID:', e);
      }
      
      return {
        txHash: receipt.transactionHash as string,
        listingId
      };
    } catch (error: any) {
      console.error('上架失敗:', error);
      throw new Error(error.message || '上架失敗');
    }
  }

  /**
   * 檢查 ERC20 Token 餘額
   */
  async checkTokenBalance(tokenAddress: string, ownerAddress: string): Promise<bigint> {
    try {
      const tokenContract = getContract({
        client: this.getClient(),
        chain: this.chain,
        address: tokenAddress as `0x${string}`,
      });
      
      const balance = await readContract({
        contract: tokenContract,
        method: "function balanceOf(address) view returns (uint256)",
        params: [ownerAddress as `0x${string}`],
      }) as bigint;
      
      return balance;
    } catch (error) {
      console.error('檢查 Token 餘額失敗:', error);
      throw error;
    }
  }

  /**
   * 檢查 ERC20 Token 批准額度
   */
  async checkTokenAllowance(tokenAddress: string, ownerAddress: string, spenderAddress: string): Promise<bigint> {
    try {
      const tokenContract = getContract({
        client: this.getClient(),
        chain: this.chain,
        address: tokenAddress as `0x${string}`,
      });
      
      const allowance = await readContract({
        contract: tokenContract,
        method: "function allowance(address owner, address spender) view returns (uint256)",
        params: [ownerAddress as `0x${string}`, spenderAddress as `0x${string}`],
      }) as bigint;
      
      return allowance;
    } catch (error) {
      console.error('檢查 Token 批准額度失敗:', error);
      throw error;
    }
  }

  /**
   * 批准 Marketplace 使用 ERC20 Token
   */
  async approveTokenForMarketplace(tokenAddress: string, amount: bigint): Promise<string> {
    try {
      const account = await this.getAccount();
      const marketplaceContract = this.getMarketplaceContract();
      const tokenContract = getContract({
        client: this.getClient(),
        chain: this.chain,
        address: tokenAddress as `0x${string}`,
      });
      
      const tx = prepareContractCall({
        contract: tokenContract,
        method: "function approve(address spender, uint256 amount)",
        params: [marketplaceContract.address, amount],
      });
      
      const result = await sendTransaction({ 
        transaction: tx, 
        account 
      });
      
      const receipt = await waitForReceipt(result);
      return receipt.transactionHash as string;
    } catch (error: any) {
      console.error('批准 Token 失敗:', error);
      throw new Error(error.message || '批准失敗');
    }
  }

  /**
   * 購買角色（鏈上交易）
   * @param listingId 上架 ID
   * @param priceInWei 價格（wei 格式的字符串，例如 "1000000000000000000"）
   * @param currency 貨幣地址（可選，默認為 MNT Token 地址）
   */
  async buyCharacter(
    listingId: number,
    priceInWei: string,
    currency?: string
  ): Promise<string> {
    try {
      const account = await this.getAccount();
      const marketplaceContract = this.getMarketplaceContract();
      
      // priceInWei 已經是 wei 格式的字符串，直接轉換為 BigInt
      const priceWei = BigInt(priceInWei);
      
      // 如果沒有指定 currency，使用原生代幣地址
      let currencyAddress = currency || this.NATIVE_CURRENCY_ADDRESS;
      
      // 處理：識別原生代幣地址
      const currencyLower = currencyAddress.toLowerCase();
      const nativeCurrencyLower = this.NATIVE_CURRENCY_ADDRESS.toLowerCase();
      
      // 檢查是否為原生代幣（包括舊地址和新地址，以及零地址）
      const isNativeCurrency = currencyLower === nativeCurrencyLower ||
                                currencyLower === '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000' ||
                                currencyLower === '0x0000000000000000000000000000000000000000' ||
                                currencyLower === '0x0' ||
                                !currencyAddress || currencyAddress.trim() === '';
      
      // 統一轉換為標準原生代幣地址
      // MarketplaceV3 合約會識別此地址並使用 msg.value 處理原生代幣支付
      if (isNativeCurrency) {
        console.log(`🔄 檢測到原生代幣地址 (${currencyAddress})，轉換為標準原生代幣地址`);
        currencyAddress = this.NATIVE_CURRENCY_ADDRESS;
      }
      
      console.log(`💰 購買參數:`, {
        listingId,
        priceWei: priceWei.toString(),
        originalCurrency: currency,
        currencyAddress,
        isNativeCurrency
      });
      
      // 如果不是原生代幣（真正的 ERC20 Token），檢查餘額和批准
      if (!isNativeCurrency) {
        // 對於標準 ERC20 Token，需要：
        // 1. 檢查餘額
        const balance = await this.checkTokenBalance(currencyAddress, account.address);
        if (balance < priceWei) {
          throw new Error(`Token 餘額不足。需要 ${priceWei.toString()} wei，當前餘額: ${balance.toString()} wei`);
        }
        
        // 2. 檢查批准額度（Marketplace 合約的地址）
        const allowance = await this.checkTokenAllowance(
          currencyAddress,
          account.address,
          marketplaceContract.address
        );
        
        // 如果批准額度不足，需要先批准
        // 注意：可以使用 Token 合約的 approve 函數，或 Marketplace 的 approveCurrencyForListing
        // 但由於我們已經有 checkTokenAllowance 和 approveTokenForMarketplace 方法，這裡只檢查
        // 如果不足，應該在 UI 層提示用戶批准
        if (allowance < priceWei) {
          throw new Error('Token 尚未批准 Marketplace。請先批准 Marketplace 使用你的 Token。');
        }
      } else {
        // 原生代幣：不需要批准，直接使用交易的 value 參數發送
        // MarketplaceV3 合約會識別原生代幣地址並使用 msg.value 處理支付
        console.log('✅ 使用原生代幣購買，將通過 value 參數發送:', priceWei.toString(), 'wei');
        console.log('📌 原生代幣不需要 approve，合約會使用 msg.value 處理支付');
      }
      
      // 確保 currencyAddress 是小寫格式（合約期望的格式）
      const finalCurrencyAddress = currencyAddress.toLowerCase() as `0x${string}`;
      
      console.log(`📝 準備交易:`, {
        listingId,
        buyFor: account.address,
        quantity: 1,
        currency: finalCurrencyAddress,
        expectedTotalPrice: priceWei.toString(),
        value: isNativeCurrency ? priceWei.toString() : '0',
        isNativeCurrency,
        note: isNativeCurrency ? `使用原生 MNT (${finalCurrencyAddress})，通過 value 發送` : '使用 ERC20 Token（需要已批准）'
      });
      
      // 重要：MarketplaceV3 的 buyFromListing 函數邏輯：
      // 1. 如果 currency 是原生代幣地址 (0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)，合約會使用 msg.value 作為支付
      // 2. 如果 currency 是標準 ERC20 Token，使用該 Token 的 transferFrom（需要事先批准）
      // 因此：
      // - 原生代幣：currency = 原生代幣地址，且設置 value（合約使用 msg.value）
      // - ERC20 Token：currency = Token 地址，且不設置 value（合約使用 transferFrom）
      
      const tx = prepareContractCall({
        contract: marketplaceContract,
        method: "function buyFromListing(uint256,address,uint256,address,uint256)",
        params: [
          BigInt(listingId),    // listingId
          account.address,      // buyFor
          BigInt(1),            // quantity
          finalCurrencyAddress, // currency: 原生代幣地址或標準 ERC20 Token 地址
          priceWei              // expectedTotalPrice (in wei)
        ],
        value: priceWei,  // 支付金額（使用 MNT）
      });
      
      const result = await sendTransaction({ 
        transaction: tx, 
        account 
      });
      
      const receipt = await waitForReceipt(result);
      return receipt.transactionHash as string;
    } catch (error: any) {
      console.error('購買失敗:', error);
      throw new Error(error.message || '購買失敗');
    }
  }

  /**
   * 取消上架（鏈上交易）
   */
  async cancelListing(listingId: number): Promise<string> {
    try {
      const account = await this.getAccount();
      const marketplaceContract = this.getMarketplaceContract();
      
      console.log(`🔄 準備取消 listing ID: ${listingId}`);
      
      // 根據 MarketplaceV3 ABI，取消上架使用 cancelDirectListing
      // thirdweb v5: 使用 Marketplace extension 來調用 cancelListing
      // extension API 會自動處理方法名稱和參數格式
      console.log(`嘗試取消 listing，ID: ${listingId}`);
      
      // 使用 thirdweb Marketplace extension 的 cancelListing 方法
      // 這是推薦的方式，因為 extension 會自動處理正確的方法簽名
      let tx;
      try {
        // 方式 1: 使用 extension API（推薦）
        tx = cancelListingExtension({
          contract: marketplaceContract,
          listingId: BigInt(listingId),
        });
        console.log(`✅ 使用 Marketplace extension 準備取消上架交易`);
      } catch (extensionError: any) {
        console.warn('Extension API 失敗，嘗試手動 prepareContractCall:', extensionError.message);
        // 方式 2: 如果 extension 失敗，回退到手動調用
        const possibleMethods = [
          "function cancelDirectListing(uint256)",
          "function cancelListing(uint256)",
          "function cancel(uint256)",
        ];
        
        let lastError: any = extensionError;
        for (const method of possibleMethods) {
          try {
            console.log(`嘗試方法簽名: ${method}`);
            tx = prepareContractCall({
              contract: marketplaceContract,
              method: method as any,
              params: [BigInt(listingId)],
            });
            console.log(`✅ 成功使用簽名: ${method}`);
            break; // 成功，跳出循環
          } catch (error: any) {
            console.warn(`方法簽名 ${method} 失敗:`, error.message);
            lastError = error;
            continue; // 嘗試下一個
          }
        }
        
        if (!tx) {
          throw new Error(`無法準備取消上架交易。Extension API 和所有方法簽名都失敗。最後的錯誤: ${lastError?.message || 'unknown error'}`);
        }
      }
      
      console.log(`📤 發送取消上架交易...`);
      const result = await sendTransaction({ 
        transaction: tx, 
        account 
      });
      
      console.log(`⏳ 等待交易確認...`);
      const receipt = await waitForReceipt(result);
      console.log(`✅ 取消上架交易成功: ${receipt.transactionHash}`);
      
      return receipt.transactionHash as string;
    } catch (error: any) {
      console.error('❌ 取消上架失敗:', error);
      // 提供更詳細的錯誤信息
      const errorMsg = error.message || error.toString() || '取消上架失敗';
      throw new Error(errorMsg);
    }
  }

  /**
   * 從後端獲取市場列表（用於快速查詢）
   */
  browseMarketplace(params?: {
    page?: number;
    limit?: number;
    rarity?: string;
    min_price?: string;
    max_price?: string;
    search?: string;
    sort_by?: string;
  }): Observable<{
    success: boolean;
    data: {
      listings: MarketplaceListing[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    };
  }> {
    let url = `${this.apiUrl}/marketplace/`;
    const queryParams = new URLSearchParams();
    
    if (params) {
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.rarity) queryParams.append('rarity', params.rarity);
      if (params.min_price) queryParams.append('min_price', params.min_price);
      if (params.max_price) queryParams.append('max_price', params.max_price);
      if (params.search) queryParams.append('search', params.search);
      if (params.sort_by) queryParams.append('sort_by', params.sort_by);
    }
    
    if (queryParams.toString()) {
      url += '?' + queryParams.toString();
    }
    
    return this.http.get<any>(url);
  }

  /**
   * 獲取市場統計
   */
  getMarketplaceStats(): Observable<{
    success: boolean;
    data: MarketplaceStats;
  }> {
    return this.http.get<any>(`${this.apiUrl}/marketplace/stats/`);
  }

  /**
   * 通知後端索引新上架（可選，用於後端索引）
   */
  notifyListingCreated(
    txHash: string, 
    listingId: number, 
    characterId: string,
    price?: string
  ): Observable<any> {
    const headers = this.getAuthHeaders();
    const body: any = {
      tx_hash: txHash,
      listing_id: listingId,
      character_id: characterId,
    };
    
    // 如果提供了價格，一起傳遞
    if (price) {
      body.price = price;
    }
    
    // 傳遞貨幣類型（原生代幣地址）
    body.currency = this.NATIVE_CURRENCY_ADDRESS;
    
    return this.http.post(
      `${this.apiUrl}/marketplace/list/`,
      body,
      { headers }
    );
  }

  /**
   * 通知後端索引購買（可選，用於後端索引）
   */
  notifyPurchase(txHash: string, listingId: number): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post(
      `${this.apiUrl}/marketplace/buy/`,
      {
        tx_hash: txHash,
        listing_id: listingId,
      },
      { headers }
    );
  }

  /**
   * 從鏈上獲取指定 tokenId 的所有 listing（可能有多個）
   */
  async getAllListingsByTokenId(tokenId: number): Promise<Array<{
    listingId: number;
    price: string;
    currency: string;
    seller: string;
    status: number;
  }>> {
    try {
      const allListings = await this.getAllListingsFromChain();
      // getAllListingsFromChain 已經過濾了 status = 3，這裡只需要過濾 tokenId 和 active status
      const listings = allListings.filter(l => l.tokenId === tokenId && l.status === 1);
      return listings.map(l => ({
        listingId: l.listingId,
        price: l.price,
        currency: l.currency,
        seller: l.seller,
        status: l.status,
      }));
    } catch (error: any) {
      console.error('從鏈上查詢 listing 失敗:', error);
      return [];
    }
  }

  /**
   * 從鏈上獲取指定 tokenId 的第一個 active listing（保持向後兼容）
   */
  async getListingByTokenId(tokenId: number): Promise<{
    listingId: number | null;
    price: string;
    currency: string;
    seller: string;
    status: number;
  } | null> {
    try {
      const listings = await this.getAllListingsByTokenId(tokenId);
      
      if (listings.length > 0) {
        // 如果有多個，返回第一個
        if (listings.length > 1) {
          console.warn(`⚠️ Token ID ${tokenId} 有多個 active listing，返回第一個:`, listings);
        }
        return listings[0];
      }
      
      return null;
    } catch (error: any) {
      console.error('從鏈上查詢 listing 失敗:', error);
      return null;
    }
  }

  /**
   * 從鏈上獲取所有 listing（直接查詢鏈上數據）
   * 使用 getAllListings 方法獲取結構化數據
   */
  async getAllListingsFromChain(): Promise<Array<{
    listingId: number;
    tokenId: number;
    price: string; // MNT 格式（已轉換）
    priceWei?: string; // 原始 wei 格式（用於鏈上交易）
    currency: string;
    seller: string;
    assetContract: string;
    status: number;
  }>> {
    try {
      const marketplaceContract = this.getMarketplaceContract();
      
      // 獲取總 listing 數量
      const totalListings = await readContract({
        contract: marketplaceContract,
        method: "function totalListings() view returns (uint256)",
        params: [],
      }) as bigint;
      
      const total = Number(totalListings);
      
      console.log(`從鏈上獲取 listing，總數: ${total}`);
      
      if (total === 0) {
        return [];
      }
      
      // 使用 getAllListings 方法一次性獲取所有 listing
      const allListingsData = await readContract({
        contract: marketplaceContract,
        method: "function getAllListings(uint256 _startId, uint256 _endId) view returns ((uint256 listingId, uint256 tokenId, uint256 quantity, uint256 pricePerToken, uint128 startTimestamp, uint128 endTimestamp, address listingCreator, address assetContract, address currency, uint8 tokenType, uint8 status, bool reserved)[] _allListings)",
        params: [0n, BigInt(total - 1)],
      }) as any[];
      console.log(`allListingsData:`, allListingsData);
      console.log(`✅ 從 getAllListings 獲取到 ${allListingsData.length} 個 listing`);
      
      const listings: Array<{
        listingId: number;
        tokenId: number;
        price: string; // MNT 格式（已轉換）
        priceWei?: string; // 原始 wei 格式（用於鏈上交易）
        currency: string;
        seller: string;
        assetContract: string;
        status: number;
      }> = [];
      
      const nftContractAddress = this.nftContractAddress.toLowerCase();
      
      // 處理每個 listing
      for (let i = 0; i < allListingsData.length; i++) {
        try {
          const listing = allListingsData[i];
          
          // 調試：打印實際的數據結構
          if (i === 0) {
            console.log('🔍 第一個 listing 的原始數據結構:', listing);
            console.log('🔍 第一個 listing 的鍵:', Object.keys(listing || {}));
            console.log('🔍 第一個 listing 是否為數組:', Array.isArray(listing));
          }
          
          // getAllListings 返回的結構化對象：
          // {
          //   listingId: bigint,
          //   tokenId: bigint,
          //   quantity: bigint,
          //   pricePerToken: bigint,
          //   startTimestamp: bigint,
          //   endTimestamp: bigint,
          //   listingCreator: address,
          //   assetContract: address,
          //   currency: address,
          //   tokenType: number,
          //   status: number,
          //   reserved: boolean
          // }
          
          // 檢查是否為命名對象或數組
          let listingId: number;
          let tokenId: number;
          let pricePerToken: bigint;
          let assetContract: string;
          let currency: string;
          let listingCreator: string;
          let status: number;
          
          if (listing && typeof listing === 'object') {
            // 嘗試多種方式解析 listingId
            // 方式 1: 如果是命名對象（thirdweb 返回的格式）
            if ('listingId' in listing) {
              // thirdweb 返回的可能是 BigInt、字串或數字，需要統一處理
              // 注意：thirdweb SDK 會將 uint256 自動轉換為 BigInt，這是正常的
              const rawListingId = listing.listingId;
              if (typeof rawListingId === 'bigint') {
                listingId = Number(rawListingId);
                if (i === 0) console.log(`🔍 listingId 轉換: ${rawListingId} (BigInt) → ${listingId} (Number)`);
              } else if (typeof rawListingId === 'string') {
                listingId = parseInt(rawListingId, 10);
                if (i === 0) console.log(`🔍 listingId 轉換: "${rawListingId}" (String) → ${listingId} (Number)`);
              } else {
                listingId = Number(rawListingId);
                if (i === 0) console.log(`🔍 listingId 轉換: ${rawListingId} (Other) → ${listingId} (Number)`);
              }
              
              const rawTokenId = listing.tokenId;
              if (typeof rawTokenId === 'bigint') {
                tokenId = Number(rawTokenId);
              } else if (typeof rawTokenId === 'string') {
                tokenId = parseInt(rawTokenId, 10);
              } else {
                tokenId = Number(rawTokenId);
              }
              
              // pricePerToken 處理
              const rawPrice = listing.pricePerToken;
              if (typeof rawPrice === 'bigint') {
                pricePerToken = rawPrice;
              } else if (typeof rawPrice === 'string') {
                pricePerToken = BigInt(rawPrice);
              } else {
                pricePerToken = rawPrice || 0n;
              }
              
              assetContract = String(listing.assetContract || '').toLowerCase();
              currency = String(listing.currency || this.NATIVE_CURRENCY_ADDRESS).toLowerCase();
              listingCreator = String(listing.listingCreator || '').toLowerCase();
              status = Number(listing.status !== undefined ? listing.status : 1);
            }
            // 方式 2: 如果是元組/數組格式
            else if (Array.isArray(listing) || listing[0] !== undefined) {
              // getAllListings 返回的元組順序：
              // [listingId, tokenId, quantity, pricePerToken, startTimestamp, endTimestamp, listingCreator, assetContract, currency, tokenType, status, reserved]
              const id0 = listing[0] || listing.listingId || 0;
              const id1 = listing[1] || listing.tokenId || 0;
              
              // 處理 BigInt、字串或數字
              listingId = typeof id0 === 'bigint' ? Number(id0) : (typeof id0 === 'string' ? parseInt(id0, 10) : Number(id0));
              tokenId = typeof id1 === 'bigint' ? Number(id1) : (typeof id1 === 'string' ? parseInt(id1, 10) : Number(id1));
              
              const price = listing[3] || listing.pricePerToken || 0n;
              pricePerToken = typeof price === 'bigint' ? price : (typeof price === 'string' ? BigInt(price) : (price || 0n));
              
              assetContract = String(listing[7] || listing.assetContract || '').toLowerCase();
              currency = String(listing[8] || listing.currency || this.NATIVE_CURRENCY_ADDRESS).toLowerCase();
              listingCreator = String(listing[6] || listing.listingCreator || '').toLowerCase();
              status = Number(listing[10] !== undefined ? listing[10] : (listing.status !== undefined ? listing.status : 1));
            }
            // 方式 3: 檢查是否為 bigint 或其他格式
            else {
              // 嘗試直接訪問可能的屬性
              const possibleListingId = listing.listingId || listing['0'] || listing[0];
              if (possibleListingId !== undefined && possibleListingId !== null) {
                listingId = typeof possibleListingId === 'bigint' 
                  ? Number(possibleListingId)
                  : (typeof possibleListingId === 'string' ? parseInt(possibleListingId, 10) : Number(possibleListingId));
                
                const possibleTokenId = listing.tokenId || listing['1'] || listing[1];
                tokenId = typeof possibleTokenId === 'bigint'
                  ? Number(possibleTokenId)
                  : (typeof possibleTokenId === 'string' ? parseInt(possibleTokenId, 10) : (possibleTokenId ? Number(possibleTokenId) : 0));
                
                const possiblePrice = listing.pricePerToken || listing['3'] || listing[3] || 0n;
                pricePerToken = typeof possiblePrice === 'bigint' 
                  ? possiblePrice 
                  : (typeof possiblePrice === 'string' ? BigInt(possiblePrice) : (possiblePrice || 0n));
                
                assetContract = String(listing.assetContract || listing['7'] || listing[7] || '').toLowerCase();
                currency = String(listing.currency || listing['8'] || listing[8] || this.NATIVE_CURRENCY_ADDRESS).toLowerCase();
                listingCreator = String(listing.listingCreator || listing['6'] || listing[6] || '').toLowerCase();
                status = Number(listing.status || listing['10'] || listing[10] || 1);
              } else {
                console.warn(`⚠️ Listing ${i} 無法解析 listingId，原始數據:`, listing);
                continue;
              }
            }
          } else {
            console.warn(`⚠️ Listing ${i} 不是對象，跳過:`, listing);
            continue;
          }
          
          // 驗證 listingId 是否有效（注意：listingId 可以是 0，所以只檢查 NaN）
          if (isNaN(listingId)) {
            console.warn(`⚠️ Listing ${i} 的 listingId 無效 (NaN)，原始數據:`, listing);
            continue;
          }
          
          // 只處理屬於我們 NFT 合約的 listing
          if (assetContract !== nftContractAddress) {
            console.log(`⚠️ Listing ${i} 不是我們的 NFT 合約 (${assetContract} vs ${nftContractAddress})，跳過`);
            continue;
          }
          
          // 過濾掉已取消的 listing（status = 3）和已購買的 listing（status = 2）
          // status 1 = Active (可購買)
          // status 2 = Sold (已購買)
          // status 3 = Cancelled (已取消)
          if (status === 2 || status === 3) {
            console.log(`⚠️ Listing ${i} 已購買/已取消 (status = ${status})，跳過`);
            continue;
          }
          
          // 驗證必要字段（注意：listingId 可以是 0）
          if (isNaN(listingId) || isNaN(tokenId) || !assetContract) {
            console.warn(`⚠️ Listing ${i} 缺少必要字段:`, { listingId, tokenId, assetContract });
            continue;
          }
          
          // 調試：確認轉換後的數據
          if (i === 0) {
            console.log(`✅ Listing ${i} 解析結果:`, { listingId, tokenId, assetContract, pricePerToken: pricePerToken.toString() });
          }
          
          // 轉換價格為字符串（wei 格式，用於鏈上交易）
          const priceWei = typeof pricePerToken === 'bigint' 
            ? pricePerToken.toString() 
            : String(pricePerToken || '0');
          
          // 轉換為 MNT（除以 1e18）
          const priceMnt = Number(BigInt(priceWei)) / 1e18;
          const priceStr = priceMnt.toString();
          
          // 處理 currency：如果為空、零地址或舊的 MNT 地址，統一轉換為標準原生代幣地址
          const nativeCurrencyLower = this.NATIVE_CURRENCY_ADDRESS.toLowerCase();
          const oldMntAddressLower = '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000';
          const zeroAddressLower = '0x0000000000000000000000000000000000000000';
          
          if (!currency || 
              currency === '0x0' || 
              currency === zeroAddressLower ||
              currency === oldMntAddressLower) {
            currency = nativeCurrencyLower;
          }
          
          listings.push({
            listingId,
            tokenId,
            price: priceStr, // 現在是 MNT 格式的字符串
            priceWei: priceWei, // 保留原始 wei 格式，用於鏈上交易
            currency: currency.toLowerCase(),
            seller: listingCreator,
            assetContract: assetContract.toLowerCase(),
            status: status,
          });
          
          console.log(`✅ 找到 listing ${i}: Listing ID=${listingId}, Token ID=${tokenId}, Price=${priceStr}, Seller=${listingCreator}`);
        } catch (e) {
          console.warn(`處理 listing ${i} 失敗:`, e);
          continue;
        }
      }
      
      console.log(`總共找到 ${listings.length} 個 listing`);
      return listings;
    } catch (error: any) {
      console.error('從鏈上獲取所有 listing 失敗:', error);
      return [];
    }
  }

  /**
   * 獲取角色的上架信息（優先從鏈上查詢）
   */
  async getCharacterListingFromChain(tokenId: number): Promise<{
    listingId: number | null;
    price: string;
    currency: string;
    seller: string;
    status: number;
  } | null> {
    return await this.getListingByTokenId(tokenId);
  }

  /**
   * 獲取角色價格歷史
   */
  getPriceHistory(characterId: string): Observable<{
    success: boolean;
    data: Array<{
      price: string;
      timestamp: string;
      tx_hash?: string;
    }>;
  }> {
    return this.http.get<any>(`${this.apiUrl}/marketplace/characters/${characterId}/price-history/`);
  }

  /**
   * 通知後端上架已取消
   */
  notifyListingCancelled(listingId: string, txHash: string): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post(
      `${this.apiUrl}/marketplace/listings/${listingId}/cancel/`,
      { tx_hash: txHash },
      { headers }
    );
  }

  /**
   * 從鏈上掃描用戶持有的所有 NFT token，並同步到後端
   * @param walletAddress 錢包地址（可選，如果不提供則使用當前連接的錢包）
   */
  async syncOwnedNFTsFromChain(walletAddress?: string): Promise<{
    success: boolean;
    syncedTokens: number[];
    message: string;
  }> {
    try {
      const account = walletAddress || (await this.getAccount()).address;
      const walletAddr = String(account).toLowerCase();

      console.log(`🔍 開始掃描錢包 ${walletAddr} 持有的 NFT...`);

      // 方法 1: 嘗試使用 ERC721Enumerable（如果合約支持）
      let ownedTokenIds = await this.getOwnedTokenIds(walletAddr);

      // 方法 2: 如果不支持 Enumerable，需要遍歷所有可能的 tokenId
      // 這需要知道總供應量，或者從後端獲取所有已鑄造的 tokenId 列表
      if (!ownedTokenIds || ownedTokenIds.length === 0) {
        console.warn('⚠️ 合約可能不支持 ERC721Enumerable，使用備用方法...');
        // 備用方案：從後端獲取所有已鑄造的 tokenId，然後逐一檢查 ownerOf
        // 這裡暫時返回空數組，由調用者處理
        ownedTokenIds = [];
      }

      console.log(`✅ 找到 ${ownedTokenIds.length} 個持有的 NFT:`, ownedTokenIds);

      // 通知後端同步這些 token
      const headers = this.getAuthHeaders();
      const response = await this.http.post<{
        success: boolean;
        synced_tokens: number[];
        message: string;
      }>(
        `${this.apiUrl}/characters/sync-owned-nfts/`,
        { 
          wallet_address: walletAddr,
          token_ids: ownedTokenIds 
        },
        { headers }
      ).toPromise();

      if (response?.success) {
        console.log(`✅ 同步成功: ${response.message}`);
        return {
          success: true,
          syncedTokens: response.synced_tokens || ownedTokenIds,
          message: response.message
        };
      } else {
        throw new Error(response?.message || '同步失敗');
      }
    } catch (error: any) {
      console.error('❌ 同步 NFT 失敗:', error);
      throw new Error(error.message || '同步失敗');
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}

