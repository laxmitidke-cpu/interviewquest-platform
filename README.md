<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9a9284b4-a1da-47f0-8a19-ea1e4c9ecb22

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Create a local alias for the hostname `quest` so the browser can resolve it:
   - On Windows, add this line to `C:\Windows\System32\drivers\etc\hosts`:
     `127.0.0.1 quest`
4. Copy `.env.local.example` to `.env.local` and adjust values if needed.
5. Run the app:
   `npm run dev`
