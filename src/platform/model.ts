export type PlatformScope = {
  clusterId: string
  departmentId: string
  projectId: string
}

export type PlatformSettings = {
  gpuProfiling: boolean
  limitProjectQuota: boolean
  cpuQuota: boolean
  overQuotaWeight: boolean
  gpuOptimization: boolean
  policies: boolean
  flexibleSubmission: boolean
  dataVolumes: boolean
  yamlSubmit: boolean
  inactivityMinutes: number
  logoutRedirect: string
  systemNotice: string
}

export type ProjectMeta = {
  weight: number
  cpuCores: number
}

export type K8sCluster = {
  id: string
  name: string
  region: string
  kubernetes: string
  status: 'Connected' | 'Connecting' | 'Degraded' | 'Offline'
  stationId: string
  endpoint?: string
  createdAt?: number
}

export type Department = {
  id: string
  name: string
  gpuQuota: number
}

export type WorkloadPolicy = {
  id: string
  name: string
  scope: string
  workloadType: string
  parameter: string
  defaultValue: string
  rule: string
  source: '系统' | '集群' | '部门' | '项目'
}

export type AssetKind = 'templates' | 'environments' | 'compute' | 'datasources' | 'credentials'

export type WorkloadTemplateType = 'Inference' | 'Training' | 'Workspace'

export type AssetRow = {
  id: string
  name: string
  kind: AssetKind
  scope: string
  /** 列表摘要：非模板为规格说明；模板为 resources / 调度摘要 */
  detail: string
  status: string
  /** Kubernetes 模板字段（仅 templates） */
  apiVersion?: string
  k8sKind?: string
  workloadType?: WorkloadTemplateType
  version?: string
  namespace?: string
  image?: string
  schedulerName?: string
  yaml?: string
  updatedAt?: number
}

export type AccessUser = {
  id: string
  name: string
  email: string
  type: '本地用户' | 'SSO'
  status: '启用' | '邀请中'
}

export type AccessRule = {
  id: string
  subject: string
  subjectType: '用户' | 'SSO 组' | '服务账号'
  role: string
  scope: string
}

export type ServiceAccount = {
  id: string
  name: string
  description: string
  scope: string
  role: string
  tokenHint: string
  lastUsedAt: number
  status: '启用' | '停用'
}

export const DEFAULT_SCOPE: PlatformScope = {
  clusterId: 'all',
  departmentId: 'all',
  projectId: 'all',
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  gpuProfiling: true,
  limitProjectQuota: true,
  cpuQuota: false,
  overQuotaWeight: true,
  gpuOptimization: false,
  policies: true,
  flexibleSubmission: true,
  dataVolumes: true,
  yamlSubmit: true,
  inactivityMinutes: 1440,
  logoutRedirect: '',
  systemNotice: '',
}

export const CLUSTERS: K8sCluster[] = [
  { id: 'cls-daxing', name: 'cls-daxing', region: '北京大兴', kubernetes: 'v1.29.6', status: 'Connected', stationId: 'st-bjdx' },
  { id: 'cls-tianjin', name: 'cls-tianjin', region: '天津滨海', kubernetes: 'v1.29.6', status: 'Connected', stationId: 'st-tj' },
  { id: 'cls-shenzhou', name: 'cls-shenzhou', region: '河北深州', kubernetes: 'v1.29.6', status: 'Connected', stationId: 'st-hbsz' },
  { id: 'cls-gaoyou', name: 'cls-gaoyou', region: '江苏高邮', kubernetes: 'v1.29.6', status: 'Connected', stationId: 'st-jsgp' },
  { id: 'cls-hami', name: 'cls-hami', region: '新疆哈密', kubernetes: 'v1.29.6', status: 'Connected', stationId: 'st-xj' },
  { id: 'cls-shantou', name: 'cls-shantou', region: '广东汕头', kubernetes: 'v1.29.6', status: 'Connected', stationId: 'st-gd' },
  { id: 'cls-ganzhou', name: 'cls-ganzhou', region: '江西赣州', kubernetes: 'v1.29.6', status: 'Connected', stationId: 'st-jx' },
]

/** 全国 7 大集群与节点池一一对应：节点归集群所有，并整池供出到同地区节点池。 */
export const POOL_SOURCES: Record<string, string[]> = {
  'pool-daxing': ['cls-daxing'],
  'pool-tianjin': ['cls-tianjin'],
  'pool-shenzhou': ['cls-shenzhou'],
  'pool-gaoyou': ['cls-gaoyou'],
  'pool-hami': ['cls-hami'],
  'pool-shantou': ['cls-shantou'],
  'pool-ganzhou': ['cls-ganzhou'],
}

export const DEPARTMENTS: Department[] = [
  { id: 'dept-foundation', name: '基础模型事业部', gpuQuota: 384 },
  { id: 'dept-perception', name: '感知智能事业部', gpuQuota: 192 },
  { id: 'dept-app', name: '应用智能事业部', gpuQuota: 160 },
  { id: 'dept-infra', name: '基础设施事业部', gpuQuota: 96 },
  { id: 'dept-lab', name: '研究院', gpuQuota: 80 },
]

export const WORKLOAD_POLICIES: WorkloadPolicy[] = [
  {
    id: 'wp-image',
    name: '镜像必须来自内部仓库',
    scope: '账户',
    workloadType: '全部',
    parameter: 'image',
    defaultValue: 'registry.fathompeak.cn/runtime',
    rule: '匹配 registry.fathompeak.cn/*',
    source: '系统',
  },
  {
    id: 'wp-gpu-cap',
    name: '训练 GPU 上限',
    scope: '部门 · 基础模型事业部',
    workloadType: '训练',
    parameter: 'gpu',
    defaultValue: '32',
    rule: '1–64',
    source: '部门',
  },
  {
    id: 'wp-preempt',
    name: '预研任务默认可抢占',
    scope: '项目 · 算法预研专项',
    workloadType: '全部',
    parameter: 'preemptible',
    defaultValue: 'true',
    rule: '必须为 true',
    source: '项目',
  },
  {
    id: 'wp-pool',
    name: 'P1 生产推理优先华北双池',
    scope: '账户',
    workloadType: '推理',
    parameter: 'nodePool',
    defaultValue: 'Pool-大兴',
    rule: '优先 Pool-大兴 / Pool-滨海，允许区域溢出',
    source: '系统',
  },
  {
    id: 'wp-mig',
    name: '显存请求上限',
    scope: '集群 · cls-hami',
    workloadType: '工作空间',
    parameter: 'gpuMemory',
    defaultValue: '40Gi',
    rule: '不超过整卡显存的 50%',
    source: '集群',
  },
]

const now = Date.now()

const TPL_VLLM_YAML = `apiVersion: serving.fathompeak.cn/v1alpha1
kind: InferenceService
metadata:
  name: \${WORKLOAD_NAME}
  namespace: \${NAMESPACE}
  labels:
    fathompeak.cn/template: inference-vllm
    fathompeak.cn/workload-type: Inference
  annotations:
    serving.fathompeak.cn/autoscaling-class: gpu-hpa
    prometheus.io/scrape: "true"
spec:
  runtime: vllm
  model:
    uri: pvc://models-ro/\${MODEL_NAME}
    format: safetensors
  image: registry.fathompeak.cn/serving/vllm:0.6.3
  imagePullSecrets:
    - name: regcred
  replicas:
    min: 1
    max: 4
  resources:
    requests:
      nvidia.com/gpu: "1"
      cpu: "12"
      memory: 96Gi
    limits:
      nvidia.com/gpu: "8"
      cpu: "96"
      memory: 768Gi
  scheduling:
    schedulerName: volcano
    priorityClassName: inference-p1
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: fathompeak.cn/pool
                operator: In
                values: ["pool-daxing", "pool-tianjin"]
  volumes:
    - name: models
      persistentVolumeClaim:
        claimName: models-ro
        readOnly: true
  env:
    - name: VLLM_TENSOR_PARALLEL_SIZE
      value: "\${TP_SIZE}"
    - name: VLLM_GPU_MEMORY_UTILIZATION
      value: "0.90"`

const TPL_TORCH_YAML = `apiVersion: batch.volcano.sh/v1alpha1
kind: Job
metadata:
  name: \${WORKLOAD_NAME}
  namespace: \${NAMESPACE}
  labels:
    fathompeak.cn/template: training-torchrun-gang
    fathompeak.cn/workload-type: Training
  annotations:
    scheduling.volcano.sh/queue-name: llm-train
spec:
  minAvailable: \${WORKER_COUNT}
  schedulerName: volcano
  policies:
    - event: PodEvicted
      action: RestartJob
  plugins:
    ssh: []
    env: []
    svc: []
  tasks:
    - name: worker
      replicas: \${WORKER_COUNT}
      template:
        metadata:
          annotations:
            scheduling.volcano.sh/gpu-topology: nvlink
        spec:
          restartPolicy: OnFailure
          imagePullSecrets:
            - name: regcred
          containers:
            - name: pytorch
              image: registry.fathompeak.cn/runtime/pytorch:2.5-cuda12.4
              command: ["torchrun"]
              args:
                - "--nnodes=\${WORKER_COUNT}"
                - "--nproc_per_node=8"
                - "--rdzv_backend=c10d"
                - "--rdzv_endpoint=\${WORKLOAD_NAME}-worker-0:29500"
                - "/workspace/train.py"
              resources:
                requests:
                  nvidia.com/gpu: "8"
                  cpu: "64"
                  memory: 512Gi
                limits:
                  nvidia.com/gpu: "8"
                  cpu: "96"
                  memory: 768Gi
              volumeMounts:
                - name: recipes
                  mountPath: /workspace
                - name: checkpoints
                  mountPath: /ckpt
          volumes:
            - name: recipes
              persistentVolumeClaim:
                claimName: git-recipes
            - name: checkpoints
              persistentVolumeClaim:
                claimName: pvc-checkpoints`

const TPL_CODE_YAML = `apiVersion: workspace.fathompeak.cn/v1alpha1
kind: DevWorkspace
metadata:
  name: \${WORKLOAD_NAME}
  namespace: \${NAMESPACE}
  labels:
    fathompeak.cn/template: workspace-code-server
    fathompeak.cn/workload-type: Workspace
spec:
  idleTimeout: 2h
  image: registry.fathompeak.cn/runtime/code-server:4.96-cuda12.4
  imagePullSecrets:
    - name: regcred
  resources:
    requests:
      nvidia.com/gpu: "1"
      cpu: "8"
      memory: 32Gi
    limits:
      nvidia.com/gpu: "4"
      cpu: "32"
      memory: 128Gi
  scheduling:
    schedulerName: default-scheduler
    priorityClassName: workspace-besteffort
    tolerations:
      - key: fathompeak.cn/preemptible
        operator: Equal
        value: "true"
        effect: NoSchedule
  volumes:
    - name: home
      persistentVolumeClaim:
        claimName: \${USER}-home
    - name: models
      persistentVolumeClaim:
        claimName: models-ro
        readOnly: true
  ports:
    - name: ide
      containerPort: 8080
      serviceType: ClusterIP`

const TPL_MINDIE_YAML = `apiVersion: serving.fathompeak.cn/v1alpha1
kind: InferenceService
metadata:
  name: \${WORKLOAD_NAME}
  namespace: \${NAMESPACE}
  labels:
    fathompeak.cn/template: inference-mindie-ascend
    fathompeak.cn/workload-type: Inference
    fathompeak.cn/accelerator: ascend
spec:
  runtime: mindie
  model:
    uri: pvc://models-ro/\${MODEL_NAME}
    format: mindie
  image: registry.fathompeak.cn/serving/mindie:2.0.T3
  imagePullSecrets:
    - name: regcred
  replicas:
    min: 1
    max: 2
  resources:
    requests:
      huawei.com/Ascend910: "8"
      cpu: "64"
      memory: 512Gi
    limits:
      huawei.com/Ascend910: "8"
      cpu: "96"
      memory: 768Gi
  scheduling:
    schedulerName: volcano
    priorityClassName: inference-p1
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: accelerator
                operator: In
                values: ["ascend-910b", "ascend-910c"]
              - key: fathompeak.cn/fabric
                operator: In
                values: ["hccs"]
  env:
    - name: MINDIE_MODEL_NAME
      value: "\${MODEL_NAME}"
    - name: WORLD_SIZE
      value: "8"`

const TPL_RAY_YAML = `apiVersion: ray.io/v1
kind: RayJob
metadata:
  name: \${WORKLOAD_NAME}
  namespace: \${NAMESPACE}
  labels:
    fathompeak.cn/template: eval-ray-batch
    fathompeak.cn/workload-type: Training
spec:
  entrpoint: python /app/eval_batch.py
  runtimeEnvYAML: |
    pip:
      - vllm==0.6.3
    env_vars:
      HF_HUB_OFFLINE: "1"
  rayClusterSpec:
    headGroupSpec:
      rayStartParams:
        dashboard-host: "0.0.0.0"
      template:
        spec:
          imagePullSecrets:
            - name: regcred
          containers:
            - name: ray-head
              image: registry.fathompeak.cn/runtime/ray:2.37-gpu
              resources:
                requests:
                  cpu: "8"
                  memory: 32Gi
                  nvidia.com/gpu: "0"
    workerGroupSpecs:
      - groupName: gpu-workers
        replicas: 2
        minReplicas: 1
        maxReplicas: 4
        rayStartParams: {}
        template:
          spec:
            containers:
              - name: ray-worker
                image: registry.fathompeak.cn/runtime/ray:2.37-gpu
                resources:
                  requests:
                    nvidia.com/gpu: "4"
                    cpu: "32"
                    memory: 256Gi
                  limits:
                    nvidia.com/gpu: "4"
                    cpu: "48"
                    memory: 384Gi`

const TPL_MIG_YAML = `apiVersion: serving.fathompeak.cn/v1alpha1
kind: InferenceService
metadata:
  name: \${WORKLOAD_NAME}
  namespace: \${NAMESPACE}
  labels:
    fathompeak.cn/template: inference-embed-mig
    fathompeak.cn/workload-type: Inference
spec:
  runtime: tei
  model:
    uri: pvc://models-ro/bge-m3
  image: registry.fathompeak.cn/serving/text-embeddings-inference:1.5
  imagePullSecrets:
    - name: regcred
  replicas:
    min: 2
    max: 8
  resources:
    requests:
      nvidia.com/mig-1g.10gb: "1"
      cpu: "4"
      memory: 16Gi
    limits:
      nvidia.com/mig-1g.10gb: "1"
      cpu: "8"
      memory: 32Gi
  scheduling:
    schedulerName: default-scheduler
    priorityClassName: inference-p2
    nodeSelector:
      nvidia.com/mig.config: all-1g.10gb
      fathompeak.cn/pool: pool-daxing`

export const ASSET_SEED: AssetRow[] = [
  {
    id: 'tpl-vllm',
    name: 'inference-vllm',
    kind: 'templates',
    scope: '账户',
    detail: '1–8 GPU · TP · volcano',
    status: '可用',
    apiVersion: 'serving.fathompeak.cn/v1alpha1',
    k8sKind: 'InferenceService',
    workloadType: 'Inference',
    version: 'v1.4.2',
    namespace: 'fp-serving',
    image: 'registry.fathompeak.cn/serving/vllm:0.6.3',
    schedulerName: 'volcano',
    yaml: TPL_VLLM_YAML,
    updatedAt: now - 2 * 24 * 3600_000,
  },
  {
    id: 'tpl-mindie',
    name: 'inference-mindie-ascend',
    kind: 'templates',
    scope: '集群 · cls-hami',
    detail: '8×Ascend910 · HCCS · volcano',
    status: '可用',
    apiVersion: 'serving.fathompeak.cn/v1alpha1',
    k8sKind: 'InferenceService',
    workloadType: 'Inference',
    version: 'v1.1.0',
    namespace: 'fp-serving',
    image: 'registry.fathompeak.cn/serving/mindie:2.0.T3',
    schedulerName: 'volcano',
    yaml: TPL_MINDIE_YAML,
    updatedAt: now - 5 * 24 * 3600_000,
  },
  {
    id: 'tpl-embed-mig',
    name: 'inference-embed-mig',
    kind: 'templates',
    scope: '集群 · cls-daxing',
    detail: 'MIG 1g.10gb · TEI · HPA',
    status: '可用',
    apiVersion: 'serving.fathompeak.cn/v1alpha1',
    k8sKind: 'InferenceService',
    workloadType: 'Inference',
    version: 'v0.9.3',
    namespace: 'fp-serving',
    image: 'registry.fathompeak.cn/serving/text-embeddings-inference:1.5',
    schedulerName: 'default-scheduler',
    yaml: TPL_MIG_YAML,
    updatedAt: now - 8 * 24 * 3600_000,
  },
  {
    id: 'tpl-torch',
    name: 'training-torchrun-gang',
    kind: 'templates',
    scope: '部门 · 基础模型事业部',
    detail: '8 GPU/worker · Gang · volcano Job',
    status: '可用',
    apiVersion: 'batch.volcano.sh/v1alpha1',
    k8sKind: 'Job',
    workloadType: 'Training',
    version: 'v2.3.1',
    namespace: 'fp-train',
    image: 'registry.fathompeak.cn/runtime/pytorch:2.5-cuda12.4',
    schedulerName: 'volcano',
    yaml: TPL_TORCH_YAML,
    updatedAt: now - 3 * 24 * 3600_000,
  },
  {
    id: 'tpl-ray',
    name: 'eval-ray-batch',
    kind: 'templates',
    scope: '项目 · LLM 对齐与评测',
    detail: 'RayJob · 2–4 worker · 4 GPU',
    status: '可用',
    apiVersion: 'ray.io/v1',
    k8sKind: 'RayJob',
    workloadType: 'Training',
    version: 'v0.6.0',
    namespace: 'fp-eval',
    image: 'registry.fathompeak.cn/runtime/ray:2.37-gpu',
    schedulerName: 'default-scheduler',
    yaml: TPL_RAY_YAML,
    updatedAt: now - 12 * 24 * 3600_000,
  },
  {
    id: 'tpl-code',
    name: 'workspace-code-server',
    kind: 'templates',
    scope: '账户',
    detail: '1–4 GPU · idleTimeout 2h',
    status: '可用',
    apiVersion: 'workspace.fathompeak.cn/v1alpha1',
    k8sKind: 'DevWorkspace',
    workloadType: 'Workspace',
    version: 'v1.2.0',
    namespace: 'fp-workspace',
    image: 'registry.fathompeak.cn/runtime/code-server:4.96-cuda12.4',
    schedulerName: 'default-scheduler',
    yaml: TPL_CODE_YAML,
    updatedAt: now - 1 * 24 * 3600_000,
  },
  { id: 'env-pt', name: 'pytorch-2.5-cuda12.4', kind: 'environments', scope: '账户', detail: 'registry.fathompeak.cn/runtime/pytorch:2.5-cuda12.4', status: '可用' },
  { id: 'env-vllm', name: 'vllm-0.6.3', kind: 'environments', scope: '账户', detail: 'registry.fathompeak.cn/serving/vllm:0.6.3', status: '可用' },
  { id: 'env-mindie', name: 'mindie-2.0-t3', kind: 'environments', scope: '集群 · cls-hami', detail: 'registry.fathompeak.cn/serving/mindie:2.0.T3', status: '可用' },
  { id: 'env-jup', name: 'jupyter-pytorch', kind: 'environments', scope: '部门 · 研究院', detail: 'registry.fathompeak.cn/runtime/jupyter:py310-cuda12.4', status: '可用' },
  { id: 'env-ray', name: 'ray-2.37-gpu', kind: 'environments', scope: '账户', detail: 'registry.fathompeak.cn/runtime/ray:2.37-gpu', status: '可用' },
  { id: 'cmp-h100', name: 'gpu-h100-8', kind: 'compute', scope: '集群 · cls-daxing', detail: 'nvidia.com/gpu:8 · cpu:96 · memory:1024Gi', status: '可用' },
  { id: 'cmp-h200', name: 'gpu-h200-8', kind: 'compute', scope: '集群 · cls-hami', detail: 'nvidia.com/gpu:8 · cpu:128 · memory:1536Gi', status: '可用' },
  { id: 'cmp-a100', name: 'gpu-a100-4', kind: 'compute', scope: '账户', detail: 'nvidia.com/gpu:4 · cpu:64 · memory:512Gi', status: '可用' },
  { id: 'cmp-ascend', name: 'ascend-910c-8', kind: 'compute', scope: '集群 · cls-hami', detail: 'huawei.com/Ascend910:8 · cpu:96 · memory:768Gi', status: '可用' },
  { id: 'cmp-mig', name: 'mig-1g.10gb', kind: 'compute', scope: '集群 · cls-daxing', detail: 'nvidia.com/mig-1g.10gb:1 · cpu:8 · memory:32Gi', status: '可用' },
  { id: 'ds-pvc', name: 'models-ro', kind: 'datasources', scope: '账户', detail: 'PVC · ReadOnlyMany · /models', status: '已绑定' },
  { id: 'ds-s3', name: 'obs-checkpoints', kind: 'datasources', scope: '部门 · 基础模型事业部', detail: 'CSI · obs://fp-ckpt/train', status: '已绑定' },
  { id: 'ds-git', name: 'git-recipes', kind: 'datasources', scope: '项目 · 算法预研专项', detail: 'Git · git.fathompeak.cn/llm/recipes', status: '已绑定' },
  { id: 'ds-ckpt', name: 'pvc-checkpoints', kind: 'datasources', scope: '项目 · LLM 预训练平台', detail: 'PVC · ReadWriteMany · /ckpt', status: '已绑定' },
  { id: 'cred-reg', name: 'regcred', kind: 'credentials', scope: '账户', detail: 'kubernetes.io/dockerconfigjson', status: '有效' },
  { id: 'cred-hub', name: 'model-hub-token', kind: 'credentials', scope: '项目 · LLM 预训练平台', detail: 'Opaque · MODEL_HUB_TOKEN', status: '有效' },
  { id: 'cred-obs', name: 'obs-ak-foundation', kind: 'credentials', scope: '部门 · 基础模型事业部', detail: 'Opaque · OBS_AK/SK', status: '有效' },
]

export const ACCESS_USERS: AccessUser[] = [
  { id: 'u-admin', name: '王小梁', email: 'wangxiaoliang@fathompeak.cn', type: '本地用户', status: '启用' },
  { id: 'u-chen', name: '陈立', email: 'chenli@fathompeak.cn', type: 'SSO', status: '启用' },
  { id: 'u-li', name: '李维', email: 'liwei@fathompeak.cn', type: 'SSO', status: '启用' },
  { id: 'u-ops', name: '调度值班', email: 'sre-oncall@fathompeak.cn', type: '本地用户', status: '启用' },
]

export const ACCESS_RULES: AccessRule[] = [
  { id: 'ar-1', subject: 'wangxiaoliang@fathompeak.cn', subjectType: '用户', role: '系统管理员', scope: '账户' },
  { id: 'ar-2', subject: 'chenli@fathompeak.cn', subjectType: '用户', role: '部门管理员', scope: '部门 · 基础模型事业部' },
  { id: 'ar-3', subject: 'liwei@fathompeak.cn', subjectType: '用户', role: '研究员', scope: '项目 · 算法预研专项' },
  { id: 'ar-4', subject: 'llm-research', subjectType: 'SSO 组', role: '项目成员', scope: '部门 · 基础模型事业部' },
  { id: 'ar-5', subject: 'scheduler-bot', subjectType: '服务账号', role: '查看者', scope: '集群 · cls-daxing' },
  { id: 'ar-6', subject: 'ci-pipeline', subjectType: '服务账号', role: '项目成员', scope: '项目 · 算法预研专项' },
]

export const SERVICE_ACCOUNTS: ServiceAccount[] = [
  {
    id: 'sa-scheduler',
    name: 'scheduler-bot',
    description: '调度器只读探针与跨集群健康巡检',
    scope: '集群 · cls-daxing',
    role: '查看者',
    tokenHint: 'sa_fp_••••dax1',
    lastUsedAt: Date.now() - 12 * 60_000,
    status: '启用',
  },
  {
    id: 'sa-ci',
    name: 'ci-pipeline',
    description: 'CI 提交训练/评测工作负载',
    scope: '项目 · 算法预研专项',
    role: '项目成员',
    tokenHint: 'sa_fp_••••ci07',
    lastUsedAt: Date.now() - 2 * 3600_000,
    status: '启用',
  },
  {
    id: 'sa-billing',
    name: 'billing-exporter',
    description: '导出 GPU·h 与绿电成本到财务系统',
    scope: '账户',
    role: '查看者',
    tokenHint: 'sa_fp_••••bill',
    lastUsedAt: Date.now() - 26 * 3600_000,
    status: '启用',
  },
  {
    id: 'sa-legacy',
    name: 'legacy-sync',
    description: '旧监控系统同步（计划下线）',
    scope: '账户',
    role: '查看者',
    tokenHint: 'sa_fp_••••old9',
    lastUsedAt: Date.now() - 40 * 24 * 3600_000,
    status: '停用',
  },
]

export const ROLES: Array<{ id: string; name: string; builtin: boolean; summary: string }> = [
  { id: 'role-admin', name: '系统管理员', builtin: true, summary: '账户内全部对象的查看、创建、编辑、删除' },
  { id: 'role-dept', name: '部门管理员', builtin: true, summary: '管理部门内项目、配额、策略与工作负载' },
  { id: 'role-editor', name: '项目成员', builtin: true, summary: '在项目内提交和停止工作负载，查看配额' },
  { id: 'role-research', name: '研究员', builtin: true, summary: '提交工作负载，不能改配额和访问规则' },
  { id: 'role-view', name: '查看者', builtin: true, summary: '只读工作负载、节点、配额和分析' },
]

export const ASSET_META: Record<AssetKind, { title: string; kicker: string; description: string; nameLabel: string }> = {
  templates: {
    title: '工作负载模板',
    kicker: '资产',
    description:
      '基于 Kubernetes CRD 的可复用清单（InferenceService / Volcano Job / RayJob / DevWorkspace）。提交时注入命名空间与变量，策略仍可覆盖被锁定字段。',
    nameLabel: '模板名称',
  },
  environments: {
    title: '环境',
    kicker: '资产',
    description: '可复用的容器镜像。对应模板 spec.image，提交时选择而不是手写地址。',
    nameLabel: '环境名称',
  },
  compute: {
    title: '计算规格',
    kicker: '资产',
    description: 'resources.requests/limits 预设，使用 nvidia.com/gpu、huawei.com/Ascend910 或 MIG 资源名。',
    nameLabel: '规格名称',
  },
  datasources: {
    title: '数据源',
    kicker: '资产',
    description: 'PVC、对象存储 CSI 与 Git。模板 volumes 按名称引用，作用域决定谁能挂载。',
    nameLabel: '数据源名称',
  },
  credentials: {
    title: '凭证',
    kicker: '资产',
    description: 'imagePullSecrets 与 Opaque Secret。密钥只在提交时注入，列表里不显示原文。',
    nameLabel: '凭证名称',
  },
}

export function departmentByName(
  name: string,
  departments: Department[] = DEPARTMENTS,
) {
  return departments.find((item) => item.name === name) ?? null
}

export function defaultProjectMeta(priority: number): ProjectMeta {
  return {
    weight: Math.max(1, 5 - priority),
    cpuCores: priority <= 2 ? 512 : 128,
  }
}

export function clustersFeedingPool(
  poolId: string,
  clusters: K8sCluster[] = CLUSTERS,
  bindings: Record<string, string[]> = POOL_SOURCES,
) {
  return (bindings[poolId] ?? [])
    .map((id) => clusters.find((cluster) => cluster.id === id))
    .filter((cluster): cluster is K8sCluster => Boolean(cluster))
}

export function poolsFedByCluster(
  clusterId: string,
  bindings: Record<string, string[]> = POOL_SOURCES,
) {
  return Object.entries(bindings)
    .filter(([, ids]) => ids.includes(clusterId))
    .map(([poolId]) => poolId)
}

export function clusterOfServer(
  server: { poolId: string; hostname?: string },
  clusters: K8sCluster[] = CLUSTERS,
  bindings: Record<string, string[]> = POOL_SOURCES,
) {
  const clusterId = bindings[server.poolId]?.[0]
  return clusters.find((cluster) => cluster.id === clusterId) ?? null
}
