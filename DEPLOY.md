# Deployment Plan for Leraar AI

This guide will help you host your project on Vercel.

## 1. Push Code to GitHub

Since you don't have a GitHub repository connected yet, you need to create one and push your code.

1.  **Create a Repository on GitHub:**
    *   Go to [github.com/new](https://github.com/new).
    *   Name the repository (e.g., `leraar-ai`).
    *   Set it to **Private** (recommended since you have some sensitive logic, even though keys are safe).
    *   Do **not** initialize with README, .gitignore, or License (you already have them).
    *   Click **Create repository**.

2.  **Connect and Push:**
    In your terminal (open a new terminal window in this project folder or use the one in your editor), run the commands GitHub shows you under "…or push an existing repository from the command line". They will look like this:

    ```bash
    git remote add origin https://github.com/YOUR_USERNAME/leraar-ai.git
    git branch -M main
    git push -u origin main
    ```
    *(Replace `YOUR_USERNAME` and `leraar-ai` with your actual username and repo name)*

## 2. Deploy to Vercel

1.  **Go to Vercel:**
    *   Log in to [vercel.com](https://vercel.com).
    *   Click **"Add New..."** -> **"Project"**.

2.  **Import from GitHub:**
    *   Find your `leraar-ai` repository in the list and click **Import**.

3.  **Configure Project:**
    *   **Framework Preset:** Vercel should automatically detect `Next.js`.
    *   **Root Directory:** `./` (default).

4.  **Environment Variables (CRITICAL):**
    Expand the **Environment Variables** section and add the following keys from your `.env.local` file. **Do not copy the file itself, add these one by one in the Vercel UI.**

    | Key | Value |
    | :--- | :--- |
    | `DATABASE_URL` | `postgresql://postgres.[YOUR_PROJECT_ID]:[YOUR_PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres` (Get this from your .env.local) |
    | `NEXT_PUBLIC_SUPABASE_URL` | `https://[YOUR_PROJECT_ID].supabase.co` |
    | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `[YOUR_LONG_ANON_KEY]` |
    | `GOOGLE_GENERATIVE_AI_API_KEY` | `[YOUR_GEMINI_API_KEY]` |

    *Note: For `DATABASE_URL`, ensure you are using the "Transaction" pooler string (ends in `6543`) for better performance on serverless environments like Vercel.*

5.  **Deploy:**
    *   Click **Deploy**.
    *   Wait for the build to complete. You should see confetti!

## 3. Post-Deployment Checks

1.  **Database Connection:**
    *   Visit your deployed URL.
    *   Try to log in or sign up. If it works, Supabase is connected correctly.
    *   If you see connection errors, double-check your `DATABASE_URL` variable in Vercel settings -> Environment Variables.

2.  **AI Features:**
    *   Navigate to a study session and try the AI chat.
    *   If it fails, check the `GOOGLE_GENERATIVE_AI_API_KEY` variable.

## Troubleshooting

*   **Build Failures:** Check the logs in Vercel. Common issues include type errors that didn't stop local development but fail the strict production build.
*   **Supabase Connection Issues:** Ensure your database password doesn't have special characters that break the URL format (if so, URL-encode them). Ensure "Allow access from anywhere" (0.0.0.0/0) is enabled in Supabase Network settings if you have restriction rules, or use Vercel Integration.

Good luck!
