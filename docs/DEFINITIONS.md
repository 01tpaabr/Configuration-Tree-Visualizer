# Glossary: symbol to code

| Symbol | Meaning | Code |
|---|---|---|
| `A`, `D` | label alphabet, data domain | `PNode.label`, `PNode.data` |
| `N`, `→` | possible nodes, skeleton child relation | `Skeleton.byId`, `Skeleton.childIds` |
| `r` | skeleton root | `PDocument.root` |
| `d(v)`, `pa(v)` | depth, parent in skeleton | `Skeleton.depth`, `Skeleton.parent` |
| `ch(x)`, `ch(S)` | children of a node / of a configuration | `ch(nodeId)`, `chOfConfig(ids)` |
| `C`, `S` | a configuration (subset of `N`) | `NodeId[]`, document-ordered |
| `⇒` | `S ⇒ S′ ⟺ S′ ⊆ ch(S)` | `subsetsOf(chOfConfig(...))` |
| `T`, `V(T)` | configuration tree, its vertices | `CfgVertex` graph |
| `π = (S₀,…,S_k)` | a vertex = a descent | `CfgVertex.path` |
| `cfg(π)` | configuration at `π` | `CfgVertex.cfg` |
| `lv(σ)` | cone: leaves below `σ` | `leavesBelow(key)` |
| `PD(v)` | conditional existence probability | `PNode.prob` |
| `↓(π′,π)` | child-step probability | `CfgVertex.stepProb` |
| `μ_π` | leaf distribution from `π` | `leafDist(key)` |
| `μ_π(lv(σ))` | cone measure / reach probability | `CfgVertex.reachProb` |
| `nodes(τ)` | possible document at a leaf | `nodesOf(leaf)` |
| `E_v` | existence event of `v` | `existenceProb(v)` returns `μ(E_v)` |
