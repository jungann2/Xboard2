<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Models\Server;
use App\Services\LocalMonitorService;
use App\Services\MonitorHistoryService;
use App\Utils\CacheKey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class MonitorController extends Controller
{
    /**
     * 查询所有父节点的缓存监控数据
     * 附带节点基本信息、子节点计数和 online/offline/unknown 状态判定
     */
    public function nodes(Request $request): JsonResponse
    {
        $pushInterval = (int) admin_setting('server_push_interval', 60);
        $threshold = $pushInterval * 3;
        $now = time();

        $nodes = Server::whereNull('parent_id')->get()->map(function ($node) use ($threshold, $now) {
            $type = strtoupper($node->type);
            $nodeId = $node->id;

            $loadStatus = Cache::get(CacheKey::get("SERVER_{$type}_LOAD_STATUS", $nodeId));
            $lastLoadAt = Cache::get(CacheKey::get("SERVER_{$type}_LAST_LOAD_AT", $nodeId));
            $childCount = Server::where('parent_id', $node->id)->count();

            $status = 'unknown';
            if ($loadStatus !== null) {
                $status = ($lastLoadAt && ($now - $lastLoadAt) <= $threshold) ? 'online' : 'offline';
            }

            return [
                'id' => $node->id,
                'name' => $node->name,
                'type' => $node->type,
                'host' => $node->host,
                'status' => $status,
                'child_count' => $childCount,
                'last_load_at' => $lastLoadAt,
                'monitor' => $loadStatus,
            ];
        });

        return response()->json(['data' => $nodes]);
    }

    /**
     * 返回本机监控数据
     */
    public function local(Request $request): JsonResponse
    {
        $service = new LocalMonitorService();
        return response()->json(['data' => $service->collect()]);
    }

    /**
     * 返回指定节点最近 60 分钟的时序数据
     */
    public function nodeHistory(Request $request, $nodeId): JsonResponse
    {
        $nodeId = (int) $nodeId;
        if ($nodeId <= 0) {
            return response()->json(['message' => 'Invalid node ID'], 422);
        }

        $node = Server::find($nodeId);
        if (!$node) {
            return response()->json(['message' => 'Node not found'], 404);
        }

        $type = strtoupper($node->type);
        $historyService = new MonitorHistoryService();
        $key = CacheKey::get("SERVER_{$type}_MONITOR_HISTORY", $nodeId);
        $points = $historyService->getHistory($key, 60);

        return response()->json(['data' => ['points' => $points]]);
    }

    /**
     * 返回本机最近 60 分钟的时序数据
     */
    public function localHistory(Request $request): JsonResponse
    {
        $historyService = new MonitorHistoryService();
        $key = CacheKey::get('LOCAL_MONITOR_HISTORY');
        $points = $historyService->getHistory($key, 60);

        return response()->json(['data' => ['points' => $points]]);
    }

    /**
     * 监控概览统计（兼容前端已有 bt+"/monitor/api/stats" 调用）
     */
    public function stats(Request $request): JsonResponse
    {
        $pushInterval = (int) admin_setting('server_push_interval', 60);
        $threshold = $pushInterval * 3;
        $now = time();

        $parentNodes = Server::whereNull('parent_id')->get();
        $total = $parentNodes->count();
        $online = 0;
        $offline = 0;

        foreach ($parentNodes as $node) {
            $type = strtoupper($node->type);
            $loadStatus = Cache::get(CacheKey::get("SERVER_{$type}_LOAD_STATUS", $node->id));
            $lastLoadAt = Cache::get(CacheKey::get("SERVER_{$type}_LAST_LOAD_AT", $node->id));

            if ($loadStatus !== null) {
                if ($lastLoadAt && ($now - $lastLoadAt) <= $threshold) {
                    $online++;
                } else {
                    $offline++;
                }
            }
        }

        return response()->json([
            'data' => [
                'total' => $total,
                'online' => $online,
                'offline' => $offline,
                'unknown' => $total - $online - $offline,
            ]
        ]);
    }
}
