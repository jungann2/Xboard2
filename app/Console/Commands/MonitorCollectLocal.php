<?php

namespace App\Console\Commands;

use App\Services\LocalMonitorService;
use App\Services\MonitorHistoryService;
use App\Utils\CacheKey;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class MonitorCollectLocal extends Command
{
    protected $signature = 'monitor:collect-local';
    protected $description = '采集本机监控数据并追加到时序缓存';

    public function handle(): int
    {
        $localService = new LocalMonitorService();
        $historyService = new MonitorHistoryService();
        $historyKey = CacheKey::get('LOCAL_MONITOR_HISTORY');

        // 第一次采集（第 0 秒）
        try {
            $data = $localService->collect();
            $historyPoint = $this->buildHistoryPoint($data);
            $historyService->appendPoint($historyKey, $historyPoint);
            $historyService->cleanup($historyKey, 60);
        } catch (\Throwable $e) {
            Log::error('[monitor:collect-local] First collection failed: ' . $e->getMessage());
        }

        // 等待 30 秒
        sleep(30);

        // 第二次采集（第 30 秒）
        try {
            // 清除缓存以获取新数据
            \Illuminate\Support\Facades\Cache::forget(CacheKey::get('LOCAL_MONITOR_STATUS'));
            $data = $localService->collect();
            $historyPoint = $this->buildHistoryPoint($data);
            $historyService->appendPoint($historyKey, $historyPoint);
            $historyService->cleanup($historyKey, 60);
        } catch (\Throwable $e) {
            Log::error('[monitor:collect-local] Second collection failed: ' . $e->getMessage());
        }

        return Command::SUCCESS;
    }

    private function buildHistoryPoint(array $data): array
    {
        $point = [
            'cpu' => $data['cpu'] ?? null,
            'mem_used' => $data['mem']['used'] ?? null,
        ];
        if (isset($data['network'])) {
            $point['network_sent'] = $data['network']['sent'];
            $point['network_recv'] = $data['network']['recv'];
        }
        if (isset($data['disk_io'])) {
            $point['disk_io_read'] = $data['disk_io']['read'];
            $point['disk_io_write'] = $data['disk_io']['write'];
        }
        return $point;
    }
}
