<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

class MonitorHistoryService
{
    /**
     * 获取 Redis 键前缀
     */
    private function getPrefix(): string
    {
        return config('database.redis.options.prefix') ?? '';
    }

    /**
     * 追加时序数据点到 Redis Sorted Set
     * 使用 ZADD，score = 当前时间戳
     *
     * @param string $key  逻辑键名（如 SERVER_VMESS_MONITOR_HISTORY_1）
     * @param array  $data 数据点内容
     */
    public function appendPoint(string $key, array $data): void
    {
        try {
            $timestamp = time();
            $data['timestamp'] = $timestamp;
            $prefixedKey = $this->getPrefix() . $key;
            Redis::connection()->zadd($prefixedKey, $timestamp, json_encode($data));
        } catch (\Throwable $e) {
            Log::warning('[MonitorHistoryService] appendPoint failed: ' . $e->getMessage());
        }
    }

    /**
     * 获取指定时间范围内的时序数据
     * 使用 ZRANGEBYSCORE 查询最近 $minutes 分钟的数据
     *
     * @param string $key     逻辑键名
     * @param int    $minutes 查询最近多少分钟的数据，默认 60
     * @return array 解码后的数据点数组
     */
    public function getHistory(string $key, int $minutes = 60): array
    {
        try {
            $now = time();
            $from = $now - ($minutes * 60);
            $prefixedKey = $this->getPrefix() . $key;
            $results = Redis::connection()->zrangebyscore($prefixedKey, $from, $now);
            if (!is_array($results)) {
                return [];
            }
            return array_map(fn($item) => json_decode($item, true), $results);
        } catch (\Throwable $e) {
            Log::warning('[MonitorHistoryService] getHistory failed: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * 清理过期时序数据
     * 使用 ZREMRANGEBYSCORE 移除超过 $minutes 分钟的数据点
     *
     * @param string $key     逻辑键名
     * @param int    $minutes 保留最近多少分钟的数据，默认 60
     */
    public function cleanup(string $key, int $minutes = 60): void
    {
        try {
            $cutoff = time() - ($minutes * 60);
            $prefixedKey = $this->getPrefix() . $key;
            Redis::connection()->zremrangebyscore($prefixedKey, '-inf', $cutoff);
        } catch (\Throwable $e) {
            Log::warning('[MonitorHistoryService] cleanup failed: ' . $e->getMessage());
        }
    }
}
