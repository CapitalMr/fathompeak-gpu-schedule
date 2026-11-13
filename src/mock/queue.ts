import type { Workload } from '../types'

export interface QueuedWorkload extends Workload {
  queuePriority: number
  waitReason: string
}

export const QUEUE: QueuedWorkload[] = [
  queued('q-qwen72', 'inf-qwen72b-wait', 'Qwen2.5-72B', 'tp', 4, 'proj-llm', '大语言模型研发部', 1),
  queued('q-bge', 'inf-bge-rerank-queue', 'BGE-M3-Rerank', 'single', 1, 'proj-agent', '智能体推理平台组', 2),
  queued('q-ds-sft', 'train-deepseek-sft-queue', 'DeepSeek-V3-SFT', 'pp', 16, 'proj-llm', '大语言模型研发部', 1),
  queued('q-internvl', 'inf-internvl-batch', 'InternVL2-40B', 'tp', 4, 'proj-mm', '多模态视觉组', 2),
  queued('q-lora', 'train-lora-exp-07', 'Qwen2.5-14B-LoRA', 'single', 2, 'proj-rd', '算法预研专项', 4),
  queued('q-green', 'job-green-shift-batch', 'Qwen2.5-7B', 'single', 8, 'proj-energy', '算电协同调度组', 3),
]

function queued(
  id: string,
  name: string,
  model: string,
  strategy: Workload['strategy'],
  gpuCount: number,
  projectId: string,
  projectName: string,
  priority: number,
): QueuedWorkload {
  const waitReason =
    strategy === 'pp'
      ? '等待跨机 Gang 成组资源'
      : strategy === 'tp'
        ? '等待 NVLink 亲和整机空闲'
        : gpuCount >= 8
          ? '等待绿电高峰窗口'
          : '等待保底配额或碎片装箱'

  return {
    id,
    name,
    model,
    type: name.startsWith('train') ? 'Training' : 'Inference',
    projectId,
    projectName,
    strategy,
    status: 'Pending',
    createdBy: 'scheduler',
    image: 'registry.fathompeak.cn/inference/queue:wait',
    clusterName: 'fp-ai-factory-01',
    architecture: gpuCount > 1 ? 'Distributed' : 'Standard',
    gpuCount,
    // 当前节点卡型统一按 80GB HBM 估算；请求显存按卡数×80
    memoryGb: gpuCount * 80,
    podsRequested: Math.max(1, Math.ceil(gpuCount / 8)),
    podsRunning: 0,
    latencyMs: 0,
    tokensPerSec: 0,
    startedAt: Date.now() - (90 + priority * 40) * 1000,
    durationSec: 90 + priority * 40,
    allocations: [],
    pods: [],
    events: [
      {
        ts: Date.now() - 60_000,
        phase: 'Pending',
        message: waitReason,
      },
    ],
    queuePriority: priority,
    waitReason,
  }
}
