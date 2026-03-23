# Support Chat (AI Assistant)

## Overview
The Support Chat is a built-in AI assistant that can answer questions about any feature, workflow, or troubleshooting issue in the app. It uses Claude (Anthropic's AI) and has access to the full knowledge base of all app documentation.

Access: **Tools > Support** or click the chat bubble icon in the bottom-right corner of any page.

## How to Use It
1. Click **+ New Conversation** to start a fresh conversation
2. Type your question in the input box
3. Press **Enter** (or **Shift+Enter** for a new line) or click **Send**
4. The assistant streams its response in real time

The assistant knows:
- All app features, pages, and workflows
- Troubleshooting steps for common issues
- How to interpret error messages
- Admin-only features (if you're an admin)
- MCP integration and Claude Desktop setup

## Example Questions
- "How do I lock a period?"
- "What's the difference between a book AJE and a tax AJE?"
- "My TB is out of balance — how do I find the problem?"
- "How do I configure Claude Desktop with this app?"
- "What gets copied when I roll forward a period?"
- "How do I assign tax codes to accounts?"
- "What does the confidence score mean in AI classification?"
- "Why can't I see the unlock button?" (Answer: you need admin role)

## Conversation History
All conversations are saved automatically. The left sidebar lists:
- **Bookmarked**: Conversations you've starred for easy reference
- **Recent**: All other conversations, newest first

Click any conversation to resume it. The assistant remembers the full context of the conversation.

## Bookmarking
Hover over any conversation in the sidebar to reveal the bookmark (star) and delete icons. Click the star to bookmark a conversation — useful for saving answers you might need to reference again.

## Deleting Conversations
Hover over a conversation and click the delete icon. A confirmation appears before deletion. Deleted conversations cannot be recovered.

## The Floating Chat Bubble
A small chat bubble icon appears in the bottom-right corner of every page. Clicking it opens the Support Chat in a slide-in panel so you can get help without navigating away from your current work.

## Privacy and Data
- Conversations are stored in the app database and are private to each user
- The app sends your question and the knowledge base to Anthropic's Claude API to generate answers
- Conversation history within a session is included for context (so Claude can follow a multi-turn conversation)
- No client financial data (actual balances, account names, transactions) is sent to the AI — only your text questions and the general knowledge base documentation

## When the Chat Can't Help
The support chat answers questions about how to use the app. It cannot:
- Access your actual client data or show you specific account balances
- Perform actions on your behalf (use the MCP integration for that)
- Answer questions about tax law or accounting standards beyond general context
- Replace professional accounting or tax advice

For real-time AI actions on your data (running diagnostics, auto-assigning tax codes, etc.), use the **AI Diagnostics** page or the **MCP integration** with Claude Desktop.
