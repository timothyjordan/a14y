## Install

```bash
# Recommended: install a14y globally and set up the agent skill in one step
npx a14y install

# One-shot audit, no install
npx a14y https://example.com

# Install globally by hand
npm install -g a14y
a14y https://example.com
```

`npx a14y install` runs `npm install -g a14y` and then `a14y skill install`, so the CLI lands on your `PATH` and your coding agents pick up the a14y skill.

The CLI also ships under two alias names for discoverability: `agentready` and `agentreadability`. All three run the same binary.
