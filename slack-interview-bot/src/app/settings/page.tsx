"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [geminiKey, setGeminiKey] = useState("");
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackAppToken, setSlackAppToken] = useState("");
  const [slackSigningSecret, setSlackSigningSecret] = useState("");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Slack Configuration */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Slack Connection
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="slackBotToken" className="label">
                Bot Token (xoxb-...)
              </label>
              <input
                id="slackBotToken"
                type="password"
                className="input"
                placeholder="xoxb-..."
                value={slackBotToken}
                onChange={(e) => setSlackBotToken(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="slackSigningSecret" className="label">
                Signing Secret
              </label>
              <input
                id="slackSigningSecret"
                type="password"
                className="input"
                value={slackSigningSecret}
                onChange={(e) => setSlackSigningSecret(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="slackAppToken" className="label">
                App Token (xapp-...) — for Socket Mode
              </label>
              <input
                id="slackAppToken"
                type="password"
                className="input"
                placeholder="xapp-..."
                value={slackAppToken}
                onChange={(e) => setSlackAppToken(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Only needed for development. In production, use the Events API
                webhook.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            These values are configured via environment variables. This page
            shows the current connection status.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                process.env.NEXT_PUBLIC_SLACK_CONNECTED === "true"
                  ? "bg-green-500"
                  : "bg-gray-300"
              }`}
            />
            <span className="text-sm text-gray-600">
              Slack bot status will appear here once connected
            </span>
          </div>
        </div>

        {/* Gemini Configuration */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Google Gemini AI
          </h2>
          <div>
            <label htmlFor="geminiKey" className="label">
              API Key
            </label>
            <input
              id="geminiKey"
              type="password"
              className="input"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Used for question generation, follow-ups, cross-pollination, and
            draft compilation. Configure via GEMINI_API_KEY environment variable.
          </p>
        </div>

        {/* Default Interview Settings */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Default Interview Settings
          </h2>
          <p className="text-sm text-gray-500">
            These defaults are set via environment variables and can be
            overridden per-project:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>
              <strong>Max rounds per participant:</strong>{" "}
              {process.env.DEFAULT_MAX_ROUNDS || "10"}
            </li>
            <li>
              <strong>Nudge after:</strong>{" "}
              {process.env.DEFAULT_NUDGE_HOURS || "48"} hours
            </li>
            <li>
              <strong>Approval mode:</strong>{" "}
              {process.env.DEFAULT_APPROVAL_MODE || "auto"}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
