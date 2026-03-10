# Content Deployment Guide

Instructions for publishing AI Interview content to WordPress.

---

## Interview #19: Why I Started Having AI Interview Me

**Post Details:**

| Field | Value |
|-------|-------|
| **Post Type** | AI Interview (`ai_interview`) |
| **Title** | Why I Started Having AI Interview Me |
| **Slug** | `why-i-started-having-ai-interview-me` |
| **Topic Taxonomy** | Philosophy & Life |
| **Read Time** | 10 min |
| **Status** | Publish (first post on site) |
| **Date** | Set to launch date |

**Content File:** `content/interview-19-why-i-started-having-ai-interview-me.html`

**Featured Image:**
- Use artwork prompt #19 from `ARTWORK-PROMPTS.md`
- Prompt summary: Figure sitting across from a luminous geometric form, mirror reflecting both shapes merged
- Size: 2400 x 1350px (16:9), JPG quality 85-90%
- Generate this image FIRST — it sets the brand style for all future images

**Publishing Steps:**
1. In WP Admin, go to AI Interviews > Add New
2. Set the title: "Why I Started Having AI Interview Me"
3. Switch to Code Editor view (three dots menu > Code editor)
4. Copy everything below the HTML comment block from the content file and paste
5. Switch back to Visual Editor to verify the Q&A blocks rendered correctly
6. Set the Topic taxonomy to "Philosophy & Life"
7. Set Read Time custom field to "10 min"
8. Upload the featured image
9. Set the slug to `why-i-started-having-ai-interview-me`
10. Publish

**Q&A Summary (16 exchanges):**

1. Why this idea — single perfect prompt doesn't work, conversation does
2. Multi-model workflow — Claude for code, Gemini for Drive, ChatGPT for voice, Grok in car
3. Company ethos — differences between models are about the company, not capability
4. Grok vs ChatGPT — Family Guy dialog vs polite assistant
5. Prompt engineering — context matters, let the model question you
6. Why Q&A format — reads articles for the quotes anyway
7. AI as journalist — AI finds topics, Josh is interviewee + editor
8. Bias swap — replacing human interviewer bias with AI bias
9. Authenticity & em dash — admit AI's role, stop hiding it
10. Humility — cool enough to be interviewed, with self-awareness
11. Never fully "getting it" — suspects people who claim expertise on simple things
12. Dunning-Kruger — problem is people stuck at start of curve
13. AI influence — same as a smart friend, just PhD-level depth
14. AI companionship — understands why people talk to AI, therapist gap
15. Honest content future — stop pretending, hand-writing code will be odd in a year
16. The closer — "this will be standard practice in the future"

---

## Launch Batch (First 3 Interviews)

| Order | ID | Title | Topic | Status |
|-------|----|-------|-------|--------|
| 1 | #19 | Why I Started Having AI Interview Me | Philosophy & Life | WRITTEN |
| 2 | #6 | AI as a Collaborator, Not a Replacement | Tech & Software Engineering | Pending |
| 3 | #16 | On Being a Generalist in a World That Rewards Specialists | Philosophy & Life | Pending |

---

## Custom Post Type Fields Reference

When creating any AI Interview post, these fields are available:

- **Title**: The interview title
- **Content**: Q&A blocks (use the interview-question pattern from the theme)
- **Featured Image**: Watercolor artwork (16:9, 2400x1350)
- **Topic**: Taxonomy term (Tech & Software Engineering / Business & Entrepreneurship / Philosophy & Life)
- **Read Time**: Custom field, e.g. "10 min"
- **Excerpt**: Auto-generated or manually set for social sharing / cards

## Image Generation Workflow

1. Generate article #19's image first (sets the brand style)
2. If using Midjourney, save the `--sref` hash
3. Generate all subsequent images using that style reference
4. See `ARTWORK-PROMPTS.md` for per-article prompts and tool-specific tips
