# 沐仞科技算力编排系统

FathomPeak Compute Orchestration — 私有化智算中心算力调度与算电协同平台。

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Lucide Icons
- HTML5 Canvas / SVG 拓扑可视化

## 启动

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址。默认账号已预填：`wangxiaoliang@fathompeak.cn`，点击「登录」后进入系统。

## 模块

1. 登录鉴权
2. 全局算力调度监控（全国拓扑 / 集群监测 / 任务调度）
3. 工作负载与推理任务中心
4. 节点池与一体机管理
5. 部门与项目配额管理
6. 调度策略与系统审计

数据覆盖 3 个节点池 / 150 台 8 卡服务器 / 1200 GPU，并联动 7 座绿电站出力数据。
