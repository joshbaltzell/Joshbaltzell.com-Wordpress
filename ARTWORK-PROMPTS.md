# Interview Artwork Prompts

All featured images should share a consistent watercolor/editorial illustration style
matching the site's palette. Upload at **2400 x 1350px (16:9)** — WordPress will
generate the smaller sizes automatically.

## Recommended Tools

| Tool | Why |
|------|-----|
| **Midjourney v6+** | Best quality. Use `--sref` (style reference) after generating one ideal image to lock in the brand look for all subsequent images. Use `--ar 16:9`. |
| **DALL-E 3 (ChatGPT)** | Good for quick iteration. Less style consistency across batches. |
| **Stable Diffusion (SDXL/Flux)** | Full control + batch generation. Use IP-Adapter to enforce style consistency. |

## Workflow

1. Generate image #19 first (the "meta" interview — it sets the brand look)
2. If using Midjourney, save its `--sref` hash
3. Generate all remaining images using that style reference
4. Export at 2400x1350px, save as JPG (quality 85-90%)

---

## Base Prompt (include in every generation)

```
Watercolor-style editorial illustration, soft washes of deep indigo (#2C3E6B) and
warm terracotta (#C4785B) with sage green (#7A9E7E) and soft plum (#8B6BA3) accents,
on warm ivory paper texture (#FAF8F5). Loose brushstrokes, visible paper grain,
contemporary art style. Abstract and evocative — no text, no faces, no photographs.
16:9 aspect ratio.
```

---

## Per-Article Prompts

### 1. "Clean Code Was More About People Than Machines"
```
[base prompt] Two interweaving streams of geometric shapes — one rigid and mechanical,
one organic and flowing — converging into a harmonious pattern. Subtle grid lines
dissolving into watercolor washes. Suggests collaboration and clarity emerging from chaos.
```

### 2. "Debugging My Worst Production Outage at 2 AM"
```
[base prompt] A dark indigo nightscape with scattered points of warm terracotta light,
like stars or signal fires. One bright golden point cuts through the darkness — a
single thread of clarity in tangled, overlapping geometric forms. Tension and resolution.
```

### 3. "Most Technical Interviews Are Broken"
```
[base prompt] A fractured geometric structure — clean lines broken into uneven segments,
some pieces floating away. A new organic shape grows through the cracks, sage green
vines threading through rigid blue architecture. Deconstruction and rebuilding.
```

### 4. "The Tools I Can't Live Without"
```
[base prompt] An artist's workbench seen from above — abstract shapes suggesting tools,
brushes, instruments. Some objects glow with warm terracotta; others are faded and
ghostly. A curated collection, lovingly arranged. Depth and texture.
```

### 5. "Building for Scale When You're a Team of One"
```
[base prompt] A single small figure (abstract, geometric) standing before a vast
architectural blueprint that extends to the horizon. The blueprint is rendered in
translucent indigo washes. The figure casts a long, confident shadow. Ambition and solitude.
```

### 6. "AI as a Collaborator, Not a Replacement"
```
[base prompt] Two abstract hands — one rendered in watercolor washes, one in clean
geometric lines — reaching toward each other across the canvas. The space between them
pulses with overlapping circles of sage green and plum. Partnership and synergy.
```

### 7. "The Open Source Project That Changed How I Think"
```
[base prompt] A vast network of interconnected nodes, like a constellation map. Each
node is a watercolor splash of different intensity. Lines connect them in organic,
web-like patterns. One central node radiates outward in concentric rings. Community and influence.
```

### 8. "The Side Project That Accidentally Became a Business"
```
[base prompt] A small seed-like shape in the corner of the canvas, sprouting unexpected
branches that fill the entire frame. The branches shift from delicate sage green near
the root to bold terracotta and indigo at the edges. Organic, unplanned growth.
```

### 9. "What Nobody Tells You About Pricing Your Own Work"
```
[base prompt] Abstract balance scales rendered in loose watercolor — one side holds a
dense, heavy mass of indigo; the other holds a small but radiant golden-terracotta
shape. The scales are perfectly balanced despite the visual mismatch. Value and perception.
```

### 10. "My Framework for Deciding What to Build Next"
```
[base prompt] Multiple diverging pathways extending from a single point, each rendered
in a different color from the palette. Some paths are bold and clear; others fade into
mist. A compass rose floats overhead in translucent plum. Decision and direction.
```

### 11. "Lessons From Failing Fast"
```
[base prompt] Shattered geometric forms scattered across the canvas like broken pottery.
Among the fragments, new shapes are assembling — imperfect, asymmetric, but beautiful.
Gold-tinted terracotta fills the cracks like kintsugi. Breakage and renewal.
```

### 12. "Remote Work Destroyed My Routine"
```
[base prompt] A grid pattern that starts rigid and orderly on the left, then dissolves
into fluid watercolor in the middle, then reconstitutes into a new, more organic grid
on the right. Three phases of structure. Dissolution and reinvention.
```

### 13. "The Best Businesses Solve Problems the Founder Has"
```
[base prompt] A mirror-like reflection — an abstract figure on one side of a vertical
divide, and the same figure transformed into an architectural structure on the other
side. The two halves share the same colors but different forms. Self and creation.
```

### 14. "The Negotiation That Taught Me Everything"
```
[base prompt] Two large abstract shapes facing each other across a narrow gap — one
deep indigo, one warm terracotta. Where they almost touch, their colors bleed and mix
into a rich plum. A bridge of overlapping watercolor washes. Dialogue and compromise.
```

### 15. "The Book That Rewired My Brain"
```
[base prompt] An open book shape at the center, its pages fanning outward into waves
of color that ripple across the entire canvas. Each ripple shifts hue — indigo to
sage to terracotta. Ideas radiating outward like sound waves. Transformation through knowledge.
```

### 16. "On Being a Generalist in a World That Rewards Specialists"
```
[base prompt] A prismatic shape at the center refracting a single beam of light into
many colored streams — each stream a different discipline or direction. The streams
are diverse but all originate from the same source. Breadth and origin.
```

### 17. "What Running Taught Me About Software"
```
[base prompt] Rhythmic, repetitive marks suggesting footsteps or a heartbeat pulse —
alternating between indigo and terracotta. The pattern builds intensity from left to
right, gaining energy and momentum. Horizontal lines like a horizon. Discipline and rhythm.
```

### 18. "The Conversation That Changed My Mind"
```
[base prompt] Two overlapping speech-bubble shapes, one in cool indigo and one in warm
terracotta, creating a rich blended area where they intersect. Inside the overlap,
small geometric shapes suggest new ideas forming. Exchange and evolution.
```

### 19. "Why I Started Having AI Interview Me"
```
[base prompt] A figure sitting across from a luminous, abstract geometric form — like
a conversation between the organic and the digital. Soft watercolor meets precise lines.
A mirror between them reflects both shapes merged into one. Self-reflection through technology.
```

### 20. "What I Want to Be True About My Work in Ten Years"
```
[base prompt] A long road or river rendered in translucent indigo, winding toward a
distant horizon where warm terracotta and golden light gather. The foreground is detailed
and textured; the horizon is soft and luminous. Journey and aspiration.
```

---

## Midjourney-Specific Tips

- After generating #19, run: `/describe` on your favorite result to extract Midjourney's interpretation
- Use `--sref [image_url]` on all subsequent prompts to enforce style consistency
- Add `--style raw` if results are too polished — you want visible paper texture
- Use `--no text, words, letters, face, photo, realistic` to keep it abstract
- Typical full command:
  ```
  /imagine [full prompt] --ar 16:9 --sref [your_ref] --style raw --no text words letters face photo realistic --v 6.1
  ```
