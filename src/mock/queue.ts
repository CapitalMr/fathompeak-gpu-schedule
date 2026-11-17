import type { Workload } from '../types'
import { preferredSkusForModel, GPU_SPECS } from '../components/monitor/gpuSpecs'

export interface QueuedWorkload extends Workload {
  queuePriority: number
  waitReason: string
}

export const QUEUE: QueuedWorkload[] = [
  queued('q-qwen72', 'inf-qwen72b-wait', 'Qwen2.5-72B', 'tp', 8, 'proj-llm', '大语言模型研发部', 1),
  queued('q-llama70', 'inf-llama70b-wait', 'Llama-3.1-70B-Instruct', 'tp', 8, 'proj-llm', '大语言模型研发部', 1),
  queued('q-ds-r1', 'inf-deepseek-r1-queue', 'DeepSeek-R1', 'pp', 16, 'proj-llm', '大语言模型研发部', 1),
  queued('q-internvl', 'inf-internvl-batch', 'InternVL2-40B', 'tp', 8, 'proj-mm', '多模态视觉组', 2),
  queued('q-bge', 'inf-bge-rerank-queue', 'BGE-M3-Rerank', 'tp', 2, 'proj-agent', '智能体推理平台组', 2),
  queued('q-ds-sft', 'train-deepseek-sft-queue', 'DeepSeek-V3-SFT', 'pp', 32, 'proj-llm', '大语言模型研发部', 1),
  queued('q-lora', 'train-lora-exp-07', 'Qwen2.5-14B-LoRA', 'tp', 4, 'proj-rd', '算法预研专项', 4),
  queued('q-green', 'job-green-shift-batch', 'Qwen2.5-7B', 'tp', 2, 'proj-energy', '算电协同调度组', 3),
]

function memPerGpuForModel(model: string) {
  const kind = preferredSkusForModel(model)[0] ?? 'h100'
  return GPU_SPECS[kind].memoryGb
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
): QueuedWorkload {
  const waitReason =
    strategy === 'pp'
      ? '等待同厂商同互联域 Gang 成组资源'
      : strategy === 'tp'
        ? '等待同型号卡间互联整机空闲'
        : gpuCount >= 8
          ? '等待绿电高峰窗口'
          : '等待保底配额或碎片装箱'

  const memPerGpu = memPerGpuForModel(model)
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
