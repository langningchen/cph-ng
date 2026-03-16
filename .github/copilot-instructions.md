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
1.  **Format & Lint**: `pnpm format`
2.  **Translation Check**: `pnpm check-translations`
3.  **Type Check**: `pnpm typecheck`
4.  **Run Tests**: `pnpm test:run`
5.  **Build Validation**: `pnpm package`

## 3. Version Control & Git Standards
After codebase modifications pass the Verification Pipeline, you MUST commit the changes locally.

### Commit Constraints:
- **Strict commitlint Standard**: All commit messages must follow Conventional Commits (e.g., `feat: ...`, `fix: ...`, `refactor: ...`, `chore: ...`).
- **Atomic Commits**: One logical change per commit. NEVER bundle multiple unrelated features/fixes into a single monolithic commit. Make separate commits for separate changes.
- **NO CHANGELOG**: Do NOT generate, modify, or update `CHANGELOG.md`.
- **NO PUSH**: NEVER execute or suggest `git push`. Only create local commits.

## 4. Code Generation Quality
- **Strict Typing**: All code must be TypeScript with 100% type safety.
- **Pre-emptive Debugging**: Resolve any potential linting or type errors within the snippet before presenting it.
- **Performance**: Prioritize efficient execution and minimal bundle impact.
