# Deploying to GitHub Pages

This is a static site (HTML/CSS/JS) — no build step needed. GitHub Pages can serve it directly.

---

## Step 1: Create a GitHub Repository

1. Go to [github.com](https://github.com) and log in.
2. Click **+** → **New repository**.
3. Name it **`<your-username>.github.io`** (e.g., `nguyennguyen.github.io`).
   - This creates your **personal GitHub Pages site** and will be served at `https://<your-username>.github.io`.
   - Alternatively, name it anything (e.g., `portfolio`) and it will be served at `https://<your-username>.github.io/portfolio`.
4. Set it to **Public**.
5. Do **not** initialize with a README (you already have files locally).
6. Click **Create repository**.

---

## Step 2: Connect Your Local Repo to GitHub

In your terminal, from the `portfolio/` directory:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

---

## Step 3: Enable GitHub Pages

1. On GitHub, go to your repository → **Settings** → **Pages** (left sidebar).
2. Under **Source**, select:
   - Branch: `main`
   - Folder: `/ (root)`
3. Click **Save**.

GitHub will build and publish your site. It may take 1–2 minutes.

Your site will be live at:
```
https://<your-username>.github.io           # if repo is named <username>.github.io
https://<your-username>.github.io/<repo>    # if repo has a different name
```

---

## Step 4: Add Your Photo (Optional)

Drop a file named `photo.jpg` into the `portfolio/` folder. The site will automatically display it in the hero section. Recommended: a square image, at least 400×400px.

```bash
cp /path/to/your/photo.jpg /path/to/portfolio/photo.jpg
git add photo.jpg
git commit -m "Add profile photo"
git push
```

---

## Step 5: Update Links

Before pushing, open `index.html` and update the placeholder LinkedIn and GitHub URLs:

```html
<!-- Find these lines and replace with your actual profile URLs -->
<a href="https://linkedin.com/in/YOUR-PROFILE" ...>
<a href="https://github.com/YOUR-USERNAME" ...>
```

---

## Updating the Site

Every time you push to `main`, GitHub Pages will automatically redeploy:

```bash
git add .
git commit -m "Update portfolio"
git push
```

---

## Custom Domain (Optional)

If you own a domain (e.g., `nguyennguyen.dev`):

1. In **Settings → Pages → Custom domain**, enter your domain.
2. Add a `CNAME` file to your repo containing just your domain name:
   ```
   nguyennguyen.dev
   ```
3. Update your domain's DNS records to point to GitHub Pages ([GitHub docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)).
