# GitHub and Cloudflare Deployment Instructions

## 1. Configure Git (if not already done)

```bash
git config user.name "Your GitHub Username"
git config user.email "your.email@example.com"
```

## 2. Create a New GitHub Repository

1. Go to [GitHub](https://github.com/) and log in
2. Click the "+" button in the top-right and select "New repository"
3. Name your repository: `map-visualizer` (or any name you prefer)
4. Add a description (optional): "Map visualization application with NLP capabilities"
5. Set the repository to Public or Private as preferred
6. Do NOT initialize with a README, .gitignore, or license (since we already have these files)
7. Click "Create repository"

## 3. Push Your Code to GitHub

After creating the repository, GitHub will show instructions. Follow these commands:

```bash
# Connect your local repository to the GitHub repo (replace USERNAME with your GitHub username)
git remote add origin https://github.com/USERNAME/map-visualizer.git

# Push your code to GitHub
git push -u origin main
```

If you're using SSH for GitHub, use this format instead:
```bash
git remote add origin git@github.com:USERNAME/map-visualizer.git
git push -u origin main
```

## 4. Deploy to Cloudflare Pages

To deploy to Cloudflare as a successor to f28775f1.for-co-04.pages.dev:

1. Install Wrangler CLI (if not already installed):
```bash
npm install -g wrangler
```

2. Log in to your Cloudflare account:
```bash
wrangler login
```

3. Create a new Cloudflare Pages project:
```bash
wrangler pages project create map-visualizer
```

4. Deploy your application:
```bash
wrangler pages publish . --project-name map-visualizer
```

5. Set up environment variables in the Cloudflare dashboard:
   - Go to the Cloudflare dashboard
   - Navigate to Pages > map-visualizer > Settings > Environment variables
   - Add:
     - MAPBOX_TOKEN: pk.eyJ1IjoidHVmZmNyZWF0ZSIsImEiOiJjbHU5YXJxeXQwN2J6MmpsMDRvMGJ0dGhsIn0.neijgnnqzQ0aCHzOPrE_MQ
     - GEMINI_API_KEY: your_gemini_api_key (if using)

6. After deployment, Cloudflare will provide a URL for your application
   (like map-visualizer.pages.dev) 