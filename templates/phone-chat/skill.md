---
template: phone-chat
triggers: phone, mobile, app, imessage, whatsapp, text, sms, assistant, consumer, chat, chatbot, ios, android
---
# Phone Chat: a bright phone, a real conversation, you approve

Beats (fixed by code): hook → notification chaos → chat with the assistant → approval card → end card.

- **hook** / **hookAccent**: the promise (≤ 40 chars) and its last 1–3 words.
- **problemLines**: 2 short lines of pain ("So many apps." / "So little time.").
- **notifications**: 2–4 {app, title, icon} that show the chaos the product removes. Use generic apps
  (Mail, Calendar, Slack). icon is a lucide name (mail, calendar, message-square, bell).
- **chatCaption**: 1–2 short lines ("Just text it.").
- **messages**: 2–4 {from: user|agent, text}. The user asks for one real job this product does, and the
  agent confirms it's done.
- **results**: up to 3 outcomes (≤ 26 chars). **approveItems** / **approveTotal**: what the user approves.
  This is demo data, so keep it plausible and generic.
- **endHeadline**, **cta**, **ctaUrl**: the close and the main button.

```json
{"hook": "Your inbox, handled by text.", "hookAccent": "by text.", "problemLines": ["So many emails.", "So little time."],
 "messages": [{"from": "user", "text": "Reply to the investors thread"}, {"from": "agent", "text": "Drafted — want me to send?"}],
 "results": ["3 replies drafted"], "endHeadline": "Text it. Done.", "cta": "Get the app", "ctaUrl": "yourapp.com"}
```
