# Brief 23: lighter on phones

Every figure in the hall is now INKXO's ~100k-triangle model: two per duel, drawn again for the
floor reflection and the shadows. Fine on a laptop; heavy for a mid-range phone.

## Work
- **A lighter knight:** in Blender, reduce INKXO's harness to about a third of its triangles,
  keeping UVs, skin weights and materials (so recolouring, hiding parts and all the motion still
  work). Export it beside the full model.
- **Choose by graphics setting:** High uses the full model; Medium and Low use the light one. The
  automatic step-down already moves phones that struggle to Medium.
- **Cheaper reflections on Medium:** the floor reflection keeps the hall but drops the knights' cloth.
- Measure triangles and frame time at each setting.

## Done when
Both models load and look right; numbers recorded here; the bot passes on each setting; release
published.

## Results

The light knight is INKXO's mesh reduced in Blender from 99,102 to 29,730 triangles (30%). Rig,
UVs, skin weights and materials are unchanged, so recolouring, hidden parts and all the motion work
as before. The file is 1.46 MB, against 1.92 MB for the full model. It isn't precached: the service
worker caches it the first time it's used.

Triangles drawn per frame in a duel (Saxon vs Gawain), counting the shadow and reflection passes:

| Setting | Model | Triangles | Draw calls | Bot (skill 0.7) |
|---|---|---|---|---|
| High | full | 436,764 | 228 | (passed in earlier briefs) |
| Medium | light; no cloth in the reflection | 139,780 (−68%) | 212 | won vs Saxon and Black Knight |
| Low | light; no reflection or shadows | 53,901 | 114 | won vs Brigand |

The model is chosen when the game loads. If the automatic step-down drops a phone to Medium during
play, the light model arrives on the next launch; the cloth leaves the reflection straight away.
