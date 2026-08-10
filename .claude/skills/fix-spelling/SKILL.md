---
name: fix-spelling
description: "Fix cspell spelling errors by finding the best resolution for each unknown word. Always prefer rewording the text (in American English) over dictionaries, regex patterns, or suppressions. Use when cspell reports unknown words, when you want to clean up spelling lint errors, or when adding new words/patterns to cspell config."
---

# Fix Spelling (cspell)

Resolve cspell unknown-word errors using the least-invasive fix that is also correct. Work through the decision tree **in order** for every flagged word — always try to reword the text before reaching for a dictionary, regex, or suppression.

## Core Principles

- **Reword first.** The cleanest fix is almost always to rephrase the sentence so the flagged word disappears, replaced by ordinary words cspell already accepts. No config change, no suppression, nothing for a future reader to trip over. Only fall through to the later steps when the word genuinely must stay — identifiers, proper nouns, package/API names, filenames, or a precise technical term with no natural substitute.
- **American English only.** Always resolve toward US spelling. When rewording or choosing a replacement, pick the American form:

  | Prefer (American) | Not (British)        |
  | ----------------- | -------------------- |
  | `color`           | `colour`             |
  | `behavior`        | `behaviour`          |
  | `initialize`      | `initialise`         |
  | `analyze`         | `analyse`            |
  | `canceled`        | `cancelled`          |
  | `center`          | `centre`             |
  | `license` (noun)  | `licence`            |

  The `-ize`/`-yze`/`-or` endings are the rule. If a flagged word is the British spelling of an accepted word, **replace it with the American spelling** — never add a British spelling to a dictionary or `words[]` array.

## Decision Tree

For each unknown word, evaluate in this order:

### 1. Can you reword the text to avoid the word? (do this first)

Before touching any config, ask: **can this sentence be rephrased so the flagged word is gone entirely, using words cspell already accepts?** If yes, edit the source text. This is the preferred fix in every case where it applies.

This covers two common situations:

- **British → American spelling:** replace with the US form (`colour` → `color`). See Core Principles.
- **Non-standard variant, informal plural, or run-together compound:** use the standard wording cspell accepts.

  | Non-standard | Reword to                               |
  | ------------ | --------------------------------------- |
  | `lifecycles` | `life cycles` or `lifecycle` (singular) |
  | `datastore`  | `data store`                            |
  | `autoformat` | `auto-format`                           |
  | `parameterizes` | `parameterizes the values` → e.g. `substitutes the values` / `handles substitution` |

**When NOT to reword** (skip to the next steps): the token is an identifier, variable/function name, proper noun, package or API name, filename, URL, or a precise technical term where any substitute would be awkward or lose meaning. Do not force an unnatural rewrite or sacrifice correctness just to dodge a word — a reword must read naturally and mean exactly the same thing.

### 2. Is there a cspell dictionary that covers it?

Run to find what dictionaries are installed:

```sh
npx cspell --help | grep -A5 "dictionaries"
# or list bundled dictionaries:
ls node_modules/@cspell/dict-*/
```

Check the [cspell dictionaries catalog](https://github.com/streetsidesoftware/cspell-dicts) for a matching package (e.g. `@cspell/dict-software-terms`, `@cspell/dict-css`, `@cspell/dict-typescript`). If one exists, install it and add it to the relevant `cspell.json`:

```json
{
  "dictionaries": ["software-terms"],
  "dictionaryDefinitions": [
    {
      "name": "software-terms",
      "path": "./node_modules/@cspell/dict-software-terms/dict/softwareTerms.txt"
    }
  ]
}
```

**Only add a dictionary if it covers the word AND the dictionary is broadly relevant** — don't install a CSS dictionary just for one word.

### 3. Is the word genuinely real and worth keeping?

A word passes this bar if it appears in mainstream technical documentation (MDN, Angular docs, Node.js docs, etc.) or is a widely-accepted compound in software engineering. When in doubt, search for it. (If it's just a British spelling of a real word, go back to step 1 and use the American spelling instead.)

If yes, add it to `cspell.json` at the appropriate scope (see **Scope Rules** below).

### 4. Can the pattern be matched with a regex?

Use a `patterns` entry when the "word" is a structured token — not a dictionary word — that will appear in many places:

- Framework-generated identifiers: `ngcontent-abc-c0`, `_nghost-ng-c12`
- CSS variable values with embedded names: `--font-display: "My Custom Font"`
- API tokens, hash values, encoded strings: `phc_abc123`, `LA9j8kH8nO`
- Date/format strings: `yyyy-MM-dd`, `HH:mm:ss`
- Vendor-specific event names that follow a pattern: `bindtap`, `catchtap`

Add to the relevant `cspell.json`:

```json
{
  "patterns": [
    {
      "name": "my-pattern-name",
      "pattern": "your-regex-here"
    }
  ],
  "ignoreRegExpList": ["my-pattern-name"]
}
```

### 5. Inline suppression (one-off cases)

Use inline comments only for truly isolated occurrences — a proper name, a generated identifier, a legacy string you cannot change.

**Suppress one line:**

```ts
// cspell:disable-next-line
const x = someWeirdIdentifier;
```

**Declare words used throughout a file:**

```ts
// cspell:words myWord anotherWord
```

Place the `cspell:words` comment near the top of the file. Use this when a word appears several times in one file but is not used project-wide.

---

## Scope Rules

When a word must be added to a `words` array, add it at the **narrowest correct scope**:

| Scope             | When to use                                     | Where                           |
| ----------------- | ----------------------------------------------- | ------------------------------- |
| **File inline**   | Word appears only in this one file              | `// cspell:words x` in the file |
| **Package-local** | Word is specific to one package in the monorepo | `packages/<name>/cspell.json`   |
| **Monorepo root** | Word is used across multiple packages           | Root `cspell.json`              |

Do not add a word to the root config if it is only used in one package. Do not add a word to a package config if it appears across the monorepo.

Keep the `words` array alphabetically sorted.

---

## How to Investigate an Unknown Word

1. **Read the surrounding sentence first** — decide whether a reword (step 1) is possible before anything else. If the word is prose (a comment, doc, or human-facing string), a reword usually wins.

2. **Find where it appears:**

   ```sh
   grep -rn "theWord" --include="*.ts" --include="*.md" --include="*.mdx" .
   ```

3. **Check if it's in any installed cspell dict:**

   ```sh
   npx cspell check --no-progress /path/to/file.ts 2>&1 | grep "theWord"
   # or test a word directly:
   echo "theWord" | npx cspell stdin
   ```

4. **Count occurrences to judge scope** (only relevant once you've ruled out rewording):
   - 1-3 occurrences in one file → inline suppression
   - Many occurrences in one package → package `cspell.json`
   - Spread across packages → root `cspell.json`

5. **Verify the fix eliminates the error:**
   ```sh
   npx cspell "**/*.{ts,tsx,md,mdx}" --no-progress
   ```

---

## Output Format

For each flagged word, report the checks in order — reword first:

```
Word: "colour"
File: src/theme/palette.ts:12:20

Decision:
  ✓ Reword: British spelling — replace with American "color" (accepted, no config)

Fix: Edit src/theme/palette.ts → "colour" → "color"
```

When rewording is not possible, show why it was ruled out before the fix you chose:

```
Word: "algoliasearch"
File: platform/functions/src/widget/create/algolia.ts:1:20

Decision:
  ✗ Reword: it's an npm import identifier — cannot rephrase
  ✗ Dictionary: no cspell dict covers this package name
  ✓ Real word: real package name, used across the package
  Scope: several occurrences in one package

Fix: Add "algoliasearch" to platform/functions/cspell.json → words[]
```

Then apply the fix.
