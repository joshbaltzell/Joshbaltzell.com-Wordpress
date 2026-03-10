# JoshBaltzell.com - WordPress

Personal brand website for Josh Baltzell, featuring AI-conducted interviews on technology, business, and life.

## Hosting

Hosted on **WPEngine**. WordPress core is managed by WPEngine — this repo tracks only custom theme and must-use plugins.

## Structure

```
wp-content/
├── themes/joshbaltzell/   # Custom FSE block theme
└── mu-plugins/            # Must-use plugins (custom post types)
```

## Theme

**joshbaltzell** — A custom Full Site Editing block theme with a watercolor-inspired design system.

- Built with `theme.json` design tokens
- Custom `ai_interview` post type for AI-conducted interviews
- Watercolor art direction with editorial typography
- Resume/CV page template

## Deployment

Push to WPEngine via git or GitHub Actions. Only the `wp-content/` directory is deployed.

## AI Interview Format

The site's primary content is interviews conducted by AI on topics spanning:
- Technology & E-commerce
- Business & Entrepreneurship
- Philosophy & Life

Each interview uses a conversational Q&A format with distinct visual styling for interviewer and interviewee.
