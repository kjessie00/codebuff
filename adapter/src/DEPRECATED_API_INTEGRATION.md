# ⚠️ DEPRECATED: Anthropic API Integration

## This file has been replaced!

**`claude-integration.ts`** used the **PAID Anthropic API** which is **NOT** what we want.

## Use the NEW Integration Instead

**File**: `claude-cli-integration.ts`

**Benefits**:
- ✅ 100% FREE (no API costs)
- ✅ No API keys required
- ✅ Uses Claude Code CLI subprocess
- ✅ Local execution
- ✅ Private (no external API calls)

## What Changed

| Old (claude-integration.ts) | New (claude-cli-integration.ts) |
|----------------------------|----------------------------------|
| Uses @anthropic-ai/sdk | Uses child_process.spawn() |
| Requires ANTHROPIC_API_KEY | No API key needed |
| Costs $0.50-$2.00 per session | $0.00 cost (FREE) |
| Sends data to Anthropic API | Runs locally via CLI |

## Migration

See: [CLAUDE_CLI_INTEGRATION.md](../CLAUDE_CLI_INTEGRATION.md)

## Why Keep the Old File?

The old `claude-integration.ts` is kept for reference only. It demonstrates the Anthropic API approach, but should NOT be used in production.

**Always use `claude-cli-integration.ts` instead!**
