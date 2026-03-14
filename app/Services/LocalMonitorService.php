<?php

namespace App\Services;

use App\Utils\CacheKey;
use Illuminate\Support\Facades\Cache;

class LocalMonitorService
{
    /**
     * 采集本机系统指标（缓存 10 秒）
     */
    public function collect(): array
    {
        return Cache::remember(CacheKey::get('LOCAL_MONITOR_STATUS'), 10, fn() => $this->doCollect());
    }

    /**
     * 实际采集所有本机系统指标
     */
    private function doCollect(): array
    {
        return [
            'cpu' => $this->getCpu(),
            'mem' => $this->getMemory(),
            'swap' => $this->getSwap(),
            'disk' => $this->getDisk(),
            'network' => $this->getNetwork(),
            'disk_io' => $this->getDiskIO(),
            'hostname' => $this->getHostname(),
            'uptime' => $this->getUptime(),
            'cpu_model' => $this->getCpuModel(),
            'ipv4' => $this->getIpv4(),
            'updated_at' => time(),
        ];
    }

    /**
     * CPU 使用率百分比（0-100）
     * 使用 sys_getloadavg() 1 分钟负载 / CPU 核心数
     */
    private function getCpu(): ?float
    {
        try {
            $load = sys_getloadavg();
            if ($load === false) {
                return null;
            }
            $cores = $this->getCpuCores();
            if ($cores <= 0) {
                return null;
            }
            $percent = ($load[0] / $cores) * 100;
            return round(max(0, min(100, $percent)), 2);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * 获取 CPU 核心数
     */
    private function getCpuCores(): int
    {
        try {
            // 尝试 nproc 命令
            $nproc = @shell_exec('nproc 2>/dev/null');
            if ($nproc !== null && ($cores = (int) trim($nproc)) > 0) {
                return $cores;
            }
            // 回退到解析 /proc/cpuinfo
            $cpuinfo = @file_get_contents('/proc/cpuinfo');
            if ($cpuinfo !== false) {
                return max(1, substr_count($cpuinfo, 'processor'));
            }
            return 1;
        } catch (\Throwable $e) {
            return 1;
        }
    }

    /**
     * 内存信息（total/used 字节数）
     * 解析 /proc/meminfo
     */
    private function getMemory(): ?array
    {
        try {
            $info = $this->parseMeminfo();
            if ($info === null) {
                return null;
            }
            $total = ($info['MemTotal'] ?? 0) * 1024;
            $available = ($info['MemAvailable'] ?? null);
            if ($available !== null) {
                $used = ($info['MemTotal'] - $available) * 1024;
            } else {
                $free = ($info['MemFree'] ?? 0) + ($info['Buffers'] ?? 0) + ($info['Cached'] ?? 0);
                $used = ($info['MemTotal'] - $free) * 1024;
            }
            return ['total' => (int) $total, 'used' => (int) max(0, $used)];
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Swap 信息（total/used 字节数）
     */
    private function getSwap(): ?array
    {
        try {
            $info = $this->parseMeminfo();
            if ($info === null) {
                return null;
            }
            $total = ($info['SwapTotal'] ?? 0) * 1024;
            $free = ($info['SwapFree'] ?? 0) * 1024;
            return ['total' => (int) $total, 'used' => (int) max(0, $total - $free)];
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * 解析 /proc/meminfo，返回 kB 为单位的关联数组
     */
    private function parseMeminfo(): ?array
    {
        $content = @file_get_contents('/proc/meminfo');
        if ($content === false) {
            return null;
        }
        $result = [];
        foreach (explode("\n", $content) as $line) {
            if (preg_match('/^(\w+):\s+(\d+)/', $line, $matches)) {
                $result[$matches[1]] = (int) $matches[2];
            }
        }
        return $result;
    }

    /**
     * 磁盘信息（total/used 字节数）
     */
    private function getDisk(): ?array
    {
        try {
            $total = @disk_total_space('/');
            $free = @disk_free_space('/');
            if ($total === false || $free === false) {
                return null;
            }
            return ['total' => (int) $total, 'used' => (int) ($total - $free)];
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * 网络累计发送/接收字节数
     * 解析 /proc/net/dev，排除虚拟接口（lo, docker*, veth*, br-*）
     */
    private function getNetwork(): ?array
    {
        try {
            $content = @file_get_contents('/proc/net/dev');
            if ($content === false) {
                return null;
            }
            $sent = 0;
            $recv = 0;
            foreach (explode("\n", $content) as $line) {
                $line = trim($line);
                if (!str_contains($line, ':')) {
                    continue;
                }
                [$iface, $data] = explode(':', $line, 2);
                $iface = trim($iface);
                // 排除虚拟接口
                if ($this->isVirtualInterface($iface)) {
                    continue;
                }
                $parts = preg_split('/\s+/', trim($data));
                if (count($parts) >= 10) {
                    $recv += (int) $parts[0];
                    $sent += (int) $parts[8];
                }
            }
            return ['sent' => $sent, 'recv' => $recv];
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * 判断是否为虚拟网络接口
     */
    private function isVirtualInterface(string $iface): bool
    {
        if ($iface === 'lo') {
            return true;
        }
        $virtualPrefixes = ['docker', 'veth', 'br-'];
        foreach ($virtualPrefixes as $prefix) {
            if (str_starts_with($iface, $prefix)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 磁盘 IO 累计读/写字节数
     * 解析 /proc/diskstats，仅统计物理磁盘（sda, vda, nvme, xvd）
     */
    private function getDiskIO(): ?array
    {
        try {
            $content = @file_get_contents('/proc/diskstats');
            if ($content === false) {
                return null;
            }
            $read = 0;
            $write = 0;
            foreach (explode("\n", $content) as $line) {
                $parts = preg_split('/\s+/', trim($line));
                if (count($parts) < 14) {
                    continue;
                }
                $device = $parts[2];
                if (!$this->isPhysicalDisk($device)) {
                    continue;
                }
                // 字段 5 = 读扇区数, 字段 9 = 写扇区数（0-indexed: parts[5], parts[9]）
                $read += (int) $parts[5] * 512;
                $write += (int) $parts[9] * 512;
            }
            return ['read' => $read, 'write' => $write];
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * 判断是否为物理磁盘（sda, vda, nvme*, xvd*）
     */
    private function isPhysicalDisk(string $device): bool
    {
        return (bool) preg_match('/^(sd[a-z]+|vd[a-z]+|nvme\d+n\d+|xvd[a-z]+)$/', $device);
    }

    /**
     * 主机名
     */
    private function getHostname(): ?string
    {
        try {
            $hostname = gethostname();
            return $hostname !== false ? $hostname : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * 系统运行时间（秒数整数）
     * 解析 /proc/uptime
     */
    private function getUptime(): ?int
    {
        try {
            $content = @file_get_contents('/proc/uptime');
            if ($content === false) {
                return null;
            }
            $parts = explode(' ', trim($content));
            return (int) floor((float) $parts[0]);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * CPU 型号
     * 解析 /proc/cpuinfo 的第一个 model name 行
     */
    private function getCpuModel(): ?string
    {
        try {
            $content = @file_get_contents('/proc/cpuinfo');
            if ($content === false) {
                return null;
            }
            if (preg_match('/^model name\s*:\s*(.+)$/m', $content, $matches)) {
                return trim($matches[1]);
            }
            return null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * IPv4 地址
     */
    private function getIpv4(): ?string
    {
        try {
            $hostname = gethostname();
            if ($hostname === false) {
                return null;
            }
            $ip = gethostbyname($hostname);
            // gethostbyname 失败时返回原始 hostname
            return ($ip !== $hostname) ? $ip : null;
        } catch (\Throwable $e) {
            return null;
        }
    }
}
