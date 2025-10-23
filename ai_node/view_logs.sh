#!/bin/bash

# AI Node 日誌查看腳本

echo "=== AI Node 日誌查看工具 ==="
echo ""

# 創建日誌目錄
mkdir -p logs

# 檢查參數
if [ "$1" = "live" ] || [ "$1" = "tail" ] || [ -z "$1" ]; then
    echo "📋 實時查看 AI Node 日誌："
    echo "----------------------------------------"
    
    # 查找所有日誌文件
    log_files=(logs/*_$(date +%Y%m%d).log)
    
    if [ ${#log_files[@]} -eq 0 ] || [ ! -f "${log_files[0]}" ]; then
        echo "❌ 沒有找到今天的日誌文件"
        echo "可用的日誌文件："
        ls -la logs/ 2>/dev/null || echo "無日誌文件"
        echo ""
        echo "如果節點剛啟動，請稍等片刻讓日誌文件生成"
    else
        echo "📁 找到 ${#log_files[@]} 個日誌文件："
        for file in "${log_files[@]}"; do
            echo "  - $file"
        done
        echo "----------------------------------------"
        tail -f "${log_files[@]}"
    fi
elif [ "$1" = "list" ]; then
    echo "📋 列出所有日誌文件："
    echo "----------------------------------------"
    
    if [ -d "logs" ] && [ "$(ls -A logs 2>/dev/null)" ]; then
        echo "📁 日誌目錄內容："
        ls -lah logs/
        echo ""
        echo "📊 文件統計："
        echo "  總文件數: $(ls logs/ | wc -l)"
        echo "  總大小: $(du -sh logs/ | cut -f1)"
    else
        echo "❌ 日誌目錄為空或不存在"
    fi
elif [ "$1" = "stats" ]; then
    echo "📊 日誌統計信息："
    echo "----------------------------------------"
    
    # 查找所有日誌文件
    log_files=(logs/*.log)
    
    if [ ${#log_files[@]} -eq 0 ] || [ ! -f "${log_files[0]}" ]; then
        echo "❌ 沒有找到日誌文件"
    else
        for log_file in "${log_files[@]}"; do
            if [ -f "$log_file" ]; then
                node_name=$(basename "$log_file" .log)
                echo "🤖 節點: $node_name"
                echo "  📁 文件: $log_file"
                echo "  📏 大小: $(du -h "$log_file" | cut -f1)"
                echo "  📝 行數: $(wc -l < "$log_file")"
                echo "  ⚔️  戰鬥請求: $(grep -c "開始生成戰鬥" "$log_file" 2>/dev/null || echo 0)"
                echo "  ✅ 成功完成: $(grep -c "戰鬥生成完成" "$log_file" 2>/dev/null || echo 0)"
                echo "  ❌ 錯誤數量: $(grep -c "ERROR" "$log_file" 2>/dev/null || echo 0)"
                echo "  💓 心跳次數: $(grep -c "Heartbeat sent" "$log_file" 2>/dev/null || echo 0)"
                echo "  🔗 註冊成功: $(grep -c "節點註冊成功" "$log_file" 2>/dev/null || echo 0)"
                echo ""
            fi
        done
    fi
elif [ "$1" = "search" ]; then
    if [ -z "$2" ]; then
        echo "❌ 請提供搜索關鍵字"
        echo "用法: $0 search <關鍵字>"
        exit 1
    fi
    
    echo "🔍 搜索關鍵字: '$2'"
    echo "----------------------------------------"
    
    # 查找所有日誌文件
    log_files=(logs/*.log)
    
    if [ ${#log_files[@]} -eq 0 ] || [ ! -f "${log_files[0]}" ]; then
        echo "❌ 沒有找到日誌文件"
    else
        for log_file in "${log_files[@]}"; do
            if [ -f "$log_file" ]; then
                node_name=$(basename "$log_file" .log)
                echo "📋 節點 $node_name:"
                grep -n --color=always "$2" "$log_file" | head -20
                echo ""
            fi
        done
    fi
else
    echo "用法："
    echo "  $0              - 實時查看所有節點日誌 (預設)"
    echo "  $0 live|tail    - 實時查看所有節點日誌"
    echo "  $0 list         - 列出所有日誌文件"
    echo "  $0 stats        - 顯示日誌統計信息"
    echo "  $0 search <關鍵字> - 搜索日誌內容"
    echo ""
    echo "範例："
    echo "  $0              # 實時查看日誌"
    echo "  $0 list         # 列出日誌文件"
    echo "  $0 stats        # 查看統計"
    echo "  $0 search 戰鬥   # 搜索戰鬥相關日誌"
    echo ""
    echo "💡 提示："
    echo "  - 日誌文件位於 ./logs/ 目錄"
    echo "  - 每個節點會根據 NODE_NAME 創建獨立的日誌文件"
    echo "  - 支持多個節點實例同時運行"
fi
