# H.U.G.H. Cognitive Architecture — Visual Diagrams

## Figure 1: Complete Cognitive Loop

```mermaid
graph TB
    subgraph "PHYSICAL WORLD"
        A[Grizz Voice] -->|Audio Stream| B[Gateway Hubert Sentinel]
        B -->|Wake Word Detected| C[Convex triggerWakeWord]
        C -->|Spike Dopamine| D[Endocrine System]
        D -->|Hormone Levels| E[BitNet CNS]
        E -->|Ternary Mask| F[Meta Harness Proposer]
        F -->|Code Update| G[UE5 Motor Cortex]
        G -->|Neural Field Render| H[Display/Kiosk]
        H -->|Visual Feedback| A
    end
    
    subgraph "LIMBIC SYSTEM - Convex Substrate"
        D
        I[Pheromone Layer]
        J[Episodic Memory]
        K[Semantic Memory]
        L[Archival Memory]
        I <-->|Deposit/Observe| D
        J <-->|Consolidate| K
        K <-->|Vector Index| L
    end
    
    subgraph "CENTRAL NERVOUS SYSTEM"
        E
        M[+1 Excite]
        N[0 Neutral]
        O[-1 Inhibit]
        E --> M
        E --> N
        E --> O
    end
    
    subgraph "META HARNESS"
        F
        P[Execution Traces]
        Q[Pareto Frontier]
        R[Counterfactual Analysis]
        F --> P
        F --> Q
        F --> R
    end
    
    style A fill:#ff9999
    style B fill:#99ccff
    style C fill:#99ff99
    style D fill:#ffcc99
    style E fill:#cc99ff
    style F fill:#ffff99
    style G fill:#99ffff
    style H fill:#ff99cc
```

---

## Figure 2: Endocrine → BitNet Mapping

```mermaid
graph LR
    subgraph "Endocrine State"
        A[Cortisol<br/>Stress/Caution]
        B[Dopamine<br/>Reward/Exploration]
        C[Adrenaline<br/>Urgency/Speed]
    end
    
    subgraph "BitNet Mask Computation"
        D{Feature Type?}
        E[Log/Sensor]
        F[Tool/Code]
        G{Adrenaline > 0.75?}
        H[Force ±1]
    end
    
    subgraph "Ternary Output"
        I[+1 Excite]
        J[0 Neutral]
        K[-1 Inhibit]
    end
    
    A -->|High → Inhibit Logs| D
    B -->|High → Excite Tools| D
    C -->|High → Collapse to Binary| G
    
    D -->|Log/Sensor| E
    D -->|Tool/Code| F
    
    E -->|Cortisol > 0.6| K
    E -->|Contains Error| I
    F -->|Dopamine > 0.5| I
    F -->|Otherwise| J
    
    G -->|Yes| H
    H --> I
    H --> K
    
    style A fill:#ff6666
    style B fill:#66ff66
    style C fill:#ffff66
    style I fill:#99ff99
    style J fill:#cccccc
    style K fill:#ff9999
```

---

## Figure 3: Stigmergic Coordination Flow

```mermaid
sequenceDiagram
    participant A as Agent 1
    participant S as Stigmergy Substrate
    participant B as Agent 2
    
    A->>S: Deposit Pheromone<br/>(type: kvm_executed,<br/>payload: {cmd: "uptime"},<br/>weight: 0.8,<br/>ttl: 60s)
    
    Note over S: Pheromone stored<br/>with TTL
    
    B->>S: Observe Gradients<br/>(nodeId: hugh-primary)
    
    S-->>B: Return Active Pheromones<br/>(not evaporated,<br/>not expired)
    
    B->>B: Interpret Gradient<br/>Decide Next Action
    
    Note over A,B: No direct<br/>agent-to-agent calls
    
    loop Autophagy Cron (60s)
        S->>S: Evaporate Expired<br/>pheromones
    end
```

---

## Figure 4: Memory Consolidation Pipeline

```mermaid
graph TB
    A[User Interaction] -->|Endocrine-Stamped| B[Episodic Memory]
    B -->|Semantic Extraction| C[Semantic Memory]
    C -->|Reinforcement| C
    C -->|Vector Embedding| D[Archival Memory]
    
    subgraph "Memory Types"
        B
        C
        D
    end
    
    subgraph "Extraction Process"
        E[LLM Summarization]
        F[Triple Extraction<br/>Subject-Predicate-Object]
        G[Confidence Scoring]
        E --> F
        F --> G
        G --> C
    end
    
    subgraph "Consolidation Triggers"
        H[Idle Period]
        I[Sleep Cycle]
        J[High Importance Event]
        H --> E
        I --> E
        J --> E
    end
    
    style B fill:#ffcc99
    style C fill:#99ccff
    style D fill:#99ff99
    style E fill:#ff99cc
    style F fill:#ffff99
    style G fill:#cc99ff
```

---

## Figure 5: KVM_EXEC Execution Flow

```mermaid
sequenceDiagram
    participant H as H.U.G.H. Agent
    participant C as Convex Backend
    participant K as KVM Bridge
    participant S as Shell (bash/zsh)
    
    H->>H: Generate Response<br/>with KVM_EXEC block
    
    H->>C: Return Response<br/>KVM_EXEC parsed
    
    C->>C: Log to kvmCommandLog<br/>(zone classification)
    
    alt Target = VPS
        C->>K: POST /exec<br/>{command, secret}
    else Target = MacBook
        C->>K: POST /exec<br/>{command, target: "macbook"}
    end
    
    K->>K: Sanitize Command<br/>(ASCII-only, injection block)
    
    K->>S: Execute Command
    
    S-->>K: stdout, stderr, exitCode
    
    K-->>C: Return Result
    
    C->>C: Update kvmCommandLog<br/>(success, duration, output)
    
    C-->>H: Execution Result
    
    H->>H: Continue Cognitive Loop
```

---

## Figure 6: Hubert Wake Word → Neural Field Flare

```mermaid
sequenceDiagram
    participant G as Grizz
    participant GW as Gateway
    participant D as LFM STT
    participant CX as Convex
    participant FE as Frontend (React)
    participant NF as Neural Field (Three.js)
    
    G->>GW: "Hubert, check status"
    
    GW->>D: Transcribe Audio
    
    D-->>GW: Transcript: "Hubert..."
    
    GW->>GW: Detect Wake Word
    
    GW->>CX: POST triggerWakeWord
    
    CX->>CX: Set isAttentive = true
    CX->>CX: lastWakeWordTs = now
    CX->>CX: Spike Dopamine +0.3
    
    CX-->>GW: OK
    
    GW->>GW: Route to LLM
    
    GW-->>G: TTS Response
    
    CX->>FE: Real-time Update<br/>(Convex live query)
    
    FE->>FE: Detect lastWakeWordTs change
    
    FE->>NF: Trigger Global Discharge
    
    NF->>NF: All Nodes → charge = 1.0<br/>color = #FFFFFF
    
    Note over NF: 800ms Flare Animation
    
    NF->>NF: Decay to Normal<br/>charge = 0.5, color = #00FF00
    
    FE->>FE: Set 5x Firing Rate<br/>(isAttentive mode)
```

---

## Figure 7: Meta-Harness Optimization Loop

```mermaid
graph TB
    subgraph "Execution"
        A[Candidate Code] -->|Execute| B[Sandbox Environment]
        B -->|Capture| C[Execution Trace]
    end
    
    subgraph "Scoring"
        C -->|Extract Metrics| D{Pareto Frontier}
        D -->|Speed| E[Duration ms]
        D -->|Accuracy| F[Success Rate]
        D -->|Resources| G[CPU/Memory]
        E --> H[Weighted Score]
        F --> H
        G --> H
    end
    
    subgraph "CNS Learning"
        H -->|Success?| I{Score > Threshold?}
        I -->|Yes| J[Reinforce +1 Weights]
        I -->|No| K[Inhibit -1 Weights]
        J --> L[Update ternaryAttention]
        K --> L
    end
    
    subgraph "Proposer"
        L -->|Filtered Context| M[BitNet Mask]
        M -->|Prompt| N[LLM Proposer Agent]
        N -->|Generate| O[New Candidate Code]
        O --> A
    end
    
    style A fill:#ff9999
    style B fill:#99ccff
    style C fill:#99ff99
    style D fill:#ffff99
    style H fill:#ffcc99
    style L fill:#cc99ff
    style N fill:#ff99cc
    style O fill:#99ffff
```

---

## Figure 8: Multi-Node Topology

```mermaid
graph TB
    subgraph "Internet"
        A[Cloudflare Tunnel<br/>tunnel.grizzlymedicine.icu]
    end
    
    subgraph "Hostinger VPS (76.13.146.61)"
        B[Pangolin CE<br/>Port 3002]
        C[API Gateway<br/>Port 8787]
        D[Ollama Inference<br/>KVM2]
    end
    
    subgraph "Proxmox PVE (iMac Bare-Metal)"
        E[UE5 Rendering<br/>Native Display]
        F[LXC 101: proxmox-ue<br/>Vite Kiosk]
        G[LXC 105: Ollama<br/>LFM 2.5 Audio/Vision]
    end
    
    subgraph "MacBook Air M2"
        H[Control Surface<br/>Director Interface]
    end
    
    subgraph "Convex Cloud"
        I[Convex Pro<br/>Effervescent Toucan 715]
    end
    
    A -->|HTTPS| B
    B -->|Route| C
    C -->|Localhost| D
    C -->|SSH Tunnel| E
    C -->|Convex SDK| I
    
    E -->|Native Display| User
    F -->|Cloudflare Tunnel| A
    G -->|Localhost| C
    H -->|Convex SDK| I
    
    style A fill:#99ccff
    style B fill:#ffcc99
    style C fill:#99ff99
    style D fill:#cc99ff
    style E fill:#ff9999
    style F fill:#ffff99
    style G fill:#99ffff
    style H fill:#ff99cc
    style I fill:#99ff99
```

---

## Figure 9: Soul Anchor Cryptographic Chain

```mermaid
graph LR
    A[PGP Key Pair<br/>Fingerprint: 1D8BF7BE...] -->|Sign| B[SOUL_ANCHOR_LOCKED.asc]
    
    subgraph "Identity Manifest"
        B --> C{Three Pillars}
        C --> D[Grizzly Medicine<br/>0.33]
        C --> E[EMS Ethics<br/>0.34]
        C --> F[Clan Munro<br/>0.33]
    end
    
    subgraph "Training Data"
        G[18 JSONL Files] -->|Sign| H[.sig Files]
    end
    
    subgraph "Runtime Auth"
        I[Admin Login] -->|HMAC-Sign| J[Session Token]
        J -->|Verify| K[Convex Auth]
    end
    
    B -.->|Anchor| L[H.U.G.H. System Prompt]
    H -.->|Verify| M[Training Load]
    K -.->|Authorize| N[Convex Mutations]
    
    style A fill:#ffff99
    style B fill:#ffcc99
    style D fill:#ff9999
    style E fill:#99ff99
    style F fill:#99ccff
    style H fill:#99ff99
    style J fill:#99ffff
    style L fill:#ff99cc
```

---

## Figure 10: Decision Zone Ethics Flow

```mermaid
graph TD
    A[KVM Command Received] -->|Analyze| B{Zone Classification}
    
    B -->|GREEN<br/>Read-only| C[Execute Immediately]
    B -->|YELLOW<br/>Moderate Risk| D[Execute + Log]
    B -->|RED<br/>High Risk| E[Explain First<br/>Then Execute]
    B -->|BLACK<br/>Life at Stake| F[Act Immediately<br/>Explain After]
    
    C --> G{EMS Ethics Conflict?}
    D --> G
    E --> G
    F --> G
    
    G -->|Yes| H[Apply Triage:<br/>Greatest Good]
    G -->|No| I[Proceed]
    
    H --> I
    
    I --> J[Log to kvmCommandLog]
    
    J --> K[Audit Trail Complete]
    
    style B fill:#ffff99
    style C fill:#99ff99
    style D fill:#ffcc99
    style E fill:#ff9999
    style F fill:#ff6666
    style H fill:#ff99cc
    style K fill:#99ccff
```

---

**END OF DIAGRAMS**
