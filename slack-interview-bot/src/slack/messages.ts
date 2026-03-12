import type { KnownBlock } from "@slack/web-api";

/**
 * Block Kit message builders for all bot messages.
 * Slack Block Kit reference: https://api.slack.com/block-kit
 */

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
        text: `Hi ${params.participantName}! I'm helping ${params.editorName} put together an article about *"${params.projectTitle}"*.`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${params.editorName} thought you'd have great perspective — ${params.participantContext}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `I'll ask you about ${params.estimatedQuestions} questions over the next few days. Reply whenever it's convenient — no rush at all.`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Let's go" },
          style: "primary",
          action_id: "participant_accept",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Not right now" },
          action_id: "participant_delay",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Decline" },
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
}): KnownBlock[] {
  return [
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Question ${params.questionNumber} of ~${params.estimatedTotal}`,
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
          text: "Just reply to this message with your answer. Take as much space as you need.",
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Skip this question" },
          action_id: "skip_question",
        },
      ],
    },
  ];
}

/** Nudge for participants who haven't responded */
export function buildNudgeMessage(params: {
  participantName: string;
  daysSinceSent: number;
  questionPreview: string;
}): KnownBlock[] {
  const timeDescription =
    params.daysSinceSent === 1
      ? "yesterday"
      : `${params.daysSinceSent} days ago`;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hey ${params.participantName} — just a friendly follow-up on the question I sent ${timeDescription}. No rush, but wanted to make sure it didn't get buried.`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `> ${params.questionPreview}`,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Answer now" },
          style: "primary",
          action_id: "nudge_answer",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Ask me something else" },
          action_id: "nudge_different_question",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "I'm done" },
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
        text: `Project Update: "${params.projectTitle}"`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${params.participantName}* just answered question ${params.questionNumber}.`,
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
        `${params.followUpCount} follow-up question${params.followUpCount > 1 ? "s" : ""}`
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
          text: `I generated ${parts.join(" and ")}.`,
        },
      ],
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "View in Dashboard" },
        url: params.dashboardUrl,
        action_id: "open_dashboard",
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Approve questions" },
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
        text: `Thanks so much, ${params.participantName}! That's all ${params.totalQuestions} questions done. Your insights are going to make this article great.`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${params.editorName} will be putting the article together and may reach out if anything needs clarification.`,
        },
      ],
    },
  ];
}
