# Mac 外接移动硬盘安装 minikube 实战指南

> 目标：在 Mac (Intel) 外接移动硬盘上安装 minikube，运行与阿里云 ACK 一致的 K8s 1.35 + containerd 环境。
>
> 环境：MacBook Intel i5 / 16GB RAM / 外接 1.8TB 移动硬盘（当前 FAT32）

---

## 目录

0. [K8s 架构全貌](#0-k8s-架构全貌)
1. [前置检查](#1-前置检查)
2. [格式化移动硬盘](#2-格式化移动硬盘)
3. [安装基础工具](#3-安装基础工具)
4. [将 Docker 数据目录迁移到移动硬盘](#4-将-docker-数据目录迁移到移动硬盘)
5. [将 minikube 数据目录指向移动硬盘](#5-将-minikube-数据目录指向移动硬盘)
6. [启动多节点集群](#6-启动多节点集群)
7. [网络插件详解与验证](#7-网络插件详解与验证)
8. [CoreDNS 详解与排障](#8-coredns-详解与排障)
9. [验证集群架构](#9-验证集群架构)
10. [基础操作练习](#10-基础操作练习)
11. [工作负载类型全览](#11-工作负载类型全览)
12. [节点运维操作](#12-节点运维操作)
13. [Taints、Tolerations 与调度约束](#13-taints-tolerations-与调度约束)
14. [RBAC 权限控制](#14-rbac-权限控制)
15. [etcd 备份与恢复](#15-etcd-备份与恢复)
16. [K8s 生态组件安装与运维](#16-k8s-生态组件安装与运维)
17. [日常启停流程](#17-日常启停流程)
18. [常见问题排查](#18-常见问题排查)
19. [清理与卸载](#19-清理与卸载)

---

## 0. K8s 架构全貌

> 在动手之前，先理解你要搭建的东西长什么样。后面每一步操作都对应这张图里的某个组件。

### 0.1 集群架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        K8s 集群 (Cluster)                        │
│                                                                  │
│  ┌──────────────────────────────────────┐                        │
│  │     Control Plane (Master 节点)       │                        │
│  │                                      │                        │
│  │  ┌──────────┐  ┌──────────────────┐  │                        │
│  │  │ etcd     │  │ kube-apiserver   │  │  ← 所有操作的入口       │
│  │  │ (数据库)  │  │ (API 网关)       │  │    kubectl 就是调它     │
│  │  └──────────┘  └──────────────────┘  │                        │
│  │  ┌──────────────┐ ┌───────────────┐  │                        │
│  │  │ kube-scheduler│ │ controller-  │  │                        │
│  │  │ (调度器)      │ │ manager      │  │                        │
│  │  │ 决定 Pod 跑   │ │ (控制器管理)  │  │                        │
│  │  │ 在哪个节点    │ │ 维持期望状态  │  │                        │
│  │  └──────────────┘ └───────────────┘  │                        │
│  └──────────────────────────────────────┘                        │
│                          │                                       │
│              ┌───────────┼───────────┐                            │
│              ▼           ▼           ▼                            │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐        │
│  │ Worker Node 1  │ │ Worker Node 2  │ │ Worker Node N  │        │
│  │                │ │                │ │                │        │
│  │ ┌────────────┐ │ │ ┌────────────┐ │ │ ┌────────────┐ │        │
│  │ │ kubelet    │ │ │ │ kubelet    │ │ │ │ kubelet    │ │        │
│  │ │ (节点代理)  │ │ │ │ (节点代理)  │ │ │ │ (节点代理)  │ │        │
│  │ └────────────┘ │ │ └────────────┘ │ │ └────────────┘ │        │
│  │ ┌────────────┐ │ │ ┌────────────┐ │ │ ┌────────────┐ │        │
│  │ │ kube-proxy │ │ │ │ kube-proxy │ │ │ │ kube-proxy │ │        │
│  │ │ (网络代理)  │ │ │ │ (网络代理)  │ │ │ │ (网络代理)  │ │        │
│  │ └────────────┘ │ │ └────────────┘ │ │ └────────────┘ │        │
│  │ ┌────────────┐ │ │ ┌────────────┐ │ │ ┌────────────┐ │        │
│  │ │ containerd │ │ │ │ containerd │ │ │ │ containerd │ │        │
│  │ │ (容器运行时)│ │ │ │ (容器运行时)│ │ │ │ (容器运行时)│ │        │
│  │ └────────────┘ │ │ └────────────┘ │ │ └────────────┘ │        │
│  │                │ │                │ │                │        │
│  │  [Pod A] [B]   │ │  [Pod C] [D]   │ │  [Pod E]       │        │
│  └────────────────┘ └────────────────┘ └────────────────┘        │
│              │           │           │                            │
│              └───────────┼───────────┘                            │
│                          ▼                                       │
│                ┌──────────────────┐                               │
│                │  CNI 网络插件     │  ← Pod 之间跨节点通信的基础     │
│                │ (Calico/Flannel/ │    没有它 Pod 之间不能互通       │
│                │  Cilium/kindnet) │                               │
│                └──────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │ 外部访问          │
                │ Ingress/Service  │
                │ (LoadBalancer/   │
                │  NodePort)       │
                └──────────────────┘
```

### 0.2 每个组件干什么（对应实战中你会看到的东西）

| 组件 | 角色 | 在哪个节点 | 你在实战中怎么看到它 |
|------|------|-----------|-------------------|
| **etcd** | 集群的数据库，存储所有状态 | Master | `kubectl get pods -n kube-system` 看到 `etcd-*` |
| **kube-apiserver** | 所有操作的入口，kubectl 调的就是它 | Master | `kubectl get pods -n kube-system` 看到 `kube-apiserver-*` |
| **kube-scheduler** | 决定新 Pod 跑在哪个 Node 上 | Master | 多节点集群中 Pod 自动分配到不同 Node |
| **kube-controller-manager** | 维持期望状态（你说要 3 副本，它确保一直是 3 个） | Master | `kubectl scale` 后它负责创建/删除 Pod |
| **kubelet** | 节点上的代理，接收 Master 指令，管理本节点的 Pod | 每个 Node | `minikube ssh` 进节点后 `systemctl status kubelet` |
| **kube-proxy** | 每个节点上的网络代理，实现 Service 的负载均衡 | 每个 Node | `kubectl get pods -n kube-system` 看到 `kube-proxy-*` |
| **containerd** | 容器运行时，真正拉镜像、启容器的 | 每个 Node | `kubectl get nodes -o wide` 看 CONTAINER-RUNTIME 列 |
| **CNI 网络插件** | 让不同节点上的 Pod 互相通信 | 每个 Node | `kubectl get pods -n kube-system` 看到网络插件 Pod |
| **CoreDNS** | 集群内 DNS，让 Pod 之间用 Service 名互相发现 | Master | `kubectl get pods -n kube-system` 看到 `coredns-*` |

### 0.3 我们要搭建的集群结构

```
本次搭建（3 节点，模拟真实集群）：

  ack-lab           ← Control Plane (Master)
  ack-lab-m02       ← Worker Node 1
  ack-lab-m03       ← Worker Node 2

对比阿里云 ACK：

  Master (阿里云托管)  ← 你看不到，阿里云帮你管
  Worker Node 1       ← 你买的 ECS
  Worker Node 2       ← 你买的 ECS
  Worker Node N       ← 按需加
```

### 0.4 概念与实战对照表

| K8s 概念 | 理论定义 | 本指南哪一步能看到 |
|---------|---------|-----------------|
| Cluster | 一组节点组成的集群 | 第 6 步：启动多节点集群 |
| Control Plane / Master | 管理集群的大脑 | 第 8 步：查看 Master 节点和系统组件 |
| Worker Node | 跑应用 Pod 的节点 | 第 6 步：添加 Worker 节点 |
| CNI 网络插件 | Pod 跨节点通信的基础 | 第 7 步：网络插件详解与验证 |
| Pod | K8s 最小调度单位 | 第 9 步：部署 nginx |
| Deployment | 管理 Pod 副本集 | 第 9 步：声明式部署 |
| Service | 为 Pod 提供稳定访问入口 | 第 9 步：暴露服务 |
| Ingress | HTTP 路由（域名→Service） | 第 9 步：Addon 安装 |
| ConfigMap / Secret | 配置与密钥管理 | 第 9 步：配置管理练习 |
| Namespace | 资源隔离的虚拟分区 | 第 9 步：命名空间练习 |
| kube-proxy | Service 负载均衡实现 | 第 7 步：网络流量路径 |
| kubelet | 节点代理，管本节点的 Pod | 第 8 步：SSH 进节点查看 |
| etcd | 集群状态数据库 | 第 8 步：系统 Pod 列表 |
| scheduler | Pod 调度到哪个 Node | 第 9 步：多副本观察调度分布 |

### 0.5 网络插件（CNI）概念预览

> 第 7 步会详细操作，这里先理解为什么需要它。

没有 CNI 网络插件，K8s 集群就是一群**互相不通的孤岛**：

```
没有 CNI：
  Node 1: Pod A (10.244.0.2) ──✗──→ Pod C (10.244.1.2) :Node 2
  各节点的 Pod 网段不通，无法通信

有了 CNI：
  Node 1: Pod A (10.244.0.2) ──✓──→ Pod C (10.244.1.2) :Node 2
  CNI 建立了跨节点的虚拟网络（overlay 或路由方式）
```

| CNI 插件 | 用在哪 | 特点 |
|---------|--------|------|
| **kindnet** | minikube 默认 | 极简，够学习用 |
| **Calico** | 生产常用 | 支持 NetworkPolicy（网络策略） |
| **Flannel** | ACK 默认选项之一 | 简单稳定，overlay 网络 |
| **Cilium** | 高级场景 | 基于 eBPF，性能最好 |
| **Terway** | ACK 专有 | 阿里云 VPC 直通，性能最高 |

minikube 默认用 kindnet（够用），我们也可以切换到 Calico 体验 NetworkPolicy。

---

## 1. 前置检查

### 1.1 确认 Mac 硬件

```bash
# CPU 型号
sysctl -n machdep.cpu.brand_string

# 内存（需要 >= 8GB，推荐 16GB）
sysctl -n hw.memsize | awk '{printf "%.0f GB\n", $0/1024/1024/1024}'

# 内置盘剩余空间
df -h /
```

### 1.2 确认移动硬盘已连接

```bash
# 查看挂载的外部卷
df -h | grep Volumes

# 预期输出类似：
# /dev/disk2s1  1.8Ti  5.3Gi  1.8Ti  1%  /Volumes/WIN10
```

记下你的移动硬盘挂载路径（如 `/Volumes/WIN10`），后面会用到。

### 1.3 确认已安装的工具

```bash
which brew    # 应该有 Homebrew
which docker  # 可能有旧版 Docker
which kubectl # 可能有旧版 kubectl
```

---

## 2. 格式化移动硬盘

### ⚠️ 警告：格式化会清除硬盘上所有数据！

你的移动硬盘当前是 FAT32 格式（Win10 安装盘），FAT32 不支持 Docker/minikube 需要的符号链接和大文件。**必须格式化为 APFS 或 Mac OS 扩展格式。**

### 2.1 备份（如果需要）

如果硬盘上有重要数据，先备份。当前硬盘上是 Win10 安装文件，如果不再需要装 Windows 可以直接格式化。

### 2.2 查看硬盘标识符

```bash
diskutil list external
```

找到你的移动硬盘，记下标识符（如 `disk2`）。**确认是移动硬盘，别格错了内置盘！**

预期输出类似：
```
/dev/disk2 (external, physical):
   #:                       TYPE NAME                    SIZE       IDENTIFIER
   0:     FDisk_partition_scheme                        *2.0 TB     disk2
   1:               DOS_FAT_32 WIN10                    2.0 TB     disk2s1
```

### 2.3 格式化为 APFS

```bash
# ⚠️ 将 disk2 替换为你的实际标识符！
# ⚠️ 这会清除硬盘上所有数据！

diskutil eraseDisk APFS "K8sLab" /dev/disk2
```

参数说明：
- `APFS`：Apple 文件系统，支持符号链接、大文件、权限管理
- `"K8sLab"`：卷名，格式化后硬盘显示为这个名字
- `/dev/disk2`：你的移动硬盘标识符

### 2.4 验证格式化成功

```bash
diskutil info /dev/disk2s1 | grep -E "Volume Name|File System"

# 预期输出：
#    Volume Name:         K8sLab
#    File System Personality:  APFS
```

```bash
# 确认挂载点
ls /Volumes/K8sLab

# 确认空间
df -h /Volumes/K8sLab
```

### 2.5 创建工作目录

```bash
mkdir -p /Volumes/K8sLab/docker-data
mkdir -p /Volumes/K8sLab/minikube
```

### 常见坑

| 问题 | 解决 |
|------|------|
| `diskutil eraseDisk` 报错 "Resource busy" | 先卸载：`diskutil unmountDisk /dev/disk2`，再格式化 |
| 格式化后 Finder 里看不到 | 拔插一下 USB，或执行 `diskutil mount /dev/disk2s1` |
| 不确定哪个是移动硬盘 | `diskutil list` 看 `(external)` 标记，**千万别选 `(internal)`** |

---

## 3. 安装基础工具

### 3.1 升级 Homebrew

```bash
brew update
```

### 3.2 安装/升级 minikube

```bash
brew install minikube

# 验证
minikube version
# 预期：minikube version: v1.35.x 或更高
```

### 3.3 升级 kubectl

你当前的 kubectl 是 v1.24（太旧了），需要升级到与 K8s 1.35 匹配的版本：

```bash
brew install kubectl

# 验证
kubectl version --client
# 预期：Client Version: v1.35.x
```

如果 brew 报 "already installed"：
```bash
brew upgrade kubectl
```

### 3.4 升级 Docker Desktop

你当前 Docker 是 v20.10（2022 年的），需要升级：

**方式 A：通过 Docker Desktop 自动更新**
- 点击状态栏 Docker 图标 → Check for Updates → 下载安装

**方式 B：重新下载安装**
1. 前往 https://www.docker.com/products/docker-desktop/
2. 下载 Mac Intel 版
3. 安装（覆盖旧版）

```bash
# 安装后验证
docker --version
# 预期：Docker version 27.x 或更高
```

### 常见坑

| 问题 | 解决 |
|------|------|
| `brew install` 报错网络超时 | 换镜像源：`export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git"` |
| Docker Desktop 启动后一直转圈 | 等 2-3 分钟；如果超过 5 分钟，重启 Docker Desktop |
| kubectl 版本没变 | 可能有多个 kubectl，执行 `which -a kubectl` 查看，删掉旧的 |

---

## 4. 将 Docker 数据目录迁移到移动硬盘

默认 Docker 镜像存在内置盘 `~/Library/Containers/com.docker.docker/`，会占 5-20GB。你内置盘空间不足，需要迁移到移动硬盘。

### 4.1 配置 Docker Desktop 数据目录

1. 点击状态栏 Docker 图标 → **Settings**（齿轮图标）
2. 左侧选 **Resources** → **Advanced**
3. 找到 **Disk image location**（磁盘映像位置）
4. 点击 **Browse**，选择 `/Volumes/K8sLab/docker-data`
5. 点击 **Apply & Restart**

Docker 会自动迁移数据到移动硬盘，这个过程可能需要几分钟。

### 4.2 验证迁移成功

```bash
# 检查 Docker 数据目录
docker info 2>/dev/null | grep "Docker Root Dir"

# 确认移动硬盘上有数据
ls -la /Volumes/K8sLab/docker-data/
# 应该能看到 Docker.raw 或类似文件
```

### 4.3 配置 Docker 资源限制

Docker Desktop → Settings → Resources → Advanced：

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| CPUs | 4 | 给 minikube 留够 CPU |
| Memory | 6 GB | 16GB 总内存，给 Docker 6GB |
| Disk image size | 40 GB | 移动硬盘空间充足，给够 |

点击 **Apply & Restart**。

### 常见坑

| 问题 | 解决 |
|------|------|
| 迁移过程中 Docker 卡死 | 强制退出 Docker Desktop，重新打开，重新设置路径 |
| 移动硬盘拔出后 Docker 无法启动 | 插回硬盘再启动；或改回内置盘路径 |
| 找不到 Disk image location 选项 | Docker Desktop 版本太旧，先升级到最新版 |

---

## 5. 将 minikube 数据目录指向移动硬盘

minikube 默认将所有数据存在 `~/.minikube/`（内置盘）。通过环境变量或符号链接迁移到移动硬盘。

### 5.1 设置环境变量（推荐）

编辑你的 shell 配置文件：

```bash
# 如果用 zsh（Mac 默认）
echo '' >> ~/.zshrc
echo '# === minikube 数据目录指向移动硬盘 ===' >> ~/.zshrc
echo 'export MINIKUBE_HOME=/Volumes/K8sLab/minikube' >> ~/.zshrc

# 立即生效
source ~/.zshrc

# 验证
echo $MINIKUBE_HOME
# 预期输出：/Volumes/K8sLab/minikube
```

### 5.2 如果之前有旧的 minikube 数据

```bash
# 如果 ~/.minikube 存在且有数据
ls ~/.minikube 2>/dev/null

# 存在的话，删掉（全新安装不需要旧数据）
rm -rf ~/.minikube
```

### 常见坑

| 问题 | 解决 |
|------|------|
| 忘记 source ~/.zshrc | 每次新开终端都会自动加载，或手动 `source ~/.zshrc` |
| MINIKUBE_HOME 路径有空格 | 确保卷名没有空格（我们命名为 `K8sLab` 没有空格，没问题） |
| 移动硬盘未挂载时 minikube 报错 | 先插硬盘再操作 minikube |
| ~/.minikube 软链接与 MINIKUBE_HOME 冲突 | **不要**同时设置 MINIKUBE_HOME 和 `~/.minikube` 软链接，二者会指向不同子路径导致 profile 互相不可见。只用 MINIKUBE_HOME 即可 |

---

## 6. 启动多节点集群

> 搭建 1 Master + 2 Worker 的完整集群，对应架构全貌图中的三个节点。

### 6.1 确认前置条件

```bash
# 检查清单（全部通过才继续）
echo "Docker: $(docker info --format '{{.ServerVersion}}' 2>/dev/null || echo 'NOT RUNNING')"
echo "minikube: $(minikube version --short 2>/dev/null || echo 'NOT INSTALLED')"
echo "kubectl: $(kubectl version --client 2>/dev/null | head -1 || echo 'NOT INSTALLED')"
echo "MINIKUBE_HOME: ${MINIKUBE_HOME:-NOT SET}"
echo "移动硬盘: $(df -h /Volumes/K8sLab 2>/dev/null | tail -1 || echo 'NOT MOUNTED')"
```

确保：
- [x] Docker 已启动（状态栏图标是绿色）
- [x] minikube 已安装
- [x] kubectl 已安装
- [x] MINIKUBE_HOME 已设置
- [x] 移动硬盘已挂载

### 6.2 Step 1：启动 Master 节点（Control Plane）

```bash
minikube start \
  --driver=docker \
  --kubernetes-version=v1.35.1 \
  --container-runtime=containerd \
  --nodes=3 \
  --cpus=2 \
  --memory=2048 \
  --disk-size=15g \
  --cni=calico \
  --dns-domain=cluster.local \
  --profile=ack-lab \
  --docker-env HTTP_PROXY=http://host.docker.internal:7890 \
  --docker-env HTTPS_PROXY=http://host.docker.internal:7890 \
  --docker-env NO_PROXY=127.0.0.1,localhost,192.168.49.0/24,10.96.0.0/12
```

> **注意**：阿里云镜像源尚未同步 K8s v1.35.1 二进制文件，因此不使用 `--image-mirror-country` 和 `--image-repository`，改为通过本地代理直接下载。

参数说明：

| 参数 | 值 | 为什么 |
|------|---|--------|
| `--driver=docker` | docker | 最稳定的驱动 |
| `--kubernetes-version=v1.35.1` | v1.35.1 | **与阿里云 ACK 最新版一致** |
| `--container-runtime=containerd` | containerd | **与 ACK 运行时一致** |
| `--nodes=3` | 3 | **1 个 Master + 2 个 Worker，体验真实集群调度** |
| `--cpus=2` | 2 | 每个节点 2 核（3 节点共 6 核，Docker 给了 6GB 够用） |
| `--memory=2048` | 2GB/节点 | 每个节点 2GB（3 节点共 6GB） |
| `--disk-size=15g` | 15GB/节点 | 移动硬盘空间充足 |
| `--cni=calico` | calico | **手动指定网络插件**（而非默认 kindnet），支持 NetworkPolicy |
| `--docker-env *_PROXY` | 本地代理 | **通过代理下载 K8s 组件**（`host.docker.internal` 让容器访问宿主机代理） |
| `--profile=ack-lab` | ack-lab | 集群名 |

> **资源预算**：3 节点 × 2 核 2GB = 共需 6 核 6GB。你的 Mac 是 4 核 16GB，
> Docker Desktop 分配 6GB 内存就够。如果资源不足，可以改为 `--nodes=2`（1 Master + 1 Worker）。

### 6.3 等待启动完成

首次启动需要下载 K8s 组件 + Calico 网络插件镜像，**预计 10-20 分钟**。

你会看到类似输出：
```
😄  [ack-lab] minikube v1.35.x on Darwin (amd64)
✨  Using the docker driver based on user configuration
📌  Using Docker Desktop driver with root privileges
👍  Starting "ack-lab" primary control-plane node in "ack-lab" cluster
🚜  Pulling base image ...
🔥  Creating docker container (CPUs=2, Memory=2048MB) ...
🐳  Preparing Kubernetes v1.35.1 on containerd ...
    ▪ Generating certificates and keys ...
    ▪ Booting up control plane ...
    ▪ Configuring RBAC rules ...
🔗  Configuring Calico (Container Networking Interface) ...
👍  Starting "ack-lab-m02" worker node in "ack-lab" cluster
🚜  Pulling base image ...
🔥  Creating docker container (CPUs=2, Memory=2048MB) ...
🌐  Found network options:
    ▪ NO_PROXY=192.168.49.2
🐳  Preparing Kubernetes v1.35.1 on containerd ...
👍  Starting "ack-lab-m03" worker node in "ack-lab" cluster
🚜  Pulling base image ...
🔥  Creating docker container (CPUs=2, Memory=2048MB) ...
🐳  Preparing Kubernetes v1.35.1 on containerd ...
🔎  Verifying Kubernetes components...
🌟  Enabled addons: storage-provisioner, default-storageclass
🏄  Done! kubectl is now configured to use "ack-lab" cluster
```

### 6.4 验证 3 个节点都起来了

```bash
kubectl get nodes -o wide

# 预期输出（3 个节点，角色不同）：
# NAME          STATUS   ROLES           VERSION   CONTAINER-RUNTIME
# ack-lab       Ready    control-plane   v1.35.1   containerd://x.x.x
# ack-lab-m02   Ready    <none>          v1.35.1   containerd://x.x.x
# ack-lab-m03   Ready    <none>          v1.35.1   containerd://x.x.x
```

**解读**：
- `ack-lab`：Master 节点（角色 `control-plane`），运行 etcd/apiserver/scheduler/controller-manager
- `ack-lab-m02`、`ack-lab-m03`：Worker 节点（角色 `<none>`），运行你的应用 Pod

### 6.5 如果资源不足（降级方案）

如果 3 节点启动失败或 Mac 太卡，可以降为 2 节点：

```bash
# 删除 3 节点集群
minikube delete -p ack-lab

# 启动 2 节点（1 Master + 1 Worker）
minikube start \
  --driver=docker \
  --kubernetes-version=v1.35.1 \
  --container-runtime=containerd \
  --nodes=2 \
  --cpus=2 \
  --memory=2048 \
  --disk-size=15g \
  --cni=calico \
  --image-mirror-country=cn \
  --image-repository=registry.cn-hangzhou.aliyuncs.com/google_containers \
  --profile=ack-lab
```

### 6.6 如果启动失败

```bash
# 查看详细日志
minikube logs -p ack-lab

# 删除重建
minikube delete -p ack-lab
# 然后重新执行 6.2 的命令
```

### 常见坑

| 问题 | 原因 | 解决 |
|------|------|------|
| 拉镜像超时 `ImagePull timeout` | 网络问题 | 确认加了 `--image-mirror-country=cn` |
| `Exiting due to RSRC_INSUFFICIENT_CORES` | CPU 不够 | 改为 `--cpus=1` 或减少节点数 |
| `Exiting due to RSRC_INSUFFICIENT_MEMORY` | 内存不够 | 关掉其他应用，或 `--memory=1536 --nodes=2` |
| `driver docker not found` | Docker Desktop 没启动 | 启动 Docker Desktop 等绿灯 |
| Worker 节点一直 NotReady | Calico 还在初始化 | 等 2-3 分钟，Calico Pod 就绪后自动变 Ready |
| 启动卡在 "Pulling base image" 很久 | 基础镜像大约 400MB × 3 节点 | 耐心等，首次较慢 |

---

## 7. 网络插件详解与安装

> 对应架构图中的 CNI 层。**没有网络插件，K8s 集群的节点之间就是孤岛，Pod 无法跨节点通信。**
> 这一章是很多 K8s 初学者忽略的关键环节。

### 7.1 为什么需要网络插件

K8s 本身**不提供 Pod 网络实现**。它只定义了三条规则，具体实现交给 CNI（Container Network Interface）插件。

```
K8s 网络模型（三条铁律）：
  1. 每个 Pod 有自己独立的 IP 地址
  2. 所有 Pod 之间可以直接通信（不需要 NAT）
  3. 所有 Node 可以和所有 Pod 通信

没有 CNI 插件时：
  Node 1 上的 Pod (10.244.0.x) ──✗──→ Node 2 上的 Pod (10.244.1.x)
  节点之间的 Pod 网段不通，集群不可用

安装 CNI 插件后：
  Node 1 上的 Pod (10.244.0.x) ──✓──→ Node 2 上的 Pod (10.244.1.x)
  CNI 建立跨节点的虚拟网络，Pod 互通
```

### 7.2 CNI 插件对比与选型

| 插件 | 工作原理 | NetworkPolicy | 性能 | 用在哪 |
|------|---------|---------------|------|--------|
| **kindnet** | 简单桥接 | ❌ 不支持 | 一般 | minikube 默认 |
| **Flannel** | VXLAN overlay | ❌ 不支持 | 一般 | ACK 默认选项之一 |
| **Calico** | BGP 路由 / IPIP 隧道 | ✅ 支持 | 好 | **生产常用，ACK 支持** |
| **Cilium** | eBPF 内核级 | ✅ 支持 | 最好 | 高级场景 |
| **Terway** | 阿里云 VPC 直通 | ✅ 支持 | 最好 | ACK 专有 |

**我们选 Calico**：生产级、支持 NetworkPolicy（K8s 防火墙）、ACK 也支持、学习价值最高。

### 7.3 安装方式说明

网络插件有**两种安装方式**，理解这个对你很重要：

| 方式 | 命令 | 适用场景 |
|------|------|---------|
| **方式 A：minikube 自动安装** | `minikube start --cni=calico` | 我们第 6 步用的就是这个 |
| **方式 B：手动 kubectl 安装** | `kubectl apply -f calico.yaml` | 生产环境 / kubeadm 搭建的集群 |

第 6 步 `--cni=calico` 已经自动帮你装好了 Calico。下面先验证，然后**额外教你手动安装方式**（这是生产环境的标准做法）。

### 7.4 验证 Calico 已安装并运行

#### Step 1：查看 Calico 的 Pod

```bash
kubectl get pods -n kube-system -l k8s-app=calico-node -o wide

# 预期输出（每个节点一个 calico-node Pod）：
# NAME                READY   STATUS    NODE
# calico-node-xxxxx   1/1     Running   ack-lab       ← Master 节点
# calico-node-yyyyy   1/1     Running   ack-lab-m02   ← Worker 1
# calico-node-zzzzz   1/1     Running   ack-lab-m03   ← Worker 2
```

#### Step 2：查看 Calico 控制器

```bash
kubectl get pods -n kube-system -l k8s-app=calico-kube-controllers

# 预期：
# calico-kube-controllers-xxx   1/1   Running
```

#### Step 3：确认所有节点 Ready

```bash
kubectl get nodes

# 如果有节点 NotReady，通常是 Calico 还没初始化完
# 等 2-3 分钟后再查看
```

#### 如果 Calico Pod 不正常

```bash
# 查看 Calico Pod 的详细状态
kubectl describe pod -n kube-system -l k8s-app=calico-node

# 查看 Calico 日志
kubectl logs -n kube-system -l k8s-app=calico-node --tail=50

# 常见问题：
# - Init 容器卡住 → 镜像拉取慢，等待
# - CrashLoopBackOff → 查日志，通常是网络配置冲突
```

### 7.5 （进阶）手动安装 Calico 的完整步骤

> 以下步骤在第 6 步用了 `--cni=calico` 的情况下**不需要执行**。
> 但在生产环境用 kubeadm 搭建集群、或者阿里云 ACK 选择自定义网络时，你需要手动装。
> 这里教你走一遍流程，加深理解。

#### Step 1：先创建一个没有 CNI 的集群（演示用）

```bash
# 如果想亲自体验手动安装，可以创建一个新的 profile
minikube start \
  --driver=docker \
  --kubernetes-version=v1.35.1 \
  --container-runtime=containerd \
  --nodes=2 \
  --cpus=2 \
  --memory=2048 \
  --cni=false \
  --image-mirror-country=cn \
  --image-repository=registry.cn-hangzhou.aliyuncs.com/google_containers \
  --profile=manual-cni-lab
```

注意 `--cni=false`：不安装任何网络插件。

#### Step 2：观察没有 CNI 的集群状态

```bash
kubectl get nodes --context manual-cni-lab

# 预期：节点状态是 NotReady！
# NAME                 STATUS     ROLES           VERSION
# manual-cni-lab       NotReady   control-plane   v1.35.1
# manual-cni-lab-m02   NotReady   <none>          v1.35.1
```

**这就是为什么需要 CNI**——没有网络插件，节点永远 NotReady，Pod 无法调度。

#### Step 3：下载 Calico manifest 文件

```bash
# 下载 Calico 的安装 YAML（官方提供）
curl -O https://raw.githubusercontent.com/projectcalico/calico/v3.28.0/manifests/calico.yaml

# 查看文件大小（通常 200-300KB，包含所有 Calico 组件的定义）
ls -lh calico.yaml
```

> 如果 GitHub 下载慢，可以用镜像：
> `curl -O https://ghproxy.com/https://raw.githubusercontent.com/projectcalico/calico/v3.28.0/manifests/calico.yaml`

#### Step 4：了解 calico.yaml 里有什么

```bash
# 查看包含的资源类型
grep "^kind:" calico.yaml | sort | uniq -c

# 预期输出类似：
#   1 kind: ClusterRole
#   1 kind: ClusterRoleBinding
#   1 kind: ConfigMap
#   2 kind: CustomResourceDefinition
#   1 kind: DaemonSet              ← calico-node，每个节点跑一个
#   1 kind: Deployment             ← calico-kube-controllers
#   1 kind: ServiceAccount
#   ...
```

**关键组件**：
| 资源 | 作用 |
|------|------|
| **DaemonSet: calico-node** | 每个节点运行一个 Pod，负责配置网络路由和 iptables 规则 |
| **Deployment: calico-kube-controllers** | 监控 K8s 资源变化，同步 Calico 网络策略 |
| **ConfigMap: calico-config** | Calico 的配置（后端类型、IPAM 等） |
| **CRD** | Calico 自定义资源定义（IPPool、NetworkPolicy 扩展等） |

#### Step 5：（可选）修改 Pod 网段 CIDR

```bash
# 默认 Calico 使用 192.168.0.0/16
# 如果你的集群 Pod CIDR 是其他网段（如 minikube 用 10.244.0.0/16），需要修改

# 查看集群的 Pod CIDR
kubectl cluster-info dump --context manual-cni-lab | grep -m1 cluster-cidr
# 预期输出包含：--cluster-cidr=10.244.0.0/16

# 修改 calico.yaml 中的 CALICO_IPV4POOL_CIDR
# 找到这一段，取消注释并修改：
#   - name: CALICO_IPV4POOL_CIDR
#     value: "10.244.0.0/16"

# 用 sed 命令一步到位：
sed -i.bak 's|# - name: CALICO_IPV4POOL_CIDR|- name: CALICO_IPV4POOL_CIDR|' calico.yaml
sed -i.bak 's|#   value: "192.168.0.0/16"|  value: "10.244.0.0/16"|' calico.yaml
```

#### Step 6：安装 Calico

```bash
kubectl apply -f calico.yaml --context manual-cni-lab

# 预期输出（会创建一堆资源）：
# configmap/calico-config created
# customresourcedefinition.apiextensions.k8s.io/... created
# clusterrole.rbac.authorization.k8s.io/calico-node created
# ...
# daemonset.apps/calico-node created
# deployment.apps/calico-kube-controllers created
```

#### Step 7：等待 Calico Pod 全部就绪

```bash
# 持续观察 Calico Pod 状态（Ctrl+C 退出）
kubectl get pods -n kube-system -l k8s-app=calico-node -w --context manual-cni-lab

# 等所有 calico-node Pod 变成 Running（通常 1-3 分钟）
# 期间你会看到：
# calico-node-xxx   0/1   Init:0/3    ← 正在初始化
# calico-node-xxx   0/1   PodInitializing
# calico-node-xxx   1/1   Running     ← 就绪！
```

#### Step 8：验证节点变为 Ready

```bash
kubectl get nodes --context manual-cni-lab

# 现在应该全部 Ready 了！
# NAME                 STATUS   ROLES           VERSION
# manual-cni-lab       Ready    control-plane   v1.35.1
# manual-cni-lab-m02   Ready    <none>          v1.35.1
```

#### Step 9：清理演示集群

```bash
# 删掉手动安装 CNI 的演示集群（保留主集群 ack-lab）
minikube delete -p manual-cni-lab
rm -f calico.yaml calico.yaml.bak
```

### 7.6 查看 Pod 网络分配（回到主集群 ack-lab）

```bash
# 确保在主集群上下文
kubectl config use-context ack-lab

# 查看每个节点分配到的 Pod 网段（CIDR）
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.podCIDR}{"\n"}{end}'

# 预期输出：
# ack-lab        10.244.0.0/24    ← Master 节点的 Pod 网段
# ack-lab-m02    10.244.1.0/24    ← Worker 1 的 Pod 网段
# ack-lab-m03    10.244.2.0/24    ← Worker 2 的 Pod 网段
```

**每个节点有独立的子网**，Calico 负责让这些子网互通。

### 7.7 验证跨节点 Pod 通信

部署测试 Pod 到不同节点，验证网络连通：

```bash
# 创建 2 个 Pod（调度器会自动分到不同 Worker 节点）
kubectl run test-pod-1 --image=busybox --restart=Never -- sleep 3600
kubectl run test-pod-2 --image=busybox --restart=Never -- sleep 3600

# 等 Pod 都 Running
kubectl get pods -o wide

# 确认两个 Pod 在不同节点上
# 记下 test-pod-2 的 IP（假设是 10.244.2.5）

# 从 test-pod-1 ping test-pod-2
kubectl exec test-pod-1 -- ping -c 3 <test-pod-2的IP>

# 预期：能 ping 通！说明 Calico 跨节点网络正常
# PING 10.244.2.5 (10.244.2.5): 56 data bytes
# 64 bytes from 10.244.2.5: seq=0 ttl=62 time=0.512 ms

# 也测试一下 DNS（通过 Service 名访问）
kubectl exec test-pod-1 -- nslookup kubernetes.default.svc.cluster.local
# 预期：返回 kube-apiserver 的 ClusterIP，说明 CoreDNS 正常

# 清理
kubectl delete pod test-pod-1 test-pod-2
```

### 7.8 深入理解：Calico 在节点上做了什么

```bash
# SSH 进入 Worker 节点，看 Calico 创建的网络设备
minikube ssh -p ack-lab -n ack-lab-m02

# 查看网络接口（Calico 创建的虚拟设备）
ip link show | grep cali
# 预期看到 caliXXXXXXX 接口 — 每个 Pod 对应一个 veth pair

# 查看路由表（Calico 添加的路由规则）
ip route | grep -E "10.244|blackhole"
# 预期看到：
# 10.244.0.0/24 via 192.168.49.2 dev eth0    ← 去 Master 的 Pod 走这条路
# 10.244.1.0/24 dev caliXXX scope link       ← 本节点的 Pod 直接到达
# 10.244.2.0/24 via 192.168.49.4 dev eth0    ← 去 Worker 2 的 Pod 走这条路

# 查看 iptables 规则（Calico 添加的防火墙规则）
sudo iptables -L -n | grep cali | head -10
# 这些规则实现了 NetworkPolicy 的流量控制

exit
```

### 7.9 理解完整的网络流量路径

```
=== 集群内 Pod 到 Pod（跨节点） ===

Pod A (10.244.1.5, Node 1)
  → veth pair（Pod 的虚拟网卡 → 节点上的 caliXXX 接口）
    → Node 1 路由表（10.244.2.0/24 via Node2-IP）
      → 物理网络 / overlay 隧道
        → Node 2 路由表
          → veth pair
            → Pod B (10.244.2.3, Node 2)

=== 外部流量进入集群 ===

用户浏览器
  → minikube tunnel / NodePort（进入集群某个 Node）
    → kube-proxy（iptables 规则做负载均衡，选一个 Pod）
      → 如果目标 Pod 在本节点 → 直接到达
      → 如果目标 Pod 在其他节点 → 走 Calico 跨节点路由
        → 目标 Pod

=== Service 的 ClusterIP 访问 ===

Pod A → curl http://my-service:80
  → CoreDNS 解析 my-service → ClusterIP (如 10.96.100.5)
    → kube-proxy iptables 规则 → DNAT 到某个 Pod IP
      → Calico 网络 → 目标 Pod
```

### 7.10 体验 NetworkPolicy（Calico 的核心能力）

NetworkPolicy 是 K8s 的"防火墙规则"，**只有 Calico/Cilium 支持，kindnet/Flannel 不支持**。

#### 实验 1：默认全部放行，然后拒绝所有入站

```bash
# 先创建两个 Pod
kubectl run source --image=busybox --restart=Never -- sleep 3600
kubectl run target --image=busybox --restart=Never -- sleep 3600
kubectl get pods -o wide  # 等都 Running

# 获取 target 的 IP
TARGET_IP=$(kubectl get pod target -o jsonpath='{.status.podIP}')
echo "target IP: $TARGET_IP"

# 测试 1：默认状态下能 ping 通
kubectl exec source -- ping -c 2 $TARGET_IP
# 预期：2 packets transmitted, 2 received ✅
```

#### 实验 2：应用 deny-all NetworkPolicy

创建文件 `deny-all.yaml`：

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
  namespace: default
spec:
  podSelector: {}          # 匹配 default 命名空间所有 Pod
  policyTypes:
  - Ingress                # 限制入站流量
  ingress: []              # 空列表 = 全部拒绝
```

```bash
# 应用策略
kubectl apply -f deny-all.yaml

# 测试 2：现在 ping 不通了
kubectl exec source -- ping -c 2 -W 2 $TARGET_IP
# 预期：2 packets transmitted, 0 received ❌（被 NetworkPolicy 拦截）
```

#### 实验 3：精确放行特定流量

创建文件 `allow-source.yaml`：

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-source
  namespace: default
spec:
  podSelector:
    matchLabels:
      run: target              # 只对 target Pod 生效
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          run: source          # 只允许 source Pod 访问
```

```bash
# 应用放行策略
kubectl apply -f allow-source.yaml

# 测试 3：source 又能 ping 通 target 了
kubectl exec source -- ping -c 2 $TARGET_IP
# 预期：2 packets transmitted, 2 received ✅

# 但如果从其他 Pod 访问 target，仍然不通
kubectl run outsider --image=busybox --restart=Never -- sleep 3600
kubectl exec outsider -- ping -c 2 -W 2 $TARGET_IP
# 预期：0 received ❌（outsider 没有被放行）
```

#### 清理

```bash
kubectl delete networkpolicy deny-all-ingress allow-from-source
kubectl delete pod source target outsider
rm -f deny-all.yaml allow-source.yaml
```

### 7.11 小结：网络插件知识清单

完成本章后你应该理解：

| 知识点 | 理解程度 |
|--------|---------|
| 为什么 K8s 需要 CNI 插件 | 没有 CNI → 节点 NotReady，Pod 不通 |
| Calico vs Flannel vs Cilium 的区别 | 路由方式 + NetworkPolicy 支持差异 |
| 手动安装 CNI 的流程 | `kubectl apply -f calico.yaml` |
| 每个节点的 Pod 网段是怎么分配的 | podCIDR，每个节点一个子网 |
| 跨节点 Pod 通信原理 | veth pair → 路由表 → 物理网络 → 对端节点 |
| NetworkPolicy 是什么、怎么用 | K8s 的防火墙，deny-all + 精确放行 |
| kube-proxy 和 CNI 的关系 | kube-proxy 管 Service 负载均衡，CNI 管 Pod 网络连通 |

---

## 8. CoreDNS 详解与排障

> CoreDNS 是 K8s 集群的"电话簿"。Pod 之间通过 Service 名通信（如 `curl http://my-service:80`），全靠 CoreDNS 把名字解析成 ClusterIP。**DNS 问题是新手排障的第一大坑。**

### 8.1 CoreDNS 在集群中的位置

```
Pod A 发起请求: curl http://my-service:80
  │
  ▼
Pod 的 /etc/resolv.conf（kubelet 自动配置）
  nameserver 10.96.0.10          ← CoreDNS 的 ClusterIP
  search default.svc.cluster.local svc.cluster.local cluster.local
  ndots: 5
  │
  ▼
CoreDNS Pod（运行在 kube-system 命名空间）
  │
  ├─ 集群内域名（*.svc.cluster.local）→ 查 K8s Service API → 返回 ClusterIP
  └─ 集群外域名（如 google.com）→ 转发到上游 DNS（如 8.8.8.8）
```

### 8.2 查看 CoreDNS 状态

```bash
# 查看 CoreDNS Pod
kubectl get pods -n kube-system -l k8s-app=kube-dns -o wide
# 预期：1-2 个 coredns Pod，状态 Running

# 查看 CoreDNS Service（注意它的 ClusterIP）
kubectl get svc -n kube-system kube-dns
# NAME       TYPE        CLUSTER-IP   PORT(S)
# kube-dns   ClusterIP   10.96.0.10   53/UDP,53/TCP,9153/TCP

# 这个 10.96.0.10 就是所有 Pod 的 /etc/resolv.conf 里的 nameserver

# 查看 CoreDNS 日志
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=30
```

### 8.3 CoreDNS 配置（Corefile）

CoreDNS 的配置存储在一个 ConfigMap 中：

```bash
kubectl get configmap coredns -n kube-system -o yaml
```

```
# 默认 Corefile 关键部分解读：
.:53 {
    errors                    # 记录错误日志
    health                    # 健康检查端点
    ready                     # 就绪检查端点
    kubernetes cluster.local  # 处理集群内域名（*.svc.cluster.local）
    forward . /etc/resolv.conf # 集群外域名转发给上游 DNS
    cache 30                  # 缓存 30 秒
    loop                      # 检测 DNS 循环
    reload                    # 配置变更后自动重载
}
```

**日常运维场景**：如果需要自定义 DNS（比如内网域名解析），编辑这个 ConfigMap：

```bash
kubectl edit configmap coredns -n kube-system

# 例：添加自定义域名解析（在 kubernetes 段后面加）
#   hosts {
#     10.0.0.100 internal-api.company.com
#     fallthrough
#   }
```

### 8.4 DNS 排障三板斧

#### 工具 Pod（推荐用 dnsutils，比 busybox 的 nslookup 更全）

```bash
kubectl run dnstest --image=registry.k8s.io/e2e-test-images/jessie-dnsutils:1.3 \
  --restart=Never -- sleep 3600

# 如果拉不动上面的镜像，busybox 也能用
# kubectl run dnstest --image=busybox --restart=Never -- sleep 3600
```

#### 板斧 1：nslookup 验证 Service 解析

```bash
# 解析 kubernetes 默认 Service（一定能解析，否则 CoreDNS 有问题）
kubectl exec dnstest -- nslookup kubernetes.default.svc.cluster.local
# 预期：返回 10.96.0.1（apiserver 的 ClusterIP）

# 解析其他 Service
kubectl exec dnstest -- nslookup kube-dns.kube-system.svc.cluster.local
# 预期：返回 10.96.0.10

# 简写形式（同命名空间可省略后缀）
kubectl exec dnstest -- nslookup kubernetes
```

#### 板斧 2：检查 Pod 的 DNS 配置

```bash
kubectl exec dnstest -- cat /etc/resolv.conf
# 预期：
# nameserver 10.96.0.10              ← 指向 CoreDNS
# search default.svc.cluster.local svc.cluster.local cluster.local
# ndots:5
```

#### 板斧 3：检查 CoreDNS Pod 本身

```bash
# Pod 是否 Running
kubectl get pods -n kube-system -l k8s-app=kube-dns

# 日志有没有报错
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50

# describe 看 Events
kubectl describe pods -n kube-system -l k8s-app=kube-dns
```

### 8.5 常见 DNS 问题与解决

| 问题 | 症状 | 排查 | 解决 |
|------|------|------|------|
| CoreDNS Pod 挂了 | 所有 Service 名解析失败 | `kubectl get pods -n kube-system -l k8s-app=kube-dns` | 查日志，通常 `kubectl rollout restart deployment/coredns -n kube-system` |
| 解析外部域名失败 | `nslookup google.com` 超时 | CoreDNS 的 `forward` 上游不通 | 检查节点 DNS 配置或改 Corefile 的 forward 为 `forward . 8.8.8.8` |
| ndots 导致解析慢 | 访问外部域名多了 5 次无效查询 | `nslookup -debug google.com` 看查询次数 | Pod spec 中设置 `dnsConfig: {options: [{name: ndots, value: "2"}]}` |
| 跨命名空间 Service 访问不到 | `curl http://other-svc` 失败 | 短名只在同命名空间生效 | 用全名 `other-svc.other-namespace.svc.cluster.local` |
| CoreDNS OOMKilled | 大集群 Service 数量多 | `kubectl describe pod` 看 OOMKilled | 增大 CoreDNS 内存 limits |

```bash
# 清理
kubectl delete pod dnstest
```

### 8.6 小结

| 知识点 | 要点 |
|--------|------|
| CoreDNS 角色 | 集群内 DNS 服务器，Pod 通过它发现 Service |
| 配置位置 | `configmap/coredns` in `kube-system` |
| Pod DNS 配置 | kubelet 自动写入 `/etc/resolv.conf`，指向 CoreDNS ClusterIP |
| 排障三板斧 | nslookup 验证 → 检查 resolv.conf → 检查 CoreDNS Pod |
| ndots 陷阱 | 默认 ndots:5，外部域名会先尝试 5 个集群后缀，影响性能 |

---

## 9. 验证集群架构

> 验证你搭建的集群和架构图的每个组件对应上。

### 9.1 查看所有节点

```bash
kubectl get nodes -o wide

# 确认：
# - 3 个节点（1 control-plane + 2 worker）
# - 全部 Ready
# - CONTAINER-RUNTIME 都是 containerd
# - INTERNAL-IP 各不相同
```

### 9.2 查看 Master 上的控制面组件

```bash
kubectl get pods -n kube-system -o wide

# 对照架构图，找到这些组件：
# etcd-ack-lab                        ← etcd 数据库
# kube-apiserver-ack-lab              ← API Server
# kube-scheduler-ack-lab              ← 调度器
# kube-controller-manager-ack-lab     ← 控制器管理器
# coredns-xxx                         ← 集群 DNS
#
# 运行在每个节点上的：
# kube-proxy-xxx (3个)                ← 每个节点一个网络代理
# calico-node-xxx (3个)               ← 每个节点一个网络插件
# calico-kube-controllers-xxx         ← Calico 控制器
```

### 9.3 SSH 进入各节点，查看底层组件

```bash
# SSH 进 Master 节点
minikube ssh -p ack-lab -n ack-lab

# 查看 kubelet 状态
systemctl status kubelet

# 查看 containerd 状态
systemctl status containerd

# 查看本节点的容器
crictl ps

# 退出
exit

# SSH 进 Worker Node 1
minikube ssh -p ack-lab -n ack-lab-m02

# 同样查看
systemctl status kubelet
crictl ps
exit
```

### 9.4 查看集群信息汇总

```bash
# 集群信息
kubectl cluster-info

# 所有命名空间的 Pod
kubectl get pods -A

# 所有资源概览
kubectl get all -A
```

### 9.5 验证 K8s 版本对齐 ACK

```bash
kubectl version

# 确认 Server Version 是 v1.35.1（与 ACK 一致）
```

### 9.6 验证数据目录在移动硬盘上

```bash
# minikube 数据
du -sh /Volumes/K8sLab/minikube/
# 应该有几 GB（3 个节点的数据）

# Docker 数据
du -sh /Volumes/K8sLab/docker-data/
# 应该有几 GB
```

---

## 10. 基础操作练习

集群跑起来后，练习以下操作。这些操作和在阿里云 ACK 上完全一样。

### 10.1 部署第一个应用

```bash
# 创建一个 nginx deployment
kubectl create deployment nginx --image=nginx:latest

# 查看 deployment
kubectl get deployments

# 查看 pod
kubectl get pods

# 等待 Pod 变成 Running（首次拉镜像可能需要 1-2 分钟）
kubectl get pods -w
```

### 10.2 暴露服务

```bash
# 创建 Service（NodePort 类型）
kubectl expose deployment nginx --type=NodePort --port=80

# 查看 Service
kubectl get svc nginx

# 用 minikube 打开浏览器访问
minikube service nginx -p ack-lab
```

浏览器应该打开 nginx 欢迎页面。

### 10.3 扩缩容

```bash
# 扩到 3 个副本
kubectl scale deployment nginx --replicas=3

# 查看 Pod（应该有 3 个）
kubectl get pods

# 缩回 1 个
kubectl scale deployment nginx --replicas=1
```

### 10.4 查看日志

```bash
# 查看 Pod 日志
kubectl logs deployment/nginx

# 实时查看日志（-f = follow）
kubectl logs -f deployment/nginx
```

### 10.5 进入容器

```bash
# 进入 nginx 容器的 shell
kubectl exec -it deployment/nginx -- /bin/bash

# 在容器内执行命令
cat /etc/nginx/nginx.conf
exit
```

### 10.6 用 YAML 部署（重要！生产中都是这么干的）

创建文件 `nginx-demo.yaml`：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-yaml-demo
  labels:
    app: nginx-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx-demo
  template:
    metadata:
      labels:
        app: nginx-demo
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "200m"
            memory: "256Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-yaml-demo
spec:
  type: NodePort
  selector:
    app: nginx-demo
  ports:
  - port: 80
    targetPort: 80
```

```bash
# 部署
kubectl apply -f nginx-demo.yaml

# 查看
kubectl get deploy,svc,pods

# 访问
minikube service nginx-yaml-demo -p ack-lab

# 清理
kubectl delete -f nginx-demo.yaml
```

### 10.7 安装常用 Addon

```bash
# 查看可用 addon
minikube addons list -p ack-lab

# 安装 Ingress（和 ACK 的 Ingress Controller 对应）
minikube addons enable ingress -p ack-lab

# 安装 Dashboard（可视化面板）
minikube addons enable dashboard -p ack-lab
minikube addons enable metrics-server -p ack-lab

# 打开 Dashboard
minikube dashboard -p ack-lab
```

---

### 10.8 滚动更新与回滚（生产必备）

```bash
# 部署 nginx 1.24
kubectl create deployment nginx-update --image=nginx:1.24 --replicas=3
kubectl get pods -l app=nginx-update -o wide

# 确认当前版本
kubectl describe deployment nginx-update | grep Image
# 预期：nginx:1.24

# === 滚动更新 === 升级到 1.25
kubectl set image deployment/nginx-update nginx=nginx:1.25

# 实时观察滚动更新过程（新 Pod 起来 → 旧 Pod 下线，逐个替换）
kubectl rollout status deployment/nginx-update
# 预期输出：
# Waiting for deployment "nginx-update" rollout to finish: 1 out of 3 new replicas have been updated...
# Waiting for deployment "nginx-update" rollout to finish: 2 out of 3 new replicas have been updated...
# deployment "nginx-update" successfully rolled out

# 确认版本已更新
kubectl describe deployment nginx-update | grep Image
# 预期：nginx:1.25

# 查看更新历史
kubectl rollout history deployment/nginx-update
# REVISION  CHANGE-CAUSE
# 1         <none>          ← nginx:1.24
# 2         <none>          ← nginx:1.25

# === 回滚 === 模拟升级出问题，回退到上一版本
kubectl rollout undo deployment/nginx-update

# 确认已回滚
kubectl describe deployment nginx-update | grep Image
# 预期：nginx:1.24（回到旧版本）

# 清理
kubectl delete deployment nginx-update
```

### 10.9 ConfigMap 和 Secret（配置管理）

```bash
# === ConfigMap：存储非敏感配置 ===

# 方式 1：命令行创建
kubectl create configmap app-config \
  --from-literal=APP_ENV=production \
  --from-literal=LOG_LEVEL=info

# 查看
kubectl get configmap app-config -o yaml

# 方式 2：从文件创建（更常用）
# 先创建配置文件
cat > /tmp/app.conf << 'EOF'
server.port=8080
database.host=postgres
database.pool_size=10
EOF

kubectl create configmap app-file-config --from-file=/tmp/app.conf
kubectl get configmap app-file-config -o yaml
```

```yaml
# 在 Pod 中使用 ConfigMap — 创建 configmap-demo.yaml
apiVersion: v1
kind: Pod
metadata:
  name: configmap-demo
spec:
  containers:
  - name: demo
    image: busybox
    command: ["sh", "-c", "echo $APP_ENV && echo $LOG_LEVEL && cat /config/app.conf && sleep 3600"]
    env:                                   # 方式 A：注入为环境变量
    - name: APP_ENV
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: APP_ENV
    - name: LOG_LEVEL
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: LOG_LEVEL
    volumeMounts:                          # 方式 B：挂载为文件
    - name: config-volume
      mountPath: /config
  volumes:
  - name: config-volume
    configMap:
      name: app-file-config
```

```bash
kubectl apply -f configmap-demo.yaml
kubectl logs configmap-demo
# 预期输出：
# production
# info
# server.port=8080
# database.host=postgres
# database.pool_size=10

# 清理
kubectl delete pod configmap-demo
kubectl delete configmap app-config app-file-config
```

```bash
# === Secret：存储敏感信息（密码、Token、证书） ===

# 创建 Secret（自动 base64 编码）
kubectl create secret generic db-credentials \
  --from-literal=DB_USER=admin \
  --from-literal=DB_PASSWORD=s3cret123

# 查看（值被 base64 编码了）
kubectl get secret db-credentials -o yaml
# data:
#   DB_PASSWORD: czNjcmV0MTIz    ← base64 编码
#   DB_USER: YWRtaW4=

# 解码验证
kubectl get secret db-credentials -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
# 预期：s3cret123
```

```yaml
# 在 Pod 中使用 Secret — 创建 secret-demo.yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-demo
spec:
  containers:
  - name: demo
    image: busybox
    command: ["sh", "-c", "echo user=$DB_USER pass=$DB_PASSWORD && sleep 3600"]
    env:
    - name: DB_USER
      valueFrom:
        secretKeyRef:
          name: db-credentials
          key: DB_USER
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-credentials
          key: DB_PASSWORD
```

```bash
kubectl apply -f secret-demo.yaml
kubectl logs secret-demo
# 预期：user=admin pass=s3cret123

# 清理
kubectl delete pod secret-demo
kubectl delete secret db-credentials
```

### 10.10 存储：PV、PVC、StorageClass

```bash
# === 理解存储三层结构 ===
# StorageClass：定义"存储类型"（如 SSD、HDD）→ 管理员配置
# PV (PersistentVolume)：一块具体的存储空间 → 可自动或手动创建
# PVC (PersistentVolumeClaim)：Pod 对存储的"申请" → 开发者写

# minikube 自带一个 StorageClass
kubectl get storageclass
# NAME                 PROVISIONER                RECLAIMPOLICY
# standard (default)   k8s.io/minikube-hostpath   Delete
```

```yaml
# 创建 pvc-demo.yaml — Pod 申请持久化存储
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-data
spec:
  accessModes:
  - ReadWriteOnce            # 单节点读写
  resources:
    requests:
      storage: 100Mi         # 申请 100MB
  # storageClassName: standard  ← 不写就用默认的
---
apiVersion: v1
kind: Pod
metadata:
  name: storage-demo
spec:
  containers:
  - name: writer
    image: busybox
    command: ["sh", "-c", "echo 'hello from PVC' > /data/test.txt && sleep 3600"]
    volumeMounts:
    - name: my-storage
      mountPath: /data         # 挂载到容器的 /data 目录
  volumes:
  - name: my-storage
    persistentVolumeClaim:
      claimName: my-data       # 引用上面创建的 PVC
```

```bash
kubectl apply -f pvc-demo.yaml

# 查看 PVC 和自动创建的 PV
kubectl get pvc
# NAME      STATUS   VOLUME             CAPACITY   ACCESS MODES   STORAGECLASS
# my-data   Bound    pvc-xxxx-xxxx      100Mi      RWO            standard

kubectl get pv
# NAME             CAPACITY   STATUS   CLAIM            STORAGECLASS
# pvc-xxxx-xxxx    100Mi      Bound    default/my-data  standard

# 验证数据已写入
kubectl exec storage-demo -- cat /data/test.txt
# 预期：hello from PVC

# 删掉 Pod，数据还在
kubectl delete pod storage-demo
kubectl apply -f pvc-demo.yaml     # 重新创建同一个 Pod
kubectl exec storage-demo -- cat /data/test.txt
# 预期：hello from PVC ← 数据持久化了！

# 清理
kubectl delete -f pvc-demo.yaml
```

### 10.11 健康检查：livenessProbe 和 readinessProbe（生产必配）

```yaml
# 创建 probe-demo.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: probe-demo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: probe-demo
  template:
    metadata:
      labels:
        app: probe-demo
    spec:
      containers:
      - name: web
        image: nginx
        ports:
        - containerPort: 80
        livenessProbe:           # 存活探针：失败 → 重启容器
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5   # 容器启动后等 5s 开始检测
          periodSeconds: 10        # 每 10s 检测一次
          failureThreshold: 3      # 连续失败 3 次 → 重启
        readinessProbe:          # 就绪探针：失败 → 从 Service 摘除流量
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 3
          periodSeconds: 5
```

```bash
kubectl apply -f probe-demo.yaml
kubectl get pods -w   # 观察 READY 列从 0/1 变成 1/1

# 模拟 liveness 检测失败：删掉 nginx 的首页
kubectl exec deployment/probe-demo -- rm /usr/share/nginx/html/index.html

# 等 30 秒，观察 Pod 被自动重启（RESTARTS 列 +1）
kubectl get pods -w
# NAME                         READY   RESTARTS   AGE
# probe-demo-xxx               1/1     1          2m    ← 重启了！

# K8s 检测到 liveness 失败 → 自动重启容器 → nginx 恢复 → 又变 Ready

# 清理
kubectl delete -f probe-demo.yaml
```

### 10.12 Ingress 实战（HTTP 路由）

```bash
# 确保 Ingress Controller 已安装（10.7 步已装）
kubectl get pods -n ingress-nginx
# 应该有 ingress-nginx-controller Running
```

```yaml
# 创建 ingress-demo.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-v1
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo
      version: v1
  template:
    metadata:
      labels:
        app: demo
        version: v1
    spec:
      containers:
      - name: web
        image: nginx
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: app-v1-svc
spec:
  selector:
    app: demo
    version: v1
  ports:
  - port: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: demo.local               # 域名（本地需配 /etc/hosts）
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-v1-svc
            port:
              number: 80
```

```bash
kubectl apply -f ingress-demo.yaml

# 获取 Ingress Controller 的 IP
minikube ip -p ack-lab
# 假设返回 192.168.49.2

# 配置本地 hosts（需要 sudo）
echo "$(minikube ip -p ack-lab) demo.local" | sudo tee -a /etc/hosts

# 开启 minikube tunnel（另开一个终端窗口）
minikube tunnel -p ack-lab

# 浏览器访问 http://demo.local 或者 curl
curl http://demo.local
# 预期：返回 nginx 欢迎页

# 清理
kubectl delete -f ingress-demo.yaml
# 记得从 /etc/hosts 删掉 demo.local 那行
```

### 10.13 HPA 自动伸缩（根据 CPU 自动扩缩 Pod）

```bash
# 确保 metrics-server 已安装（10.7 步已装）
kubectl top nodes   # 能看到 CPU/内存使用率说明 metrics-server 正常

# 部署一个 CPU 密集型应用
kubectl create deployment hpa-demo --image=nginx --replicas=1
kubectl set resources deployment/hpa-demo --requests=cpu=50m --limits=cpu=100m
kubectl expose deployment hpa-demo --port=80

# 创建 HPA：CPU 超过 50% 就自动扩容，最多 5 个副本
kubectl autoscale deployment hpa-demo --cpu-percent=50 --min=1 --max=5

# 查看 HPA
kubectl get hpa
# NAME       REFERENCE             TARGETS   MINPODS   MAXPODS   REPLICAS
# hpa-demo   Deployment/hpa-demo   0%/50%    1         5         1

# 模拟压力（另开终端）
kubectl run load-generator --image=busybox --restart=Never \
  -- sh -c "while true; do wget -q -O- http://hpa-demo; done"

# 回到原终端，观察自动扩容（需等 1-2 分钟 metrics 采集）
kubectl get hpa -w
# TARGETS 列会从 0% 升高，REPLICAS 列会从 1 增加到 2、3...

kubectl get pods -l app=hpa-demo
# 预期：自动创建了多个 Pod

# 停止压力
kubectl delete pod load-generator

# 等 5 分钟，观察自动缩容
kubectl get hpa -w
# REPLICAS 会慢慢降回 1

# 清理
kubectl delete hpa hpa-demo
kubectl delete deployment hpa-demo
kubectl delete svc hpa-demo
```

### 10.14 观察调度器行为（多节点专属）

```bash
# 部署 6 个副本的 nginx
kubectl create deployment nginx-spread --image=nginx --replicas=6

# 查看 Pod 分布在哪些节点上
kubectl get pods -o wide -l app=nginx-spread

# 预期：Pod 分散在 ack-lab-m02 和 ack-lab-m03 两个 Worker 节点上
# （Master 默认有 taint，不调度普通 Pod）

# NAME                          NODE
# nginx-spread-xxx-aaa          ack-lab-m02    ← 分到 Worker 1
# nginx-spread-xxx-bbb          ack-lab-m03    ← 分到 Worker 2
# nginx-spread-xxx-ccc          ack-lab-m02
# nginx-spread-xxx-ddd          ack-lab-m03
# ...

# 这就是 kube-scheduler 在工作：自动将 Pod 均匀分配到各 Worker 节点

# 清理
kubectl delete deployment nginx-spread
```

### 10.15 Namespace 命名空间练习

```bash
# 查看已有命名空间
kubectl get namespaces

# 预期：
# default           ← 默认，你的应用跑在这里
# kube-system       ← K8s 系统组件
# kube-public       ← 公开信息
# kube-node-lease   ← 节点心跳

# 创建自己的命名空间（模拟生产环境隔离）
kubectl create namespace dev
kubectl create namespace staging

# 在 dev 命名空间部署
kubectl create deployment nginx-dev --image=nginx -n dev

# 查看（不指定 -n 看不到）
kubectl get pods                    # 看不到
kubectl get pods -n dev             # 能看到

# 清理
kubectl delete namespace dev staging
```

---

## 11. 工作负载类型全览

> 前面只用了 Deployment。K8s 共有 5 种核心工作负载控制器，各有不同用途。生产中你全都会用到。

### 11.1 五种工作负载对比

| 控制器 | 用途 | Pod 特性 | 典型场景 |
|--------|------|---------|---------|
| **Deployment** | 无状态应用 | Pod 可替换、可扩缩 | Web 应用、API 服务 |
| **DaemonSet** | 每个节点跑一个 Pod | Node 增减时自动增减 Pod | 日志收集、监控 agent、网络插件 |
| **StatefulSet** | 有状态应用 | Pod 有固定名称和持久存储 | 数据库、消息队列、ZooKeeper |
| **Job** | 一次性任务 | 跑完就结束 | 数据迁移、批量计算 |
| **CronJob** | 定时任务 | 按 cron 表达式定时创建 Job | 定时备份、报表生成 |

### 11.2 DaemonSet 实战：每个节点跑一个 Pod

```yaml
# 创建 daemonset-demo.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-collector
  labels:
    app: log-collector
spec:
  selector:
    matchLabels:
      app: log-collector
  template:
    metadata:
      labels:
        app: log-collector
    spec:
      containers:
      - name: collector
        image: busybox
        command: ["sh", "-c", "while true; do echo \"[$(hostname)] collecting logs at $(date)\"; sleep 30; done"]
        resources:
          requests:
            cpu: "50m"
            memory: "64Mi"
          limits:
            cpu: "100m"
            memory: "128Mi"
```

```bash
kubectl apply -f daemonset-demo.yaml

# 查看 DaemonSet（每个 Worker 节点自动跑一个 Pod）
kubectl get daemonset log-collector
# NAME            DESIRED   CURRENT   READY   NODE SELECTOR
# log-collector   2         2         2       <none>         ← 2 个 Worker 节点各一个

kubectl get pods -l app=log-collector -o wide
# 注意：Master 默认有 taint，DaemonSet 不会调度到 Master
# 除非加了 toleration（下一章讲）

# 查看某个 Pod 的日志
kubectl logs -l app=log-collector --tail=5

# 清理
kubectl delete -f daemonset-demo.yaml
```

**你已经见过的 DaemonSet**：kube-proxy 和 calico-node 就是 DaemonSet！

```bash
kubectl get daemonset -n kube-system
# 预期看到 kube-proxy 和 calico-node
```

### 11.3 StatefulSet 实战：有状态应用

```yaml
# 创建 statefulset-demo.yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-headless
spec:
  clusterIP: None          # Headless Service（StatefulSet 必须搭配）
  selector:
    app: nginx-sts
  ports:
  - port: 80
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: "nginx-headless"    # 关联 Headless Service
  replicas: 3
  selector:
    matchLabels:
      app: nginx-sts
  template:
    metadata:
      labels:
        app: nginx-sts
    spec:
      containers:
      - name: nginx
        image: nginx
        ports:
        - containerPort: 80
        volumeMounts:
        - name: data
          mountPath: /usr/share/nginx/html
  volumeClaimTemplates:            # 每个 Pod 自动创建独立的 PVC
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 50Mi
```

```bash
kubectl apply -f statefulset-demo.yaml

# StatefulSet 的 Pod 有固定名称（不是随机后缀）
kubectl get pods -l app=nginx-sts
# NAME    READY   STATUS
# web-0   1/1     Running    ← 固定名称：web-0, web-1, web-2
# web-1   1/1     Running
# web-2   1/1     Running

# 每个 Pod 有独立的 PVC
kubectl get pvc
# NAME         STATUS   VOLUME          CAPACITY
# data-web-0   Bound    pvc-xxx         50Mi       ← 每个 Pod 独立存储
# data-web-1   Bound    pvc-yyy         50Mi
# data-web-2   Bound    pvc-zzz         50Mi

# 每个 Pod 有固定的 DNS 名（通过 Headless Service）
kubectl run dnstest --image=busybox --restart=Never -- sleep 3600
kubectl exec dnstest -- nslookup web-0.nginx-headless.default.svc.cluster.local
# 预期：返回 web-0 的 Pod IP

# StatefulSet 按顺序创建/删除（web-0 先起，web-2 最后起）
# 删除时反序（web-2 先删，web-0 最后删）

# 清理
kubectl delete pod dnstest
kubectl delete -f statefulset-demo.yaml
kubectl delete pvc -l app=nginx-sts    # PVC 不会自动删除，需手动清理
```

**Deployment vs StatefulSet 核心区别**：

| | Deployment | StatefulSet |
|---|---|---|
| Pod 名 | 随机后缀 `nginx-abc123` | 固定序号 `web-0, web-1` |
| 存储 | 共享或无 | 每个 Pod 独立 PVC |
| 启停顺序 | 无序 | 有序（顺序创建，反序删除） |
| DNS | 只有 Service 级 | 每个 Pod 有独立 DNS |
| 适用 | Web 应用、无状态 API | 数据库、集群中间件 |

### 11.4 Job 实战：一次性任务

```yaml
# 创建 job-demo.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: data-migration
spec:
  backoffLimit: 3              # 失败最多重试 3 次
  activeDeadlineSeconds: 60    # 超时 60 秒自动终止
  template:
    spec:
      containers:
      - name: migrate
        image: busybox
        command: ["sh", "-c", "echo 'Starting migration...' && sleep 5 && echo 'Migration done!' && exit 0"]
      restartPolicy: Never     # Job 必须设置 Never 或 OnFailure
```

```bash
kubectl apply -f job-demo.yaml

# 查看 Job 状态
kubectl get jobs
# NAME              COMPLETIONS   DURATION   AGE
# data-migration    1/1           8s         10s   ← COMPLETIONS 1/1 表示成功

# 查看 Job 的 Pod（状态是 Completed，不是 Running）
kubectl get pods -l job-name=data-migration
# NAME                      STATUS
# data-migration-xxxxx      Completed

# 查看日志
kubectl logs -l job-name=data-migration
# Starting migration...
# Migration done!

# 清理
kubectl delete -f job-demo.yaml
```

### 11.5 CronJob 实战：定时任务

```yaml
# 创建 cronjob-demo.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: db-backup
spec:
  schedule: "*/2 * * * *"       # 每 2 分钟执行一次（演示用，生产中用合理间隔）
  successfulJobsHistoryLimit: 3  # 保留最近 3 次成功记录
  failedJobsHistoryLimit: 1      # 保留最近 1 次失败记录
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: busybox
            command: ["sh", "-c", "echo \"Backup at $(date)\" && sleep 3"]
          restartPolicy: Never
```

```bash
kubectl apply -f cronjob-demo.yaml

# 查看 CronJob
kubectl get cronjob
# NAME        SCHEDULE      SUSPEND   ACTIVE   LAST SCHEDULE
# db-backup   */2 * * * *   False     0        <none>

# 等 2 分钟，查看自动创建的 Job
kubectl get jobs --watch
# 每 2 分钟会出现一个新 Job

# 手动触发一次（不等定时器）
kubectl create job db-backup-manual --from=cronjob/db-backup

# 查看历史
kubectl get jobs -l app!=none
kubectl logs -l job-name=db-backup-manual

# 清理
kubectl delete -f cronjob-demo.yaml
kubectl delete job db-backup-manual
```

### 11.6 小结

| 要部署什么 | 用哪个控制器 |
|-----------|------------|
| Web 服务、无状态 API | Deployment |
| 日志收集、监控 Agent、每个节点一份 | DaemonSet |
| MySQL、Redis、Kafka | StatefulSet |
| 数据迁移、一次性脚本 | Job |
| 定时备份、定时报表 | CronJob |

---

## 12. 节点运维操作

> 生产中你经常需要维护节点：升级系统、修复问题、增减节点。这些操作在 minikube 上都能练。

### 12.1 查看节点详情

```bash
# 节点列表
kubectl get nodes -o wide

# 节点详细信息（关注 Conditions、Capacity、Allocatable）
kubectl describe node ack-lab-m02

# 节点资源使用（需要 metrics-server）
kubectl top nodes
```

### 12.2 节点标签（Label）

```bash
# 查看已有标签
kubectl get nodes --show-labels

# 添加标签（常用于区分节点角色、机型、区域）
kubectl label node ack-lab-m02 disk-type=ssd
kubectl label node ack-lab-m03 disk-type=hdd

# 查看特定标签
kubectl get nodes -L disk-type
# NAME          STATUS   ROLES           DISK-TYPE
# ack-lab       Ready    control-plane
# ack-lab-m02   Ready    <none>          ssd
# ack-lab-m03   Ready    <none>          hdd

# 利用标签做调度（nodeSelector）
# 在 Pod spec 中加：
#   nodeSelector:
#     disk-type: ssd
# 这样 Pod 只会调度到带 disk-type=ssd 标签的节点

# 删除标签
kubectl label node ack-lab-m02 disk-type-
kubectl label node ack-lab-m03 disk-type-
```

### 12.3 cordon / uncordon：禁止/恢复调度

```bash
# cordon：标记节点为不可调度（已有 Pod 不受影响，新 Pod 不会调度过来）
kubectl cordon ack-lab-m02

kubectl get nodes
# NAME          STATUS                     ROLES
# ack-lab       Ready                      control-plane
# ack-lab-m02   Ready,SchedulingDisabled   <none>    ← 注意 SchedulingDisabled

# 此时新建的 Pod 只会调度到 ack-lab-m03
kubectl create deployment cordon-test --image=nginx --replicas=3
kubectl get pods -o wide -l app=cordon-test
# 所有 Pod 都在 ack-lab-m03 上

# uncordon：恢复调度
kubectl uncordon ack-lab-m02
kubectl get nodes
# ack-lab-m02   Ready   <none>    ← 恢复正常

# 清理
kubectl delete deployment cordon-test
```

### 12.4 drain：排空节点（维护前必做）

```bash
# 先部署一些 Pod
kubectl create deployment drain-test --image=nginx --replicas=4
kubectl get pods -o wide -l app=drain-test
# Pod 分布在两个 Worker 节点上

# drain：安全地驱逐节点上的所有 Pod，然后标记为 SchedulingDisabled
kubectl drain ack-lab-m02 --ignore-daemonsets --delete-emptydir-data

# --ignore-daemonsets: DaemonSet 的 Pod 不驱逐（它们必须每个节点一个）
# --delete-emptydir-data: 允许删除 emptyDir 数据

# 查看结果
kubectl get pods -o wide -l app=drain-test
# 所有 Pod 都迁移到了 ack-lab-m03！
# K8s 自动在另一个节点上重建了被驱逐的 Pod

kubectl get nodes
# ack-lab-m02   Ready,SchedulingDisabled    ← 已排空，可以安全维护

# === 维护完成后，恢复节点 ===
kubectl uncordon ack-lab-m02

# 清理
kubectl delete deployment drain-test
```

**drain 的生产场景**：
- 节点系统升级 → drain → 升级 → uncordon
- 节点硬件维修 → drain → 关机 → 修好 → 开机 → uncordon
- K8s 版本升级 → 逐个 drain 节点 → 升级 kubelet → uncordon

### 12.5 小结

| 操作 | 命令 | 效果 | 场景 |
|------|------|------|------|
| 禁止调度 | `kubectl cordon <node>` | 新 Pod 不再调度到此节点 | 准备维护 |
| 恢复调度 | `kubectl uncordon <node>` | 恢复接受新 Pod | 维护完成 |
| 排空节点 | `kubectl drain <node>` | 驱逐所有 Pod + 禁止调度 | 维护前 |
| 添加标签 | `kubectl label node <node> key=value` | 控制调度目标 | 节点分类 |

---

## 13. Taints、Tolerations 与调度约束

> 你已经注意到 Master 节点不跑普通 Pod —— 这就是 Taint（污点）的效果。理解 Taint + Toleration + Affinity 是掌握 K8s 调度的关键。

### 13.1 什么是 Taint 和 Toleration

```
Taint（污点）：贴在节点上，"排斥"没有对应 Toleration 的 Pod
Toleration（容忍）：写在 Pod spec 中，"容忍"指定的 Taint

比喻：
  节点挂了个牌子"有毒"（taint）
  只有带了"防毒面具"（toleration）的 Pod 才能调度上去
```

### 13.2 查看已有 Taint

```bash
# 查看 Master 节点的 Taint
kubectl describe node ack-lab | grep -A3 Taints
# Taints: node-role.kubernetes.io/control-plane:NoSchedule
#   ↑ 这就是为什么普通 Pod 不会调度到 Master 上

# Worker 节点默认没有 Taint
kubectl describe node ack-lab-m02 | grep -A3 Taints
# Taints: <none>
```

### 13.3 Taint 实战

```bash
# 给 Worker 2 加个 Taint
kubectl taint nodes ack-lab-m03 env=production:NoSchedule

# 现在部署 Pod，只会调度到 ack-lab-m02
kubectl create deployment taint-test --image=nginx --replicas=3
kubectl get pods -o wide -l app=taint-test
# 全部在 ack-lab-m02 上！ack-lab-m03 因为 Taint 被排斥了
kubectl delete deployment taint-test
```

### 13.4 Toleration 实战

```yaml
# 创建 toleration-demo.yaml — 带容忍的 Pod 可以调度到有 Taint 的节点
apiVersion: apps/v1
kind: Deployment
metadata:
  name: toleration-test
spec:
  replicas: 4
  selector:
    matchLabels:
      app: toleration-test
  template:
    metadata:
      labels:
        app: toleration-test
    spec:
      containers:
      - name: nginx
        image: nginx
      tolerations:                              # 容忍 env=production 的 Taint
      - key: "env"
        operator: "Equal"
        value: "production"
        effect: "NoSchedule"
```

```bash
kubectl apply -f toleration-demo.yaml
kubectl get pods -o wide -l app=toleration-test
# Pod 均匀分布在 ack-lab-m02 和 ack-lab-m03 上
# 因为带了 toleration，可以"容忍" ack-lab-m03 的 taint

# 清理
kubectl delete -f toleration-demo.yaml
kubectl taint nodes ack-lab-m03 env=production:NoSchedule-   # 删除 Taint（注意末尾的减号）
```

### 13.5 Taint Effect 三种类型

| Effect | 行为 |
|--------|------|
| `NoSchedule` | 新 Pod 不调度到此节点（已有 Pod 不受影响） |
| `PreferNoSchedule` | 尽量不调度，但资源不足时仍然可以 |
| `NoExecute` | 新 Pod 不调度 + 已有不容忍的 Pod 被驱逐 |

### 13.6 Node Affinity（节点亲和性）

比 nodeSelector 更强大的调度约束：

```yaml
# affinity-demo.yaml — Pod 优先调度到 ssd 节点
apiVersion: v1
kind: Pod
metadata:
  name: affinity-demo
spec:
  containers:
  - name: nginx
    image: nginx
  affinity:
    nodeAffinity:
      # 硬性要求：必须满足（类似 nodeSelector）
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: kubernetes.io/os
            operator: In
            values: ["linux"]
      # 软性偏好：优先满足，不满足也行
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 80
        preference:
          matchExpressions:
          - key: disk-type
            operator: In
            values: ["ssd"]
```

```bash
# 先给节点加标签
kubectl label node ack-lab-m02 disk-type=ssd

kubectl apply -f affinity-demo.yaml
kubectl get pod affinity-demo -o wide
# 优先调度到 ack-lab-m02（有 ssd 标签）

# 清理
kubectl delete pod affinity-demo
kubectl label node ack-lab-m02 disk-type-
```

---

## 14. RBAC 权限控制

> RBAC（Role-Based Access Control）控制"谁能对什么资源做什么操作"。多人协作、多租户隔离的基础。

### 14.1 RBAC 四个核心概念

```
Role / ClusterRole        ← 定义"能做什么"（权限集合）
RoleBinding / ClusterRoleBinding  ← 把权限绑定给"谁"

Role           → 命名空间级别（只在某个 namespace 生效）
ClusterRole    → 集群级别（跨 namespace 生效）
RoleBinding    → 在指定 namespace 中绑定
ClusterRoleBinding → 全集群绑定
```

### 14.2 查看已有的 RBAC 规则

```bash
# K8s 内置了很多 ClusterRole
kubectl get clusterroles | head -20

# 常用的内置角色
kubectl get clusterrole admin -o yaml | head -30     # 管理员
kubectl get clusterrole view -o yaml | head -30      # 只读
kubectl get clusterrole edit -o yaml | head -30      # 编辑
```

### 14.3 实战：创建只读用户

```yaml
# 创建 rbac-demo.yaml

# Step 1: 创建一个 ServiceAccount（代表一个"用户"）
apiVersion: v1
kind: ServiceAccount
metadata:
  name: readonly-user
  namespace: default
---
# Step 2: 创建 Role（只允许 get/list/watch pods 和 services）
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: default
rules:
- apiGroups: [""]                  # 核心 API 组
  resources: ["pods", "services"]  # 可操作的资源
  verbs: ["get", "list", "watch"]  # 允许的操作（只读）
---
# Step 3: 把 Role 绑定给 ServiceAccount
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: readonly-binding
  namespace: default
subjects:
- kind: ServiceAccount
  name: readonly-user
  namespace: default
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl apply -f rbac-demo.yaml

# 用 readonly-user 的身份测试（--as 模拟用户）
# 可以查看 Pod ✅
kubectl get pods --as=system:serviceaccount:default:readonly-user

# 不能删除 Pod ❌
kubectl delete pod nginx --as=system:serviceaccount:default:readonly-user
# Error: pods "nginx" is forbidden: User ... cannot delete resource "pods"

# 不能查看 Secrets ❌
kubectl get secrets --as=system:serviceaccount:default:readonly-user
# Error: secrets is forbidden

# 清理
kubectl delete -f rbac-demo.yaml
```

### 14.4 RBAC 最佳实践

| 原则 | 说明 |
|------|------|
| 最小权限 | 只给需要的权限，不用 `cluster-admin` |
| 按命名空间隔离 | 不同团队用不同 namespace + RoleBinding |
| 用 ClusterRole + RoleBinding 复用 | 定义一次 ClusterRole，在多个 namespace 中 RoleBinding |
| 审计 | `kubectl auth can-i --list --as=<user>` 检查某用户的权限 |

```bash
# 实用命令：检查某用户能做什么
kubectl auth can-i --list --as=system:serviceaccount:default:readonly-user
# 输出所有该用户有权限的操作
```

---

## 15. etcd 备份与恢复

> etcd 是 K8s 的"唯一数据库"，所有集群状态都存在里面。etcd 丢了 = 集群丢了。生产环境**必须**有 etcd 备份策略。

### 15.1 etcd 是什么

```
etcd 存储的内容：
  - 所有 Namespace、Pod、Service、Deployment 等资源定义
  - ConfigMap、Secret 数据
  - RBAC 规则
  - 集群配置

etcd 不存储的：
  - 容器镜像（在节点的 containerd 中）
  - Pod 日志（在节点文件系统中）
  - PV 中的实际数据（在存储后端中）
```

### 15.2 在 minikube 中操作 etcd

```bash
# SSH 进 Master 节点
minikube ssh -p ack-lab -n ack-lab

# etcd 以静态 Pod 方式运行，查看其容器
sudo crictl ps | grep etcd

# 查看 etcd 数据目录
sudo ls /var/lib/etcd/member/

exit
```

### 15.3 备份 etcd

```bash
# 方法 1：通过 kubectl exec 进入 etcd Pod 执行备份
ETCD_POD=$(kubectl get pods -n kube-system -l component=etcd -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n kube-system $ETCD_POD -- sh -c \
  'ETCDCTL_API=3 etcdctl snapshot save /var/lib/etcd/backup.db \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key'

# 验证备份
kubectl exec -n kube-system $ETCD_POD -- sh -c \
  'ETCDCTL_API=3 etcdctl snapshot status /var/lib/etcd/backup.db --write-table'

# 把备份拷贝出来（可选）
kubectl cp kube-system/$ETCD_POD:/var/lib/etcd/backup.db ./etcd-backup.db
```

### 15.4 恢复 etcd（概念了解）

> 在 minikube 中恢复不太实际（重建更快）。但生产环境恢复流程如下：

```bash
# 生产环境 etcd 恢复步骤（概念说明，不在 minikube 上执行）：
# 1. 停止 kube-apiserver（避免写入）
# 2. 用备份恢复 etcd 数据
#    ETCDCTL_API=3 etcdctl snapshot restore backup.db \
#      --data-dir=/var/lib/etcd-restore
# 3. 替换 etcd 数据目录
# 4. 重启 etcd 和 kube-apiserver
# 5. 验证集群状态
```

### 15.5 生产备份策略建议

| 策略 | 建议 |
|------|------|
| 频率 | 每小时或每次重大变更前 |
| 存储 | 备份到集群外（S3/OSS/独立机器），不只存在 etcd 所在节点 |
| 保留 | 最近 7 天每小时 + 每月一份保留 3 个月 |
| 自动化 | CronJob 或系统级 cron 定时执行 |
| 验证 | 定期用备份做恢复演练 |

**阿里云 ACK**：托管版 ACK 的 etcd 由阿里云自动备份和管理，你不需要操心。但自建集群必须自己做。

---

## 16. K8s 生态组件安装与运维

> K8s 裸跑只有基础编排能力。生产环境需要搭配成熟的生态组件才能形成完整的运维体系。本章按优先级介绍最重要的组件。

### 16.0 组件全景与优先级

```
Tier 1（必装，先学）：
  Helm          → 包管理器，安装后续组件的前提
  Prometheus    → 监控指标采集
  Grafana       → 监控可视化
  Loki          → 日志收集
  cert-manager  → TLS 证书自动管理

Tier 2（推荐，按需）：
  Kustomize        → YAML overlay 管理
  ArgoCD           → GitOps 持续部署
  External Secrets → 外部密钥管理
  VPA              → 垂直 Pod 自动伸缩

Tier 3（进阶，了解）：
  Istio / Linkerd  → Service Mesh
  OPA / Gatekeeper → 策略引擎
  Velero           → 集群备份（比 etcd 备份更全面）
```

### 16.1 Helm — K8s 包管理器（必装前置）

> Helm 之于 K8s 就像 apt/brew 之于操作系统。几乎所有生态组件都通过 Helm 安装。

#### 安装 Helm

```bash
brew install helm

# 验证
helm version
# version.BuildInfo{Version:"v3.x.x", ...}
```

#### Helm 核心概念

| 概念 | 类比 | 说明 |
|------|------|------|
| Chart | brew formula / apt package | 一个应用的打包模板 |
| Repository | brew tap / apt source | Chart 的存储仓库 |
| Release | 安装后的实例 | 一个 Chart 可以装多个 Release |
| Values | 配置参数 | 安装时自定义配置（覆盖默认值） |

#### 基本操作

```bash
# 添加常用仓库
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add jetstack https://charts.jetstack.io
helm repo update

# 搜索 Chart
helm search repo nginx
helm search repo prometheus

# 查看 Chart 的可配置项
helm show values bitnami/nginx | head -50

# 安装（以 nginx 为例）
helm install my-nginx bitnami/nginx \
  --set service.type=NodePort \
  --namespace demo --create-namespace

# 查看已安装的 Release
helm list -A
# NAME      NAMESPACE   STATUS     CHART
# my-nginx  demo        deployed   nginx-x.x.x

# 查看 Release 的实际资源
kubectl get all -n demo

# 升级（修改配置）
helm upgrade my-nginx bitnami/nginx \
  --set replicaCount=3 \
  --namespace demo

# 回滚
helm rollout undo 不支持，用：
helm rollback my-nginx 1    # 回滚到 revision 1

# 查看历史
helm history my-nginx -n demo

# 卸载
helm uninstall my-nginx -n demo
kubectl delete namespace demo
```

#### 用 values 文件管理配置（推荐）

```yaml
# 创建 my-values.yaml（比 --set 更清晰）
replicaCount: 2
service:
  type: NodePort
  port: 80
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 200m
    memory: 256Mi
```

```bash
helm install my-nginx bitnami/nginx -f my-values.yaml -n demo --create-namespace
```

### 16.2 Prometheus + Grafana — 监控体系（必装）

> Prometheus 采集指标，Grafana 可视化展示。这是 K8s 生态事实标准的监控方案。

#### 一键安装 kube-prometheus-stack

```bash
# 这个 Chart 包含：Prometheus + Grafana + AlertManager + 一堆预配置仪表盘
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  --set prometheus.prometheusSpec.retention=7d \
  --set grafana.adminPassword=admin123

# 等待所有 Pod 就绪（可能需要 3-5 分钟）
kubectl get pods -n monitoring -w
# 预期看到：
# prometheus-monitoring-kube-prometheus-prometheus-0   Running
# monitoring-grafana-xxx                              Running
# monitoring-kube-state-metrics-xxx                   Running
# alertmanager-monitoring-kube-prometheus-alertmanager-0 Running
# monitoring-prometheus-node-exporter-xxx (每个节点一个) Running
```

#### 组件说明

| 组件 | 作用 |
|------|------|
| **Prometheus** | 定期拉取（scrape）各组件的 /metrics 端点，存储时序数据 |
| **Grafana** | Web 仪表盘，可视化 Prometheus 数据 |
| **AlertManager** | 告警路由和通知（邮件/Slack/钉钉） |
| **kube-state-metrics** | 将 K8s 资源状态转换为 Prometheus 指标 |
| **node-exporter** | 采集节点级指标（CPU/内存/磁盘/网络），DaemonSet 部署 |

#### 访问 Grafana

```bash
# 方式 1：port-forward（推荐，简单）
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80

# 浏览器打开 http://localhost:3000
# 用户名：admin，密码：admin123（安装时设置的）

# 方式 2：NodePort
kubectl patch svc monitoring-grafana -n monitoring -p '{"spec":{"type":"NodePort"}}'
minikube service monitoring-grafana -n monitoring -p ack-lab
```

#### 预装仪表盘

安装后 Grafana 已经预配了十几个仪表盘：

| 仪表盘 | 看什么 |
|--------|--------|
| Kubernetes / Compute Resources / Cluster | 集群整体 CPU/内存使用率 |
| Kubernetes / Compute Resources / Namespace (Pods) | 按命名空间看 Pod 资源消耗 |
| Kubernetes / Compute Resources / Node (Pods) | 按节点看 Pod 分布和资源 |
| Node Exporter / Nodes | 节点级系统指标（磁盘 IO、网络流量） |
| CoreDNS | DNS 查询量、延迟、错误率 |
| etcd | etcd 性能指标 |

#### Prometheus 查询示例（PromQL）

```bash
# 进入 Prometheus Web UI
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090
# 浏览器打开 http://localhost:9090
```

```
# 常用 PromQL 查询：
# 集群 CPU 使用率
sum(rate(node_cpu_seconds_total{mode!="idle"}[5m])) / sum(machine_cpu_cores) * 100

# 各节点内存使用率
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Pod 重启次数（排查不稳定的 Pod）
kube_pod_container_status_restarts_total > 0

# 某个 Deployment 的 Pod 数量
kube_deployment_status_replicas{deployment="nginx"}
```

#### 日常运维要点

```bash
# 查看 Prometheus 正在监控哪些目标
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090
# 浏览器 http://localhost:9090/targets

# 检查告警规则
kubectl get prometheusrules -n monitoring

# 查看当前告警
kubectl port-forward svc/monitoring-kube-prometheus-alertmanager -n monitoring 9093:9093
# 浏览器 http://localhost:9093
```

### 16.3 Loki + Promtail — 日志收集（必装）

> Prometheus 管指标，Loki 管日志。配合 Grafana 实现"指标 + 日志"统一查看。

#### 安装 Loki Stack

```bash
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --set promtail.enabled=true \
  --set grafana.enabled=false    # 复用已有的 Grafana

# 查看组件
kubectl get pods -n monitoring -l app.kubernetes.io/name=loki
kubectl get pods -n monitoring -l app.kubernetes.io/name=promtail
# promtail 是 DaemonSet，每个节点一个 Pod，负责收集该节点上所有容器的日志
```

#### 在 Grafana 中查看日志

```bash
# 1. 打开 Grafana（http://localhost:3000）
# 2. 左侧菜单 → Connections → Data Sources → Add data source
# 3. 选择 Loki，URL 填 http://loki:3100
# 4. 点 Save & Test

# 5. 左侧菜单 → Explore → 选数据源 Loki
# 6. 查询示例：
#    {namespace="default"}                    ← default 命名空间所有日志
#    {namespace="kube-system", app="coredns"} ← CoreDNS 日志
#    {pod="nginx-xxx"} |= "error"            ← 某个 Pod 中包含 error 的日志
```

#### Loki vs EFK/ELK

| | Loki + Promtail | EFK (Elasticsearch + Fluentd + Kibana) |
|---|---|---|
| 资源占用 | 极低（Loki 只索引标签，不索引全文） | 高（ES 全文索引吃内存） |
| 安装复杂度 | 简单 | 较复杂 |
| 查询能力 | 按标签过滤 + grep（够用） | 全文搜索（更强） |
| 适合 | 中小规模、minikube 学习 | 大规模生产、复杂查询需求 |

### 16.4 cert-manager — TLS 证书自动管理

> 有 HTTPS 需求时必装。自动申请和续期 Let's Encrypt 证书，或管理自签名证书。

#### 安装

```bash
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set crds.enabled=true

# 验证
kubectl get pods -n cert-manager
# cert-manager-xxx                Running
# cert-manager-cainjector-xxx     Running
# cert-manager-webhook-xxx        Running
```

#### 核心概念

```
Issuer / ClusterIssuer    ← 证书颁发者（从哪里获取证书）
Certificate               ← 证书请求（需要什么证书）
CertificateRequest        ← 内部处理流程
Secret                    ← 证书最终存储位置（TLS 类型的 Secret）
```

#### 创建自签名证书（学习用）

```yaml
# 创建 cert-demo.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned-issuer
spec:
  selfSigned: {}
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: demo-cert
  namespace: default
spec:
  secretName: demo-tls          # 证书存到这个 Secret 中
  duration: 2160h               # 90 天
  renewBefore: 360h             # 到期前 15 天自动续期
  issuerRef:
    name: selfsigned-issuer
    kind: ClusterIssuer
  dnsNames:
  - demo.local
  - "*.demo.local"
```

```bash
kubectl apply -f cert-demo.yaml

# 查看证书状态
kubectl get certificate demo-cert
# NAME        READY   SECRET     AGE
# demo-cert   True    demo-tls   10s    ← True 表示证书已签发

# 查看生成的 Secret
kubectl get secret demo-tls
# 包含 tls.crt 和 tls.key

# 在 Ingress 中使用：
# spec:
#   tls:
#   - hosts:
#     - demo.local
#     secretName: demo-tls    ← 引用这个 Secret

# 清理
kubectl delete -f cert-demo.yaml
```

#### 生产环境用 Let's Encrypt

```yaml
# 生产环境的 ClusterIssuer（概念了解，minikube 上无法验证域名）
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v2.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
    - http01:
        ingress:
          class: nginx
```

### 16.5 Metrics Server — 资源指标（HPA 依赖）

> 第 10.7 步已通过 addon 安装。这里补充它的工作原理和运维要点。

```bash
# 验证 Metrics Server 运行状态
kubectl get deployment metrics-server -n kube-system
kubectl top nodes     # 能返回数据说明正常
kubectl top pods -A   # 查看所有 Pod 的资源使用

# Metrics Server 工作原理：
# kubelet 内置 cAdvisor → 采集容器资源指标
# Metrics Server → 定期从各节点 kubelet 拉取指标 → 聚合
# kubectl top / HPA → 从 Metrics Server API 读取

# 常见问题
# kubectl top 返回 "error: metrics not available yet"
# → Metrics Server 刚启动需要 1-2 分钟采集数据
# → 或者 Metrics Server Pod 有问题：kubectl logs -n kube-system -l k8s-app=metrics-server
```

### 16.6 Kustomize — YAML Overlay 管理

> K8s 原生支持（kubectl 内置），不需要额外安装。适合管理同一应用在不同环境的差异配置。

```
目录结构：
base/                     ← 基础配置（所有环境共用）
  deployment.yaml
  service.yaml
  kustomization.yaml
overlays/
  dev/                    ← 开发环境覆盖
    kustomization.yaml    ← 1 副本，低资源
  prod/                   ← 生产环境覆盖
    kustomization.yaml    ← 3 副本，高资源，加 HPA
```

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- deployment.yaml
- service.yaml
```

```yaml
# overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
patches:
- patch: |-
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: my-app
    spec:
      replicas: 1
namePrefix: dev-
namespace: dev
```

```bash
# 预览生成的 YAML（不实际部署）
kubectl kustomize overlays/dev

# 部署
kubectl apply -k overlays/dev

# Kustomize vs Helm：
# Helm：适合安装第三方组件（有 Chart 生态）
# Kustomize：适合管理自己的应用配置（轻量、原生支持）
# 两者可以配合使用
```

### 16.7 ArgoCD — GitOps 持续部署（推荐）

> "Git 仓库就是单一事实来源"。push 代码 → ArgoCD 自动部署到 K8s。

#### 安装

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm install argocd argo/argo-cd \
  --namespace argocd --create-namespace \
  --set server.service.type=NodePort

# 等待就绪
kubectl get pods -n argocd -w

# 获取初始管理员密码
kubectl get secret argocd-initial-admin-secret -n argocd \
  -o jsonpath='{.data.password}' | base64 -d
echo  # 换行

# 访问 ArgoCD UI
minikube service argocd-server -n argocd -p ack-lab
# 用户名 admin，密码是上面获取的
```

#### 核心概念

```
Application  ← ArgoCD 中的核心对象
  ├─ Source: Git 仓库地址 + 路径（YAML/Helm/Kustomize 文件在哪）
  └─ Destination: K8s 集群 + Namespace（部署到哪）

工作流：
  Git Push → ArgoCD 检测变更 → 对比当前集群状态 → 自动/手动 Sync → 部署
```

#### 日常运维

```bash
# CLI 工具（可选安装）
brew install argocd

# 查看所有 Application
argocd app list

# 手动同步
argocd app sync my-app

# 查看同步状态
argocd app get my-app
```

### 16.8 其他值得了解的组件

| 组件 | 用途 | 何时需要 |
|------|------|---------|
| **Velero** | 集群级备份恢复（比 etcd 备份更全面，含 PV 数据） | 灾备需求 |
| **External Secrets Operator** | 从 AWS Secrets Manager / 阿里云 KMS 同步密钥到 K8s Secret | 密钥不想放 git |
| **Istio / Linkerd** | Service Mesh，服务间流量管理、可观测性、mTLS | 微服务架构进阶 |
| **OPA Gatekeeper** | 策略引擎，强制执行集群使用规范（如必须有资源限制） | 多团队共用集群 |
| **Vertical Pod Autoscaler (VPA)** | 自动调整 Pod 的 requests/limits（与 HPA 互补） | 不确定资源需求时 |
| **Ingress-nginx 高级配置** | 限流、跨域、灰度发布、自定义错误页 | Ingress 进阶需求 |
| **MetalLB** | 裸机环境的 LoadBalancer 实现（minikube tunnel 的替代） | 非云环境生产部署 |

### 16.9 生态组件运维检查清单

日常运维时定期检查：

```bash
# === 监控体系 ===
kubectl get pods -n monitoring                  # Prometheus/Grafana/Loki 都在跑
kubectl top nodes                               # 指标采集正常
# Grafana 仪表盘无数据？→ 检查 Prometheus targets 页面

# === 证书 ===
kubectl get certificates -A                     # 所有证书 READY=True
kubectl get certificaterequests -A              # 无 Failed 状态
# 证书即将过期？→ cert-manager 应自动续期，检查 cert-manager 日志

# === Ingress ===
kubectl get ingress -A                          # Ingress 规则正常
kubectl get pods -n ingress-nginx              # Controller Running
# 503 错误？→ 检查后端 Service 和 Pod 是否正常

# === GitOps（如果装了 ArgoCD）===
kubectl get applications -n argocd             # 所有 App 状态 Synced/Healthy
# OutOfSync？→ argocd app sync <app-name>
```

---

## 17. 日常启停流程

### 17.1 开始工作

```bash
# 1. 插上移动硬盘，等 Finder 显示 K8sLab 图标

# 2. 启动 Docker Desktop（点击 Dock 里的图标，等绿灯）

# 3. 启动 minikube
minikube start -p ack-lab

# 4. 验证
kubectl get nodes
```

### 17.2 结束工作

```bash
# 1. 停止 minikube（保留数据，下次启动很快）
minikube stop -p ack-lab

# 2. 退出 Docker Desktop（可选，省内存）

# 3. 安全弹出移动硬盘
diskutil eject /dev/disk2
# 或在 Finder 里点弹出按钮
```

### 17.3 启停耗时参考

| 操作 | 首次 | 后续 |
|------|------|------|
| `minikube start` | 5-15 分钟（下载镜像） | 30-60 秒 |
| `minikube stop` | 10-20 秒 | 10-20 秒 |
| `minikube delete` | 几秒 | — |

### ⚠️ 重要：不要在 minikube 运行时拔硬盘！

必须先 `minikube stop` → 再弹出硬盘。否则会导致数据损坏，需要 `minikube delete` 重建。

---

## 18. 常见问题排查

### 11.1 Pod 一直 Pending

```bash
# 查看原因
kubectl describe pod <pod-name>

# 常见原因：
# - Insufficient cpu/memory → 减少 Pod 的 requests 或增加 minikube 资源
# - No nodes available → minikube 没启动或状态异常
```

### 18.2 Pod 状态 CrashLoopBackOff

```bash
# 查看日志
kubectl logs <pod-name>
kubectl logs <pod-name> --previous  # 查看上一次崩溃的日志

# 常见原因：
# - 应用本身报错（配置错误、缺少环境变量）
# - OOMKilled（内存不够，加大 limits）
```

### 18.3 Pod 状态 ImagePullBackOff

```bash
# 查看详情
kubectl describe pod <pod-name> | grep -A5 Events

# 常见原因：
# - 镜像名写错
# - 国内拉 Docker Hub 超时 → 用阿里云镜像加速
# - 私有镜像没配 imagePullSecrets
```

### 18.4 minikube start 失败

```bash
# 查看日志
minikube logs -p ack-lab

# 核弹选项：删除重建
minikube delete -p ack-lab
# 然后重新执行第 6 步的 minikube start 命令
```

### 18.5 Docker Desktop 占内存太多

```bash
# 查看 Docker 资源使用
docker stats --no-stream

# 清理未使用的镜像/容器（释放磁盘）
docker system prune -a
# ⚠️ 这会删除所有未使用的镜像，minikube 镜像也会被删
# 需要重新 minikube start 拉取
```

### 18.6 kubectl 连接不上集群

```bash
# 确认当前 context
kubectl config current-context
# 应该显示 ack-lab

# 如果不对，切换
kubectl config use-context ack-lab

# 确认 minikube 在运行
minikube status -p ack-lab
```

### 18.7 移动硬盘 IO 慢导致操作卡顿

这是外接硬盘的固有缺陷。缓解方式：
- 使用 USB 3.0 及以上接口（确认线缆支持）
- 避免同时跑太多 Pod
- 如果是机械硬盘，考虑换 SSD 移动硬盘

---

## 19. 清理与卸载

### 19.1 删除集群（保留工具）

```bash
minikube delete -p ack-lab
```

### 19.2 完全卸载

```bash
# 删除所有 minikube 集群
minikube delete --all --purge

# 卸载 minikube
brew uninstall minikube

# 删除移动硬盘上的数据
rm -rf /Volumes/K8sLab/minikube
rm -rf /Volumes/K8sLab/docker-data

# 删除环境变量（编辑 ~/.zshrc，删除 MINIKUBE_HOME 那行）

# 可选：卸载 Docker Desktop
# 从应用程序文件夹拖到废纸篓
```

---

## 附录 A：与阿里云 ACK 的对齐清单

| 配置项 | minikube (本地) | ACK (云上) | 一致？ |
|--------|----------------|-----------|--------|
| K8s 版本 | v1.35.1 | v1.35 | ✅ |
| 容器运行时 | containerd | containerd | ✅ |
| 节点数 | 3（1 Master + 2 Worker） | 多节点 | ✅ 架构一致 |
| 网络插件 | **Calico** | Flannel/Calico/Terway | ✅ Calico 一致 |
| NetworkPolicy | 支持（Calico） | 支持 | ✅ |
| CoreDNS | 默认安装 | 默认安装 | ✅ |
| 存储 | hostPath / local | 云盘 ESSD | ⚠️ 不同 |
| Ingress | nginx-ingress (addon) | ALB/Nginx Ingress | ✅ 基本一致 |
| 负载均衡 | NodePort / minikube tunnel | SLB/ALB | ⚠️ 不同 |
| 监控 | Prometheus+Grafana (Helm) | ARMS / 自建 Prometheus | ✅ 方案一致 |
| 日志 | Loki (Helm) | SLS / 自建 EFK | ⚠️ 方案不同，概念一致 |
| 证书管理 | cert-manager (Helm) | cert-manager / 云证书 | ✅ |
| RBAC | 完整支持 | 完整支持 + RAM 集成 | ✅ |
| etcd 备份 | 手动 etcdctl | 托管版自动备份 | ⚠️ 托管版无需操心 |

**核心的 K8s API、kubectl 操作、多节点调度、网络策略、Deployment/Service/Ingress、RBAC、生态组件等在本地和云上完全一致。** 存储和负载均衡的差异是本地 vs 云的固有差异，不影响学习 K8s 核心能力。

## 附录 B：推荐学习顺序（对照文档章节）

| 阶段 | 练什么 | 对应 K8s 概念 | 文档章节 |
|------|--------|-------------|---------|
| 1 | 理解架构全貌 | Master/Worker/CNI/etcd | 第 0 章 |
| 2 | 搭建多节点集群 | Cluster, Node, Control Plane | 第 6 章 |
| 3 | 安装和理解网络插件 | CNI, Calico, NetworkPolicy | 第 7 章 |
| 4 | 理解集群 DNS | CoreDNS, 服务发现, DNS 排障 | 第 8 章 |
| 5 | 验证每个系统组件 | apiserver/scheduler/kubelet/proxy | 第 9 章 |
| 6 | 部署 nginx，暴露访问 | Deployment, Service, NodePort | 10.1-10.2 |
| 7 | 写 YAML，apply/delete | 声明式管理 | 10.6 |
| 8 | 扩缩容 + 滚动更新回滚 | ReplicaSet, Rolling Update | 10.3 + 10.8 |
| 9 | 配置管理 | ConfigMap, Secret | 10.9 |
| 10 | 持久化存储 | PV, PVC, StorageClass | 10.10 |
| 11 | 健康检查 | livenessProbe, readinessProbe | 10.11 |
| 12 | HTTP 路由 | Ingress, Ingress Controller | 10.12 |
| 13 | 自动伸缩 | HPA (Horizontal Pod Autoscaler) | 10.13 |
| 14 | 工作负载类型 | DaemonSet, StatefulSet, Job, CronJob | 第 11 章 |
| 15 | 节点运维 | cordon, drain, uncordon, label | 第 12 章 |
| 16 | 调度约束 | Taint, Toleration, Affinity | 第 13 章 |
| 17 | 权限控制 | RBAC, Role, RoleBinding | 第 14 章 |
| 18 | 网络策略 | NetworkPolicy (deny/allow) | 7.10 |
| 19 | 命名空间隔离 | Namespace | 10.15 |
| 20 | etcd 备份 | etcdctl snapshot, 灾备策略 | 第 15 章 |
| 21 | 安装 Helm | 包管理器，后续组件的前提 | 16.1 |
| 22 | 搭建监控体系 | Prometheus + Grafana | 16.2 |
| 23 | 搭建日志收集 | Loki + Promtail | 16.3 |
| 24 | 证书管理 | cert-manager, TLS | 16.4 |
| 25 | GitOps 部署 | ArgoCD / Kustomize | 16.6-16.7 |
| 26 | **部署自己的应用到 K8s** | Dockerfile → 推镜像 → 部署 | 下一步实战 |

## 附录 C：有用的命令速查

```bash
# === 集群管理 ===
minikube start -p ack-lab          # 启动
minikube stop -p ack-lab           # 停止
minikube status -p ack-lab         # 状态
minikube delete -p ack-lab         # 删除
minikube dashboard -p ack-lab      # 打开仪表板
minikube ssh -p ack-lab            # SSH 进节点

# === 查看资源 ===
kubectl get nodes                  # 节点列表
kubectl get pods                   # Pod 列表（当前命名空间）
kubectl get pods -A                # Pod 列表（所有命名空间）
kubectl get deploy,svc,ingress     # 多种资源一起看
kubectl get events --sort-by=.lastTimestamp  # 最近事件
kubectl top nodes                  # 节点资源使用（需 metrics-server）
kubectl top pods                   # Pod 资源使用

# === 排查问题 ===
kubectl describe pod <name>        # Pod 详情（看 Events 部分）
kubectl logs <name>                # Pod 日志
kubectl logs <name> -f             # 实时日志
kubectl logs <name> --previous     # 上次崩溃的日志
kubectl exec -it <name> -- sh     # 进入容器

# === DNS 排查 ===
kubectl exec <pod> -- nslookup kubernetes.default  # 测试 DNS 解析
kubectl exec <pod> -- cat /etc/resolv.conf         # 查看 DNS 配置
kubectl logs -n kube-system -l k8s-app=kube-dns    # CoreDNS 日志

# === 部署操作 ===
kubectl apply -f xxx.yaml          # 部署/更新
kubectl delete -f xxx.yaml         # 删除
kubectl scale deploy <name> --replicas=3  # 扩缩容
kubectl rollout status deploy <name>      # 查看发布状态
kubectl rollout undo deploy <name>        # 回滚

# === 节点运维 ===
kubectl cordon <node>              # 禁止调度到此节点
kubectl uncordon <node>            # 恢复调度
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data  # 排空节点
kubectl label node <node> key=value   # 添加标签
kubectl taint nodes <node> key=value:NoSchedule   # 添加污点
kubectl taint nodes <node> key=value:NoSchedule-  # 删除污点

# === RBAC ===
kubectl auth can-i --list                    # 当前用户能做什么
kubectl auth can-i --list --as=<user>        # 某用户能做什么
kubectl get roles,rolebindings -A            # 查看所有角色和绑定

# === Helm ===
helm repo update                   # 更新仓库
helm list -A                       # 查看所有已安装的 Release
helm install <name> <chart>        # 安装
helm upgrade <name> <chart>        # 升级
helm rollback <name> <revision>    # 回滚
helm uninstall <name>              # 卸载

# === 监控 ===
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80       # Grafana
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090  # Prometheus

# === 清理 ===
kubectl delete deploy,svc --all    # 删除当前命名空间所有 deploy 和 svc
docker system prune -a             # 清理 Docker 缓存（慎用）
```
