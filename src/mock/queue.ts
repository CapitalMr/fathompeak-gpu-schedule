import type { Workload } from '../types'
import { preferredSkusForModel, GPU_SPECS } from '../components/monitor/gpuSpecs'

export interface QueuedWorkload extends Workload {
  queuePriority: number
  waitReason: string
}

/**
 * 排队样本：原因与策略语义对齐。
 * - P1 TP/PP：指定 SKU / Gang 成组 / 保底配额预留
 * - 绿电任务：等关联电站出力窗口
 * - P4：可被抢占通道填充
 */
export const QUEUE: QueuedWorkload[] = [
  queued('q-qwen72', 'inf-qwen72b-wait', 'Qwen2.5-72B', 'tp', 8, 'proj-llm', 'LLM 预训练平台', 1, '等待 H100/H200 同型号整机空闲（华北保底预留）'),
  queued('q-llama70', 'inf-llama70b-wait', 'Llama-3.1-70B-Instruct', 'tp', 8, 'proj-llm', 'LLM 预训练平台', 1, '等待 NVLink 域完整的 8 卡机箱'),
  queued('q-ds-r1', 'inf-deepseek-r1-queue', 'DeepSeek-R1', 'pp', 16, 'proj-llm', 'LLM 预训练平台', 1, '等待同厂商同互联域 Gang 成组资源（2×8）'),
  queued('q-internvl', 'inf-internvl-batch', 'InternVL2-40B', 'tp', 8, 'proj-mm', '多模态视觉训练', 2, '等待昇腾/思元同型号整机空闲'),
  queued('q-bge', 'inf-bge-rerank-queue', 'BGE-M3-Rerank', 'tp', 2, 'proj-embed', 'Embedding 检索', 2, '等待保底配额碎片装箱'),
  queued('q-ds-sft', 'train-deepseek-sft-queue', 'DeepSeek-V3-SFT', 'pp', 32, 'proj-llm', 'LLM 预训练平台', 1, '等待同互联域 Gang 成组（4×8）与训练配额窗口'),
  queued('q-lora', 'train-lora-exp-07', 'Qwen2.5-14B-LoRA', 'tp', 4, 'proj-rd', '算法预研专项', 4, '低优可抢占 · 等待闲时或绿电低谷填充'),
  queued('q-green', 'job-green-shift-batch', 'Qwen2.5-7B', 'single', 1, 'proj-energy', '算电协同调度', 3, '等待关联电站出力 ≥75% 的绿电窗口'),
]

/** 写入 AppState.workloads 的排队种子（去掉队列视图扩展字段） */
export function seedQueuedWorkloads(): Workload[] {
  return QUEUE.map(({ queuePriority: _priority, waitReason: _reason, ...workload }) => workload)
}

function memPerGpuForModel(model: string) {
  const kind = preferredSkusForModel(model)[0] ?? 'h100'
  return GPU_SPECS[kind].memoryGb
}

function modelImage(model: string) {
  const tag = model.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `registry.fathompeak.cn/serving/${tag}:1.2.0`
}

function queued(
  id: string,
  name: string,
  model: string,
  strategy: Workload['strategy'],
  gpuCount: number,
  projectId: string,
  projectName: string,
  priority: number,
  waitReason: string,
): QueuedWorkload {
  const memPerGpu = memPerGpuForModel(model)
  const preferredPool =
    projectId === 'proj-llm'
      ? 'cls-daxing'
      : projectId === 'proj-energy'
        ? 'cls-hami'
        : 'pending'
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
    image: modelImage(model),
    clusterName: preferredPool,
    architecture: gpuCount > 1 || strategy !== 'single' ? 'Distributed' : 'Standard',
    gpuCount,
    memoryGb: gpuCount * memPerGpu,
    podsRequested: strategy === 'single' ? Math.max(1, gpuCount) : Math.max(1, Math.ceil(gpuCount / 8)),
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
