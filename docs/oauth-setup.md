# OAuth Setup Guide for Social Logins

This document guides you through setting up Google OAuth applications to enable social logins locally in **NotAnotherCards**.

---

## 🚀 Overview

Social authentication in NotAnotherCards is powered by **Better Auth**. To test these login features locally, you need to register developer accounts and create applications on the Google Cloud Console.

Once created, you will obtain the client IDs and secrets to configure in your local environment files (`.env` and `apps/api/.env`).

---

## 1. Google OAuth Setup

Follow these steps to obtain a `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`:

### Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your Google account.
3. Click the project dropdown in the top navigation bar and select **New Project**.
4. Give your project a name (e.g., `NotAnotherCards Dev`) and click **Create**.

### Step 2: Configure the OAuth Consent Screen

1. In the top left-hand hambuger menu, under to **APIs & Services**, go to **Credentials**.
2. Press **Create Credentials** -> **OAuth client ID**
3. Follow the wizard step-by-step:
   - **Configure consent screen** -> **Get Started**.
   - **App information**: Give your project a name (e.g., `NotAnotherCards Local`) and select a user support email.
   - **Audience**: Under the Audience section, configure the user type. Select **External** (this is where the External configuration now lives) so any Google user can access it.
   - **Contact information**: Enter developer contact emails.
4. Click **Save and Continue** (you can skip adding Scopes and Test Users for local development).

### Step 3: Create OAuth 2.0 Credentials

1. Go to **Clients** in the left sidebar under the Google Auth Platform navigation.
2. Click **Create Client**.
3. Choose **Web application** as the Application Type.
4. Set the name to `Local Dev Client`.
5. Under **Authorized JavaScript origins**, click **+ Add URI** and add:
   - `http://localhost:5173` _(Frontend Dev Server)_
   - `http://localhost:3000` _(Backend API Server)_
6. Under **Authorized redirect URIs**, click **+ Add URI** and add:
   - `http://localhost:3000/api/auth/callback/google` _(Direct Backend Callback)_
   - `http://localhost:5173/api/auth/callback/google` _(Proxied Frontend Callback)_
7. Click **Create**.
8. Copy the **Client ID** and **Client Secret** from the details page or modal that appears.

---

## 3. Environment Configuration

Once you have gathered the credentials, update your environment files.

> [!IMPORTANT]
> Keep your secrets secure and never commit actual client secrets to the Git repository.

### For Local Development (No Docker Container)

Add the keys to your `apps/api/.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### For Docker Compose Development

Add the same variables to the root `.env` file at the repository root, so that the API container can read them:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

## 3. 🌐 Deployed Environments (Production/Staging)

To get social logins working on a deployed instance:

1. **Google Console Credentials**: In the same Google client configuration (or a new production-specific client), add your deployment's URLs:
   - **Authorized JavaScript origins**: `https://cards.dustyway.org`
   - **Authorized redirect URIs**: `https://cards.dustyway.org/api/auth/callback/google`
2. **Environment Variables**: Configure the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables in your server's deployment or Docker Compose configuration exactly as shown in [Section 3](#3-environment-configuration).

---

## 4. 🔗 Technical Details & Callback Handling

1. **How Redirects Work**:
   When a user clicks "Login with Google", the client initiates the flow through Better Auth. Better Auth redirects the user's browser to the provider's consent page. Once authorized, the provider redirects the browser to the registered callback URI.
2. **Backend Proxying**:
   The React client communicates with the NestJS backend via a Vite proxy mapping `/api` to `http://localhost:3000`. Therefore, redirects configured to either the frontend port (`5173`) or backend port (`3000`) will hit the Better Auth endpoint controller.
