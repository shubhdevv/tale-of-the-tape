# Tale of the Tape: UFC higher or lower

Two UFC fighters appear side by side. Guess whether the fighter on the right has a higher or lower stat than the one on the left. One wrong guess ends the game.

- 705 fighters, 39 stats (record, striking, grappling, physical)
- It gets harder as your score goes up
- You can share your score on X

The site is fully static: everything it needs is in `public/`.

## Run locally

```
npm run dev        # http://localhost:3000
```

## Update the fighter data

```
npm run build:ufc -- --refresh
```

- **Stats:** UFCStats.com data, taken from the public [scrape_ufc_stats](https://github.com/Greco1899/scrape_ufc_stats) dataset. It covers UFC fights only, and includes fighters with at least 5 UFC fights.
- **Photos:** freely licensed images from Wikipedia and Wikimedia Commons. Each photo has an ⓘ link to its author and license.

## Deploy

The site is live at **https://tale-of-the-tape.pages.dev** on Cloudflare Pages. To publish changes:

```
npm run deploy
```

It uploads only the `public/` folder. There's no build step.

If the site address ever changes, update the X link-preview tags with:

```
node scripts/set-site-url.mjs https://your-site.pages.dev
```

To regenerate the share image, render `scripts/og.html` at 1200×630 and save it as `public/og.png`.
