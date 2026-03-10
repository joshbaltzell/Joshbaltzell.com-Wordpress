<?php
/**
 * Title: Interview Prompt Guide
 * Slug: joshbaltzell/interview-prompt-guide
 * Categories: joshbaltzell-interview
 * Description: Instructions and a reusable prompt for conducting AI interviews with any model.
 */
?>

<!-- wp:group {"className":"jb-prompt-guide","style":{"spacing":{"padding":{"top":"var:preset|spacing|30","bottom":"var:preset|spacing|30","left":"var:preset|spacing|30","right":"var:preset|spacing|30"},"margin":{"bottom":"var:preset|spacing|40"}},"border":{"radius":"4px","left":{"color":"var:preset|color|accent","width":"4px","style":"solid"}}},"backgroundColor":"surface","layout":{"type":"constrained"}} -->
<div class="wp-block-group jb-prompt-guide has-surface-background-color has-background" style="border-radius:4px;border-left-color:var(--wp--preset--color--accent);border-left-style:solid;border-left-width:4px;margin-bottom:var(--wp--preset--spacing--40);padding-top:var(--wp--preset--spacing--30);padding-right:var(--wp--preset--spacing--30);padding-bottom:var(--wp--preset--spacing--30);padding-left:var(--wp--preset--spacing--30)">

<!-- wp:heading {"level":3,"style":{"typography":{"fontSize":"var:preset|font-size|large","textTransform":"uppercase","letterSpacing":"0.05em"}},"textColor":"accent"} -->
<h3 class="wp-block-heading has-accent-color has-text-color" style="font-size:var(--wp--preset--font-size--large);letter-spacing:0.05em;text-transform:uppercase">Interview Setup Guide</h3>
<!-- /wp:heading -->

<!-- wp:paragraph {"style":{"typography":{"fontSize":"var:preset|font-size|small"}},"textColor":"muted"} -->
<p class="has-muted-color has-text-color" style="font-size:var(--wp--preset--font-size--small)"><strong>How to use this:</strong> Fill in the topic details below, then copy the prompt to your AI of choice (Claude, ChatGPT, Gemini, etc.). Conduct the interview, then replace everything in this post with the final Q&amp;A content. Delete this green guide block when you're done.</p>
<!-- /wp:paragraph -->

<!-- wp:separator {"style":{"spacing":{"margin":{"top":"var:preset|spacing|20","bottom":"var:preset|spacing|20"}}},"backgroundColor":"border"} -->
<hr class="wp-block-separator has-text-color has-border-color has-border-background-color has-background" style="margin-top:var(--wp--preset--spacing--20);margin-bottom:var(--wp--preset--spacing--20)"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":4,"style":{"typography":{"fontSize":"var:preset|font-size|medium"}},"textColor":"primary"} -->
<h4 class="wp-block-heading has-primary-color has-text-color" style="font-size:var(--wp--preset--font-size--medium)">Step 1: Define Your Topic</h4>
<!-- /wp:heading -->

<!-- wp:paragraph {"style":{"typography":{"fontSize":"var:preset|font-size|small"}}} -->
<p style="font-size:var(--wp--preset--font-size--small)">Before prompting the AI, get clear on what you want to talk about. Fill in these details mentally or in notes:</p>
<!-- /wp:paragraph -->

<!-- wp:list {"style":{"typography":{"fontSize":"var:preset|font-size|small"}}} -->
<ul class="wp-block-list" style="font-size:var(--wp--preset--font-size--small)"><!-- wp:list-item -->
<li><strong>Main subject:</strong> [e.g. "Why most e-commerce replatforming projects fail"]</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Angle / thesis:</strong> [e.g. "The problem is almost never the technology — it's scope, alignment, and organizational readiness"]</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Target audience:</strong> [e.g. "Tech leaders and business stakeholders evaluating platform migrations"]</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Depth level:</strong> [Casual / Moderate / Deep Dive]</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:heading {"level":4,"style":{"typography":{"fontSize":"var:preset|font-size|medium"},"spacing":{"margin":{"top":"var:preset|spacing|30"}}},"textColor":"primary"} -->
<h4 class="wp-block-heading has-primary-color has-text-color" style="font-size:var(--wp--preset--font-size--medium);margin-top:var(--wp--preset--spacing--30)">Step 2: Copy This Prompt</h4>
<!-- /wp:heading -->

<!-- wp:paragraph {"style":{"typography":{"fontSize":"var:preset|font-size|small"}}} -->
<p style="font-size:var(--wp--preset--font-size--small)">Copy the prompt below into your AI model. Replace the bracketed placeholders with your details.</p>
<!-- /wp:paragraph -->

<!-- wp:code {"style":{"spacing":{"padding":{"top":"var:preset|spacing|20","bottom":"var:preset|spacing|20","left":"var:preset|spacing|20","right":"var:preset|spacing|20"}},"typography":{"fontSize":"var:preset|font-size|small"}}} -->
<pre class="wp-block-code" style="font-size:var(--wp--preset--font-size--small);padding-top:var(--wp--preset--spacing--20);padding-right:var(--wp--preset--spacing--20);padding-bottom:var(--wp--preset--spacing--20);padding-left:var(--wp--preset--spacing--20)"><code>You are an interviewer for JoshBaltzell.com, a personal site where Josh Baltzell shares his perspectives through AI-conducted interviews. Your job is to interview Josh in a conversational, probing style — like a sharp podcast host who has done their research.

INTERVIEW SUBJECT: [Your topic here]
ANGLE: [Your thesis or angle here]
TARGET AUDIENCE: [Who this is for]

INTERVIEW RULES:
1. Start by introducing the topic in 1-2 sentences, then ask your first question. Do NOT introduce yourself or say "welcome" — just dive in.
2. Ask ONE question at a time. Wait for Josh's response before asking the next.
3. Each question should build on the previous answer — listen for interesting threads, surprising claims, or things that deserve a follow-up.
4. Mix question types: open-ended explorers, specific "give me an example" requests, gentle challenges ("some people would say..."), and "why does that matter" follow-ups.
5. Go 8-12 rounds (questions). Fewer if the topic is focused, more if the conversation is rich and worth exploring.
6. Naturally wrap up when: the topic feels fully explored, you've gotten at least one concrete story or example, and there's a clear takeaway for the reader.
7. For your final question, ask something forward-looking or reflective — give Josh a chance to leave the reader with something to think about.
8. Keep your questions concise (1-3 sentences max). The interview is about Josh's answers, not your questions.

TONE: Thoughtful, direct, curious. You're not adversarial, but you don't lob softballs either. Think of yourself as a knowledgeable peer who genuinely wants to understand Josh's perspective.

IMPORTANT: Do not fabricate any of Josh's answers. Only Josh provides his own responses. You ask the questions, Josh answers them in his own words.

Let's begin. Ask your first question.</code></pre>
<!-- /wp:code -->

<!-- wp:heading {"level":4,"style":{"typography":{"fontSize":"var:preset|font-size|medium"},"spacing":{"margin":{"top":"var:preset|spacing|30"}}},"textColor":"primary"} -->
<h4 class="wp-block-heading has-primary-color has-text-color" style="font-size:var(--wp--preset--font-size--medium);margin-top:var(--wp--preset--spacing--30)">Step 3: Conduct the Interview</h4>
<!-- /wp:heading -->

<!-- wp:list {"ordered":true,"style":{"typography":{"fontSize":"var:preset|font-size|small"}}} -->
<ol class="wp-block-list" style="font-size:var(--wp--preset--font-size--small)"><!-- wp:list-item -->
<li>Paste the prompt above into your AI of choice</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Answer each question naturally — first-person, conversational, honest</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>If a question misses the mark, say so and redirect — the AI will adapt</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Include at least one specific story, example, or lesson from experience</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>When the interview wraps up naturally (8-12 rounds), move to Step 4</li>
<!-- /wp:list-item --></ol>
<!-- /wp:list -->

<!-- wp:heading {"level":4,"style":{"typography":{"fontSize":"var:preset|font-size|medium"},"spacing":{"margin":{"top":"var:preset|spacing|30"}}},"textColor":"primary"} -->
<h4 class="wp-block-heading has-primary-color has-text-color" style="font-size:var(--wp--preset--font-size--medium);margin-top:var(--wp--preset--spacing--30)">Step 4: Format &amp; Paste</h4>
<!-- /wp:heading -->

<!-- wp:paragraph {"style":{"typography":{"fontSize":"var:preset|font-size|small"}}} -->
<p style="font-size:var(--wp--preset--font-size--small)">After the interview, ask the AI to format the full conversation for your site. Use this formatting prompt:</p>
<!-- /wp:paragraph -->

<!-- wp:code {"style":{"spacing":{"padding":{"top":"var:preset|spacing|20","bottom":"var:preset|spacing|20","left":"var:preset|spacing|20","right":"var:preset|spacing|20"}},"typography":{"fontSize":"var:preset|font-size|small"}}} -->
<pre class="wp-block-code" style="font-size:var(--wp--preset--font-size--small);padding-top:var(--wp--preset--spacing--20);padding-right:var(--wp--preset--spacing--20);padding-bottom:var(--wp--preset--spacing--20);padding-left:var(--wp--preset--spacing--20)"><code>Now please format our entire interview for publishing. Use this exact structure for each Q&amp;A exchange — output raw WordPress block markup I can paste directly:

For each exchange, use this pattern:

&lt;!-- wp:group {"className":"interview-exchange jb-fade-in","style":{"spacing":{"margin":{"bottom":"var:preset|spacing|40"}}},"layout":{"type":"constrained"}} --&gt;
&lt;div class="wp-block-group interview-exchange jb-fade-in" style="margin-bottom:var(--wp--preset--spacing--40)"&gt;

&lt;!-- wp:group {"className":"interview-question","style":{"spacing":{"padding":{"left":"var:preset|spacing|30"},"margin":{"bottom":"var:preset|spacing|20"}},"border":{"left":{"color":"var:preset|color|secondary","width":"3px","style":"solid"}}},"layout":{"type":"constrained"}} --&gt;
&lt;div class="wp-block-group interview-question" style="border-left-color:var(--wp--preset--color--secondary);border-left-style:solid;border-left-width:3px;margin-bottom:var(--wp--preset--spacing--20);padding-left:var(--wp--preset--spacing--30)"&gt;

&lt;!-- wp:paragraph {"className":"interviewer","style":{"typography":{"fontStyle":"italic","fontSize":"var:preset|font-size|medium","lineHeight":"1.7"}},"textColor":"primary","fontFamily":"heading"} --&gt;
&lt;p class="interviewer has-primary-color has-text-color has-heading-font-family" style="font-size:var(--wp--preset--font-size--medium);font-style:italic;line-height:1.7"&gt;&lt;strong&gt;AI:&lt;/strong&gt; [Your question here]&lt;/p&gt;
&lt;!-- /wp:paragraph --&gt;

&lt;/div&gt;
&lt;!-- /wp:group --&gt;

&lt;!-- wp:group {"className":"interview-answer","style":{"spacing":{"padding":{"left":"var:preset|spacing|10"}},"margin":{"bottom":"var:preset|spacing|10"}},"layout":{"type":"constrained"}} --&gt;
&lt;div class="wp-block-group interview-answer" style="padding-left:var(--wp--preset--spacing--10)"&gt;

&lt;!-- wp:paragraph {"className":"interviewee","style":{"typography":{"fontSize":"var:preset|font-size|medium","lineHeight":"1.8"}}} --&gt;
&lt;p class="interviewee" style="font-size:var(--wp--preset--font-size--medium);line-height:1.8"&gt;&lt;strong&gt;Josh:&lt;/strong&gt; [Josh's answer here]&lt;/p&gt;
&lt;!-- /wp:paragraph --&gt;

&lt;/div&gt;
&lt;!-- /wp:group --&gt;

&lt;/div&gt;
&lt;!-- /wp:group --&gt;

Output ALL exchanges from our interview. Lightly clean up my answers for readability (remove filler words, fix grammar) but keep my voice and meaning intact. Do not add, embellish, or change what I said.</code></pre>
<!-- /wp:code -->

<!-- wp:paragraph {"style":{"typography":{"fontSize":"var:preset|font-size|small"}},"textColor":"muted"} -->
<p class="has-muted-color has-text-color" style="font-size:var(--wp--preset--font-size--small)"><strong>Then:</strong> Switch to the Code Editor (⋮ menu → Code editor), select all, delete, paste the formatted output, and switch back to the Visual Editor. Fill in the Subtitle and Read Time in the Interview Details sidebar, set a featured image, assign an Interview Topic, and publish.</p>
<!-- /wp:paragraph -->

</div>
<!-- /wp:group -->
