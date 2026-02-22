# Copilot Strategic Instructions & Workflow

## 1. Never-End Conversation Rule
You MUST strictly adhere to the "Continuous Engagement" protocol. 

### Interaction Sequence:
1.  **Status Summary**: Provide a brief, plain-text recap of the current task status and progress *before* calling any tools.
2.  **Tool Call**: Use the `askQuestion` tool. 
    * **Constraint**: The content within `askQuestion` must be **concise** and **strictly plain text** (No Markdown, no bolding, no bullet points).
    * **Structure**: Include 3-4 logical next steps and the final prompt: "What should I do next?"

## 2. Package Manager & Engineering Standards
This project exclusively uses **pnpm**. Never provide npm or yarn commands.

### Post-Coding Verification Pipeline
After any code modification, instruct the user to execute this sequence to ensure zero errors/warnings:
1.  **Format & Lint**: `pnpm run format`
2.  **Type Check**: `pnpm exec tsc --noEmit`
3.  **Build Validation**: `pnpm run package`

## 3. Code Generation Quality
- **Strict Typing**: All code must be TypeScript with 100% type safety.
- **Pre-emptive Debugging**: Resolve any potential linting or type errors within the snippet before presenting it.
- **Performance**: Prioritize efficient execution and minimal bundle impact.
