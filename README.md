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

1. 登录鉴权与访问控制（用户 / 服务账号 / 角色 / 访问规则）
2. 工作负载与调度队列（优先级通道、阻塞原因可视化）
3. 全局算力调度监控（全国拓扑 / 集群监测 / 任务调度）
4. 资源管理（集群 / 节点池 / 节点）与算电协同
5. 部门与项目配额、用量计量（GPU·h / 绿电折算成本）
6. 调度策略、告警治理与系统审计
7. 资产库（模板 / 环境 / 计算规格 / 数据源 / 凭证）

数据覆盖全国 7 大集群与 7 个节点池 / 150 台服务器 / 约 1200 GPU，并联动 7 座绿电站出力数据。
