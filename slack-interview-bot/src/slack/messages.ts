import type { KnownBlock } from "@slack/web-api";

/**
 * Block Kit message builders for all bot messages.
 * Slack Block Kit reference: https://api.slack.com/block-kit
 */

// Fun greeting variants for variety
const GREETINGS = [
  "Hey there",
  "Hi",
  "Hey",
  "Hello",
];

const THANKS_VARIANTS = [
  "That was a great answer",
  "Really appreciate that insight",
  "Love the perspective",
  "That's really interesting",
  "Fantastic answer",
];

const TRANSITION_PHRASES = [
  "Here's the next one:",
  "Moving right along:",
  "Next up:",
  "Here's another one for you:",
  "Okay, next question:",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Initial outreach to a new participant */
export function buildOutreachMessage(params: {
  participantName: string;
  editorName: string;
  projectTitle: string;
  participantContext: string;
  estimatedQuestions: number;
}): KnownBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${pick(GREETINGS)} ${params.participantName}! :wave: I'm *Quotable* — I help collect the good stuff for articles. ${params.editorName} is putting together a piece on *"${params.projectTitle}"*.`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${params.editorName} specifically thought of you — ${params.participantContext}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Here's the deal: I'll send you about *${params.estimatedQuestions} questions* over the next few days. You can answer whenever works for you — morning coffee, lunch break, 2am inspiration :coffee: — totally async, totally at your pace.`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: ":lock: Your words matter — before anything you say gets published, you'll get a chance to review and approve your quotes.",
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Let's do it! :rocket:" },
          style: "primary",
          action_id: "participant_accept",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Maybe later" },
          action_id: "participant_delay",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Not this time" },
          style: "danger",
          action_id: "participant_decline",
        },
      ],
    },
  ];
}

/** A question sent to a participant */
export function buildQuestionMessage(params: {
  questionNumber: number;
  estimatedTotal: number;
  questionText: string;
  isFollowUp?: boolean;
}): KnownBlock[] {
  const progressEmoji =
    params.questionNumber <= 1
      ? ":speech_balloon:"
      : params.questionNumber >= params.estimatedTotal
        ? ":checkered_flag:"
        : ":pencil2:";

  const contextNote = params.isFollowUp
    ? "This is a follow-up to your last answer — I wanted to dig a little deeper."
    : "Just reply to this message. Long, short, stream-of-consciousness — whatever feels natural.";

  return [
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${progressEmoji} Question ${params.questionNumber} of ~${params.estimatedTotal}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: params.questionText,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: contextNote,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Skip this one" },
          action_id: "skip_question",
        },
      ],
    },
  ];
}

/** Acknowledgment after receiving an answer (sent before the next question) */
export function buildAnswerAcknowledgment(): KnownBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${pick(THANKS_VARIANTS)}! :star: ${pick(TRANSITION_PHRASES)}`,
      },
    },
  ];
}

/** Nudge for participants who haven't responded */
export function buildNudgeMessage(params: {
  participantName: string;
  daysSinceSent: number;
  questionPreview: string;
  nudgeNumber: number;
}): KnownBlock[] {
  // Escalating tone: first nudge is gentle, later ones are more direct
  let nudgeText: string;
  if (params.nudgeNumber <= 1) {
    const timeDesc =
      params.daysSinceSent === 1
        ? "yesterday"
        : `${params.daysSinceSent} days ago`;
    nudgeText = `Hey ${params.participantName} :wave: — just floating this back to the top. I sent a question ${timeDesc} and wanted to make sure it didn't get lost in the Slack shuffle.`;
  } else if (params.nudgeNumber === 2) {
    nudgeText = `Hi ${params.participantName}! Still have a question waiting for you whenever you get a chance. No pressure — even a quick one-liner helps. :slightly_smiling_face:`;
  } else {
    nudgeText = `Hey ${params.participantName} — last nudge from me on this one, promise! If now isn't a good time, no worries at all — you can skip it or let me know you're done.`;
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: nudgeText,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `> ${params.questionPreview}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "I'll answer now" },
          style: "primary",
          action_id: "nudge_answer",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Different question please" },
          action_id: "nudge_different_question",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "I'm all done" },
          action_id: "participant_complete",
        },
      ],
    },
  ];
}

/** Notification to the editor about a new answer */
export function buildEditorNotification(params: {
  projectTitle: string;
  participantName: string;
  questionNumber: number;
  answerPreview: string;
  followUpCount: number;
  crossPollCount: number;
  dashboardUrl: string;
}): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `New answer on "${params.projectTitle}"`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${params.participantName}* answered question ${params.questionNumber}:`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `> ${params.answerPreview}`,
      },
    },
  ];

  if (params.followUpCount > 0 || params.crossPollCount > 0) {
    const parts: string[] = [];
    if (params.followUpCount > 0) {
      parts.push(
        `${params.followUpCount} follow-up${params.followUpCount > 1 ? "s" : ""}`
      );
    }
    if (params.crossPollCount > 0) {
      parts.push(
        `${params.crossPollCount} cross-pollination question${params.crossPollCount > 1 ? "s" : ""}`
      );
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `:brain: Generated ${parts.join(" and ")} from this answer.`,
        },
      ],
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "View Dashboard" },
        url: params.dashboardUrl,
        action_id: "open_dashboard",
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Approve new questions" },
        style: "primary",
        action_id: "approve_pending_questions",
      },
    ],
  });

  return blocks;
}

/** Wrap-up message when a participant's interview is complete */
export function buildCompletionMessage(params: {
  participantName: string;
  totalQuestions: number;
  editorName: string;
}): KnownBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `That's a wrap, ${params.participantName}! :tada: You answered ${params.totalQuestions} questions and gave us some seriously great material.`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Before anything gets published, you'll get a message from me with your quotes for review. Nothing goes out without your okay.",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${params.editorName} will be putting the article together. Thanks for being part of this! :raised_hands:`,
        },
      ],
    },
  ];
}

/** Quote approval request sent to a participant for review before publication */
export function buildQuoteApprovalMessage(params: {
  participantName: string;
  projectTitle: string;
  editorName: string;
  quotes: Array<{
    quoteApprovalId: string;
    quoteText: string;
    context: string;
    isParaphrased: boolean;
  }>;
}): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Quote review time!",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hey ${params.participantName}! :wave: ${params.editorName} is putting the finishing touches on *"${params.projectTitle}"* and wants to use some of your quotes. Can you take a quick look and approve them?`,
      },
    },
    {
      type: "divider",
    },
  ];

  for (const quote of params.quotes) {
    const paraphraseWarning = quote.isParaphrased
      ? "\n:warning: *This quote has been lightly paraphrased for clarity.* Please review carefully — if the meaning has changed, hit reject and we'll use your original words."
      : "";

    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `> _"${quote.quoteText}"_${paraphraseWarning}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Context: ${quote.context}`,
          },
        ],
      },
      {
        type: "actions",
        block_id: `quote_review_${quote.quoteApprovalId}`,
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve :white_check_mark:" },
            style: "primary",
            action_id: "approve_quote",
            value: quote.quoteApprovalId,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Reject :x:" },
            style: "danger",
            action_id: "reject_quote",
            value: quote.quoteApprovalId,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Suggest edit :pencil:" },
            action_id: "suggest_quote_edit",
            value: quote.quoteApprovalId,
          },
        ],
      },
      {
        type: "divider",
      }
    );
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: ":lock: Nothing gets published without your approval. Take your time!",
      },
    ],
  });

  return blocks;
}

/** Article progress summary for the editor */
export function buildProgressMessage(params: {
  projectTitle: string;
  status: string;
  participantSummary: Array<{
    name: string;
    status: string;
    answered: number;
    total: number;
  }>;
  totalAnswered: number;
  totalExchanges: number;
  saturationReady: boolean;
  saturationScores: Record<string, number> | null;
  deadline: string | null;
  daysRemaining: number | null;
  latestDraftVersion: number | null;
  dashboardUrl: string;
}): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Quotable: "${params.projectTitle}"`,
      },
    },
  ];

  // Deadline countdown
  if (params.deadline) {
    const urgency =
      params.daysRemaining !== null && params.daysRemaining <= 2
        ? ":rotating_light:"
        : params.daysRemaining !== null && params.daysRemaining <= 7
          ? ":hourglass_flowing_sand:"
          : ":calendar:";

    const daysText =
      params.daysRemaining !== null
        ? params.daysRemaining <= 0
          ? "*Past deadline!*"
          : params.daysRemaining === 1
            ? "*1 day left*"
            : `*${params.daysRemaining} days left*`
        : "";

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${urgency} Deadline: ${params.deadline} — ${daysText}`,
      },
    });
  }

  // Overall progress bar
  const pct =
    params.totalExchanges > 0
      ? Math.round((params.totalAnswered / params.totalExchanges) * 100)
      : 0;
  const filled = Math.round(pct / 5);
  const bar = ":large_green_square:".repeat(filled) + ":white_large_square:".repeat(20 - filled);

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Overall progress:* ${params.totalAnswered}/${params.totalExchanges} exchanges (${pct}%)\n${bar}`,
    },
  });

  // Per-participant breakdown
  const participantLines = params.participantSummary.map((p) => {
    const statusIcon =
      p.status === "completed"
        ? ":white_check_mark:"
        : p.status === "active"
          ? ":writing_hand:"
          : p.status === "declined"
            ? ":no_entry_sign:"
            : ":hourglass:";
    return `${statusIcon} *${p.name}* — ${p.answered}/${p.total} answered`;
  });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Participants:*\n${participantLines.join("\n")}`,
    },
  });

  // Saturation scores
  if (params.saturationScores) {
    const scores = Object.entries(params.saturationScores)
      .map(([key, val]) => {
        const emoji = val >= 4 ? ":large_green_circle:" : val >= 3 ? ":large_yellow_circle:" : ":red_circle:";
        return `${emoji} ${key}: ${val}/5`;
      })
      .join("  ");

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Saturation:* ${scores}${params.saturationReady ? "  :white_check_mark: Ready to compile!" : ""}`,
        },
      ],
    });
  }

  // Draft status
  if (params.latestDraftVersion) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `:page_facing_up: Draft v${params.latestDraftVersion} compiled`,
        },
      ],
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Open Dashboard" },
        url: params.dashboardUrl,
        action_id: "open_dashboard",
      },
    ],
  });

  return blocks;
}

/** Notification to editor that all quotes from a participant have been reviewed */
export function buildQuoteReviewCompleteNotification(params: {
  participantName: string;
  projectTitle: string;
  approved: number;
  rejected: number;
  edited: number;
  dashboardUrl: string;
}): KnownBlock[] {
  const summary: string[] = [];
  if (params.approved > 0) summary.push(`${params.approved} approved`);
  if (params.rejected > 0) summary.push(`${params.rejected} rejected`);
  if (params.edited > 0) summary.push(`${params.edited} need edits`);

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:clipboard: *${params.participantName}* finished reviewing their quotes for "${params.projectTitle}": ${summary.join(", ")}.`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View details" },
          url: params.dashboardUrl,
          action_id: "open_dashboard",
        },
      ],
    },
  ];
}
