# Zinomi Creation – Store Manager Suite

Games, Movies & Software store manager. Pure HTML/CSS/JS – no build step.

## Structure
```
index.html      Main menu (launcher)
games.html      Game Hub
movies.html     Movie Hub
software.html   Software Hub
css/            One stylesheet per page
js/             One script per page
images/         Logos, backgrounds, favicon
```

## Put it on GitHub Pages
1. Create a repo and upload **everything in this folder** (keep the folders).
2. Repo → Settings → Pages → Source: `main` branch, `/ (root)`.
3. Open `https://<your-username>.github.io/<repo>/`.

## Important: your data
Data is stored in the browser (IndexedDB / localStorage) and is tied to the web address.
A new address (GitHub Pages instead of the old file) starts **empty**.
In the OLD version: Menu → Backup & Restore → *Download full backup*.
In the NEW version: Menu → Backup & Restore → *Restore from file*.

Don't open `index.html` by double-click; use GitHub Pages (or `python -m http.server`) so the hubs load.
